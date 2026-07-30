# import json
# import os
# import asyncio
# from dotenv import load_dotenv
# from google import genai

# load_dotenv()

# async def process_subtopic(client, subtopic, schema_example, semaphore):
#     # Safely extract the name regardless of how the curriculum JSON named the key
#     subtopic_name = subtopic.get("subtopic") or subtopic.get("title") or subtopic.get("name") or "Unknown_Topic"
    
#     async with semaphore:
#         print(f"🚀 Started processing: '{subtopic_name}'...")
        
#         prompt = f"""
#         You are an expert IB Physics HL tutor. Generate a comprehensive study guide based strictly on this curriculum skeleton:
#         {json.dumps(subtopic, indent=2)}

#         Format all educational text using Markdown. Use $ for inline LaTeX equations and $$ for display equations.
#         CRITICAL: You must properly escape all backslashes in your JSON output. For example, write \\\\frac instead of \\frac.

#         You MUST return a raw JSON object that strictly follows the structure of this reference example:
#         {json.dumps(schema_example, indent=2)}
#         """

#         # Increased to 5 retries to combat free-tier flakiness
#         max_retries = 5  
#         for attempt in range(1, max_retries + 1):
#             try:
#                 response = await client.aio.models.generate_content(
#                     model="gemini-3.5-flash",
#                     contents=prompt,
#                     config={"response_mime_type": "application/json"}
#                 )
                
#                 raw_text = response.text
                
#                 # THE JSON ESCAPE FIX
#                 try:
#                     parsed = json.loads(raw_text)
#                 except json.JSONDecodeError:
#                     # If the AI forgot to escape the LaTeX backslashes, we forcefully fix them here before parsing
#                     parsed = json.loads(raw_text.replace('\\', '\\\\'))
                
#                 print(f"✅ Finished generating: {subtopic_name}")
#                 return parsed
                
#             except Exception as e:
#                 print(f"⚠️ {subtopic_name} (Attempt {attempt}/{max_retries}) Failed: {e}")
#                 if attempt < max_retries:
#                     # Extended backoff time to ensure the 503 traffic jam clears
#                     print(f"⏳ Backing off for 15 seconds to let the server breathe...")
#                     await asyncio.sleep(15)
        
#         return None 

# async def generate_all_study_guides():
#     output_file = "master_study_guide.json"
    
#     # # ==========================================
#     # # 1. THE LOCK: Check if we already have the file
#     # # ==========================================
#     # if os.path.exists(output_file):
#     #     print(f"✅ Cached file found! Returning {output_file} without waking up the AI.")
#     #     # If it exists, just read it and return it instantly to the frontend
#     #     with open(output_file, "r", encoding="utf-8") as f:
#     #         return json.load(f)

#     # ==========================================
#     # 2. THE ENGINE: Run generation if no file exists
#     # ==========================================
#     print("⚠️ No cached file found. Booting up the AI engine...")
    
#     with open("current_curriculum.json", "r", encoding="utf-8") as f:
#         curriculum = json.load(f)
    
#     with open(os.path.join("..", "project_dictionary", "study_engine_subtopic_output.json"), "r", encoding="utf-8") as f:
#         schema_example = json.load(f)

#     client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    
#     # Keeping the bouncer at 1 to guarantee we slip past the free-tier rate limits
#     semaphore = asyncio.Semaphore(1)

#     tasks = []
#     for subtopic in curriculum.get("subtopics", []):
#         task = asyncio.create_task(process_subtopic(client, subtopic, schema_example, semaphore))
#         tasks.append(task)

#     print("⏳ Waiting for all AI generations to finish...")
#     results = await asyncio.gather(*tasks)

#     # Filter out failures so one dead subtopic doesn't crash the whole file
#     successful_results = [r for r in results if r is not None]

#     master_json = {
#         "course": "IB Physics HL",
#         "study_guides": successful_results
#     }
    
#     with open(output_file, "w", encoding="utf-8") as f:
#         json.dump(master_json, f, indent=2)

#     print(f"🎉 ALL DONE! Merged {len(successful_results)} subtopics into {output_file}")
    
#     # ==========================================
#     # 3. THE HANDOFF: Send data back to FastAPI
#     # ==========================================
#     return master_json

