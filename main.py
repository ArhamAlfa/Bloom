import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import json
import os
import asyncio

# ============================================================
# 1. ENGINE IMPORTS
# ============================================================
# Partner's Exam & Chatbot Engine
from backend.exam.defense_chatbot import call_model
from backend.shared.schemas import MessageSchema

# Your Curriculum & Study Engine
from backend.curriculum_study_engine.curriculum import generate_curriculum
from backend.curriculum_study_engine.study_guide import generate_all_study_guides


app = FastAPI(title="Bloom Master API")  

# ============================================================
# 2. CONFIGURATION TOGGLES
# ============================================================
USE_MOCK_LLM = False
USE_MOCK_CURRICULUM = True   # Turns off OpenAI, reads current_curriculum.json
USE_MOCK_STUDY_GUIDE = True  # Set to False to run OpenAI/Gemini live


# ============================================================
# 3. MIDDLEWARE (CORS)
# ============================================================
# Allow frontend to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# 4. SCHEMAS
# ============================================================
class TopicRequest(BaseModel):
    topic: str


# ============================================================
# 5. API ENDPOINTS
# ============================================================

@app.get("/api/health")
def read_root():
    return {"status": "Bloom API is live!"}

# --- PARTNER's ENDPOINT ---
@app.post("/call_model")
def read_item(state: MessageSchema):
    """Handles the Tier 3 Defense Chatbot interactions."""
    state = call_model(state)
    return state

# --- YOUR MASTER PIPELINE ENDPOINT ---
@app.post("/api/build-pathway")
async def build_full_pathway(request: TopicRequest):
    """Generates the full curriculum and study guides in one go."""
    print(f"\n🌱 Pathway build requested for topic: '{request.topic}'")
    
    try:
        # STEP 1: CURRICULUM ENGINE
        if USE_MOCK_CURRICULUM:
            print("🟢 MOCK MODE: Loading Curriculum from local cache...")
            await asyncio.sleep(0.5)
            with open("backend/current_curriculum.json", "r", encoding="utf-8") as f:
                curriculum_data = json.load(f)
        else:
            print("1️⃣ LIVE MODE: Generating Curriculum with OpenAI...")
            curriculum_data = generate_curriculum(request.topic)
            
        # STEP 2: STUDY ENGINE 
        if USE_MOCK_STUDY_GUIDE:
            print("🟢 MOCK MODE: Loading Study Guides from local cache...")
            await asyncio.sleep(0.5)
            with open("backend/master_study_guide.json", "r", encoding="utf-8") as f:
                master_study_data = json.load(f)
        else:
            print("2️⃣ LIVE MODE: Generating Study Guides with AI...")
            master_study_data = await generate_all_study_guides()
            
        # STEP 3: RETURN PAYLOAD
        return {
            "status": "success",
            "curriculum": curriculum_data,
            "study_guides": master_study_data
        }
        
    except Exception as e:
        print(f"❌ Server Error during pipeline execution: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- YOUR ISOLATED TESTING ENDPOINTS ---
@app.post("/api/curriculum")
async def create_curriculum_standalone(request: TopicRequest):
    if USE_MOCK_LLM or USE_MOCK_CURRICULUM:
        print("🟢 MOCK MODE: Returning current_curriculum.json")
        await asyncio.sleep(0.5)
        with open("current_curriculum.json", "r", encoding="utf-8") as f:
            return json.load(f)
            
    print(f"⚡ LIVE MODE: Generating standalone curriculum for '{request.topic}'")
    try:
        return generate_curriculum(request.topic)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate")
async def create_study_guides_standalone():
    if USE_MOCK_LLM or USE_MOCK_STUDY_GUIDE:
        print("🟢 MOCK MODE: Returning master_study_guide.json")
        await asyncio.sleep(0.5)
        with open("master_study_guide.json", "r", encoding="utf-8") as f:
            return json.load(f)
            
    print("⚡ LIVE MODE: Triggering concurrent Study Guide generation...")
    try:
        return await generate_all_study_guides()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# 6. MOUNT FRONTEND (MUST BE THE VERY LAST ROUTE)
# ============================================================
# This serves all your HTML, CSS, and JS files from the /web folder.
# By setting html=True, going to localhost:8000 automatically loads index.html
app.mount("/", StaticFiles(directory="web", html=True), name="web")

if __name__ == "__main__":
    print("🚀 Booting up Bloom Master Server...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)