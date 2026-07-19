from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json

# Import the engine you just built
from curriculum import generate_curriculum

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

@app.post("/api/curriculum")
async def create_curriculum(request: TopicRequest):
    print(f"Received request to build curriculum for: {request.topic}")
    
    # 1. Call your Gemini engine
    raw_json_string = generate_curriculum(request.topic)
    
    # 2. Parse the string into a Python dictionary
    curriculum_data = json.loads(raw_json_string)
    
    # 3. FastAPI automatically serializes this dictionary back into a clean JSON response
    return curriculum_data