import os
import json
import asyncio
from dotenv import load_dotenv # Add this import
from langchain_core.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import JsonOutputParser

from langchain_openai import ChatOpenAI

# ADD THIS BLOCK: Force Python to load the .env file from the root backend folder
env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)


async def process_subtopic(chain, subtopic, semaphore):
    subtopic_name = subtopic.get("subtopic") or subtopic.get("name") or "Unknown_Topic"
    
    async with semaphore:
        print(f"🚀 Started processing: '{subtopic_name}'...")
        
        max_retries = 3 
        for attempt in range(1, max_retries + 1):
            try:
                # LangChain automatically handles the async execution here
                parsed_json = await chain.ainvoke({"subtopic_data": json.dumps(subtopic)})
                print(f"✅ Finished generating: {subtopic_name}")
                return parsed_json
                
            except Exception as e:
                print(f"⚠️ {subtopic_name} (Attempt {attempt}/{max_retries}) Failed: {e}")
                if attempt < max_retries:
                    await asyncio.sleep(10)
        
        return None 

async def generate_all_study_guides():
    output_file = os.path.join(os.path.dirname(__file__), "..", "master_study_guide.json")
    curriculum_file = os.path.join(os.path.dirname(__file__), "..", "current_curriculum.json")
    
    print("⚠️ Booting up the LangChain AI Study Engine...")
    
    with open(curriculum_file, "r", encoding="utf-8") as f:
        curriculum = json.load(f)

    # 1. Initialize Paid Gemini (Higher rate limits)
    # llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash", temperature=0.3)
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3,model_kwargs={"response_format": {"type": "json_object"}})
    parser = JsonOutputParser()

    # Load your partner's reference schema directly from the project directory
    ref_path = os.path.join(os.path.dirname(__file__), "..","..", "project_dictionary", "study_engine_subtopic_output.json")
    with open(ref_path, "r", encoding="utf-8") as f:
        reference_schema_string = f.read()
    
    prompt = PromptTemplate(
        template="""You are an expert tutor. Generate a comprehensive markdown study guide based strictly on this curriculum skeleton:
        {subtopic_data}

        Format all educational text using Markdown. Use $ for inline LaTeX equations and $$ for display equations.
        Escape all JSON backslashes properly.

        IMPORTANT: All capstone tasks MUST be text-based, digital-friendly exercises (e.g., writing a summary, solving a theoretical word problem, or drafting a short essay). Do NOT assign physical projects like posters, 3D models, or real-world lab experiments.
        
        CRITICAL INSTRUCTIONS:
            1. Output ONLY raw JSON. Do NOT use markdown code blocks (no ```json).
            2. DEPTH REQUIREMENT: You MUST generate between 5 to 6 substantial, highly detailed sections per subtopic. Do not take shortcuts or compress the material.
            3. EXTERNAL LINKS REQUIREMENT: Every section and the capstone MUST include a "further_reading" array containing at least 2 real, high-quality external resources (e.g., Khan Academy, Wikipedia, or authoritative educational platforms) with valid "title" and "url" keys.
            4. MATH & LATEX: Use formal LaTeX syntax for all scientific or mathematical formulas (e.g., $$ E = mc^2 $$).
            5. SCHEMA COMPLIANCE: Your output MUST strictly match this exact JSON reference schema structure:
        
        {reference_schema}
        """,
        input_variables=["subtopic_name", "skills_list"],
        partial_variables={"reference_schema": reference_schema_string}

        
    )
    
    chain = prompt | llm | parser
    
    # You can safely bump this to 5 now if you are on the paid Gemini tier
    semaphore = asyncio.Semaphore(1)

    tasks = []
    for subtopic in curriculum.get("subtopics", []):
        task = asyncio.create_task(process_subtopic(chain, subtopic, semaphore))
        tasks.append(task)

    print("⏳ Waiting for all AI generations to finish...")
    results = await asyncio.gather(*tasks)

    successful_results = [r for r in results if r is not None]

    master_json = {
        "course": "Generated Course",
        "study_guides": successful_results
    }
    
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(master_json, f, indent=2)

    return master_json



if __name__ == "__main__":
    asyncio.run(generate_all_study_guides())