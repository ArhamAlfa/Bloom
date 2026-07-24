from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json


import os
import asyncio

# Import the engine you just built
from curriculum import generate_curriculum
from study_guide import generate_all_study_guides # Add this line

# Set this to True to save tokens during frontend development!
USE_MOCK_LLM = True

app = FastAPI()

# This CORS middleware is mandatory so your local HTML file is allowed to talk to this local server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define what the incoming request from the frontend should look like
class TopicRequest(BaseModel):
    topic: str

# @app.post("/api/curriculum")
# async def create_curriculum(request: TopicRequest):
#     print(f"Received request to build curriculum for: {request.topic}")
    
#     # 1. Call your Gemini engine
#     raw_json_string = generate_curriculum(request.topic)
    
#     # 2. Parse the string into a Python dictionary
#     curriculum_data = json.loads(raw_json_string)
    
#     # 3. BACKGROUND WRITE: Save the dictionary to a local file for debugging --> THIS IS WHERE A FILE NAMED CURRENT_CURRICULUM.JSON WILL APPEAR IN THE WORKSPACE WITH THE CURRENT CURRICULUM
#     # Using "w" mode means it will overwrite the file every time a new topic is generated
#     with open("current_curriculum.json", "w", encoding="utf-8") as f:
#         json.dump(curriculum_data, f, indent=4)
    
#     # 4. FastAPI automatically serializes this dictionary back into a clean JSON response
#     return curriculum_data  




# FOR THE PURPOSES OF NOT BURNING OUR DAMN TOKENS THIS IS A MOCK APP.POST
# ==========================================
# STUDY ENGINE ENDPOINT
# ==========================================

@app.post("/api/curriculum")
async def generate_curriculum(request_data: dict):
    print("🟢 MOCK MODE: Returning fake CURRICULUM data (0 tokens used).")
    
    await asyncio.sleep(1) 
    
    # Ensure this path matches your folder structure perfectly
    mock_file_path = os.path.join("current_curriculum.json")
    
    with open(mock_file_path, "r", encoding="utf-8") as file:
        mock_curriculum_data = json.load(file)
        
    return mock_curriculum_data


# ==========================================
# LIVE STUDY ENGINE ENDPOINT
# ==========================================
@app.post("/api/generate")
async def create_study_guides():
    # Deleted the os.path.exists lock from here!
    print("⚡ Triggering concurrent Study Guide generation...")
    try:
        master_json = await generate_all_study_guides()
        return master_json
    except Exception as e:
        print(f"❌ Server Error: {e}")
        return {"error": str(e)}
