import os
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import List
from langchain.chat_models import init_chat_model
from langchain_core.output_parsers import JsonOutputParser
import json

# Load API keys
load_dotenv()

# 1. Your existing Pydantic schema remains untouched
class Skill(BaseModel):
    name: str = Field(description="The specific name of the skill to be learned.")
    tier_1_metric: str = Field(description="An assessable metric for Tier 1 (Knowledge & Comprehension).")
    tier_2_metric: str = Field(description="An assessable metric for Tier 2 (Application & Analysis).")

class Subtopic(BaseModel):
    name: str = Field(description="The name of the subtopic.")
    skills: List[Skill] = Field(description="A list of 4-6 specific skills required for this subtopic.")

class Curriculum(BaseModel):
    topic: str = Field(description="The exact name of the topic requested. Max 5 words.")
    subtopics: List[Subtopic] = Field(description="A list of 3-5 subtopics that break down the main topic.")

def generate_curriculum(topic_request: str) -> str:
    """
    Calls the LLM via LangChain to generate a strict JSON curriculum.
    """

    # Update the path below to wherever the file is saved in your VSCode
    with open("../project_dictionary/curriculum_engine_expected_output.json", "r") as f:
        contract_example = f.read()
    
    # Initialize the model --> WHERE WE INITIALIZE OUR OWN MODEL
    llm = init_chat_model(
        "google_genai:gemini-2.5-flash", 
        temperature=0
    )
    
    # 1. Swap to JsonOutputParser (Bypasses Tool Calling)
    parser = JsonOutputParser(pydantic_object=Curriculum)
    
    # 2. Add parser.get_format_instructions() to your prompt
    prompt = f"""
    You are an expert curriculum designer. 
    The user wants to learn about: "{topic_request}".
    Break this topic down into 3-5 subtopics. 
    For each subtopic, provide 4-6 specific skills.
    For each skill, define an assessable metric for Tier 1 (Knowledge & Comprehension) and Tier 2 (Application & Analysis).
    
    Both the tiers are related to Bloom's Taxonomy of learning, in summary (PLEASE REFER TO THIS WHEN MAKING SKILLS):
    Tier 1: Lower-Order Thinking Skills (Foundational) --> The base of the pyramid represents the essential knowledge required before attempting more complex tasks.
    1. Remembering: Retrieving, recognizing, and recalling basic facts, terms, or concepts. | Keywords: List, define, identify, memorize.
    2. Understanding: Constructing meaning from messages, interpreting information, or explaining ideas in one's own words.Keywords: Explain, summarize, classify, discuss.

    Tier 2: Middle-Order Thinking Skills (Practical) This tier moves learners from merely having knowledge to utilizing it in real-world or structured scenarios.
    1. Applying: Implementing or using information and procedures in new situations to solve problems. |Keywords: Execute, implement, solve, demonstrate.
    2. Analyzing: Breaking information down into component parts to understand how those parts relate to one another. | Keywords: Compare, contrast, differentiate, deconstruct.

    CRITICAL INSTRUCTIONS:
    - DO NOT output any explanations, rationales, or meta-commentary.
    - FULLY POPULATE all nested arrays. Do not return empty objects.

    EXAMPLE CONTRACT:
    {contract_example}
    
    FORMATTING INSTRUCTIONS:
    {parser.get_format_instructions()}

    """
    
    # 3. Chain the prompt, model, and parser together
    chain = llm | parser
    
    # 4. Invoke the chain
    # The parser automatically returns a clean Python dictionary
    curriculum_dict = chain.invoke(prompt)
    
    # 5. Convert back to a JSON string so your FastAPI endpoint doesn't break
    return json.dumps(curriculum_dict, indent = 4)


if __name__ == "__main__":
    result = generate_curriculum("Python Backend Architecture")
    print(result)





    