import json
import os
import asyncio
from dotenv import load_dotenv
from google import genai

load_dotenv()

async def process_subtopic(client, subtopic, schema_example, semaphore):
    # Safely extract the name regardless of how the curriculum JSON named the key
    subtopic_name = subtopic.get("subtopic") or subtopic.get("title") or subtopic.get("name") or "Unknown_Topic"
    
    async with semaphore:
        print(f"🚀 Started processing: '{subtopic_name}'...")
        
        prompt = f"""
        You are an expert IB Physics HL tutor. Generate a comprehensive study guide based strictly on this curriculum skeleton:
        {json.dumps(subtopic, indent=2)}

        Format all educational text using Markdown. Use $ for inline LaTeX equations and $$ for display equations.
        CRITICAL: You must properly escape all backslashes in your JSON output. For example, write \\\\frac instead of \\frac.

        You MUST return a raw JSON object that strictly follows the structure of this reference example:
        {json.dumps(schema_example, indent=2)}
        """

        # Increased to 5 retries to combat free-tier flakiness
        max_retries = 5  
        for attempt in range(1, max_retries + 1):
            try:
                response = await client.aio.models.generate_content(
                    model="gemini-3.5-flash",
                    contents=prompt,
                    config={"response_mime_type": "application/json"}
                )
                
                raw_text = response.text
                
                # THE JSON ESCAPE FIX
                try:
                    parsed = json.loads(raw_text)
                except json.JSONDecodeError:
                    # If the AI forgot to escape the LaTeX backslashes, we forcefully fix them here before parsing
                    parsed = json.loads(raw_text.replace('\\', '\\\\'))
                
                print(f"✅ Finished generating: {subtopic_name}")
                return parsed
                
            except Exception as e:
                print(f"⚠️ {subtopic_name} (Attempt {attempt}/{max_retries}) Failed: {e}")
                if attempt < max_retries:
                    # Extended backoff time to ensure the 503 traffic jam clears
                    print(f"⏳ Backing off for 15 seconds to let the server breathe...")
                    await asyncio.sleep(15)
        
        return None 

async def generate_all_study_guides():
    output_file = "master_study_guide.json"
    
    # # ==========================================
    # # 1. THE LOCK: Check if we already have the file
    # # ==========================================
    # if os.path.exists(output_file):
    #     print(f"✅ Cached file found! Returning {output_file} without waking up the AI.")
    #     # If it exists, just read it and return it instantly to the frontend
    #     with open(output_file, "r", encoding="utf-8") as f:
    #         return json.load(f)

    # ==========================================
    # 2. THE ENGINE: Run generation if no file exists
    # ==========================================
    print("⚠️ No cached file found. Booting up the AI engine...")
    
    with open("current_curriculum.json", "r", encoding="utf-8") as f:
        curriculum = json.load(f)
    
    with open(os.path.join("..", "project_dictionary", "study_engine_subtopic_output.json"), "r", encoding="utf-8") as f:
        schema_example = json.load(f)

    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    
    # Keeping the bouncer at 1 to guarantee we slip past the free-tier rate limits
    semaphore = asyncio.Semaphore(1)

    tasks = []
    for subtopic in curriculum.get("subtopics", []):
        task = asyncio.create_task(process_subtopic(client, subtopic, schema_example, semaphore))
        tasks.append(task)

    print("⏳ Waiting for all AI generations to finish...")
    results = await asyncio.gather(*tasks)

    # Filter out failures so one dead subtopic doesn't crash the whole file
    successful_results = [r for r in results if r is not None]

    master_json = {
        "course": "IB Physics HL",
        "study_guides": successful_results
    }
    
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(master_json, f, indent=2)

    print(f"🎉 ALL DONE! Merged {len(successful_results)} subtopics into {output_file}")
    
    # ==========================================
    # 3. THE HANDOFF: Send data back to FastAPI
    # ==========================================
    return master_json

if __name__ == "__main__":
    asyncio.run(generate_all_study_guides())