import os
import google.generativeai as genai
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import List

# Load the API key from the .env file
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Define the exact JSON structure we want the LLM to output
class Skill(BaseModel):
    name: str
    tier_1_metric: str
    tier_2_metric: str

class Subtopic(BaseModel):
    name: str
    skills: List[Skill]

class Curriculum(BaseModel):
    topic: str = Field(description="The exact name of the topic requested. STRICTLY NO explanations, NO preamble, and NO extra text. Max 5 words.")
    subtopics: List[Subtopic]

def generate_curriculum(topic_request: str) -> str:
    """
    Calls the Gemini LLM to generate a curriculum structured as a strict JSON object.
    """
    # Using Gemini 1.5 Flash for speed and free-tier limits
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    prompt = f"""
    You are an expert curriculum designer. 
    The user wants to learn about: "{topic_request}".
    Break this topic down into 3-5 subtopics. 
    For each subtopic, provide 2-3 specific skills.
    For each skill, define an assessable metric for Tier 1 (Knowledge & Comprehension) 
    and Tier 2 (Application & Analysis).
    
    CRITICAL INSTRUCTIONS:
    - DO NOT output any explanations, rationales, or meta-commentary.
    - The "topic" string must ONLY echo the requested topic name.
    - Keep all metric descriptions concise and strictly to the point (under 15 words each).
    """
    
    # Force the model to return a JSON object that matches our Pydantic schema
    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            response_schema=Curriculum,
        ),
    )
    
    return response.text

# Simple test block that only runs if you execute this file directlyz
if __name__ == "__main__":
    test_topic = "Fields in IB Physics"
    print(f"Generating curriculum for: {test_topic}...\n")
    result = generate_curriculum(test_topic)
    print(result)