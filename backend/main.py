from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
import asyncio

# Engine Imports from your custom module
from curriculum_study_engine.curriculum import generate_curriculum
from curriculum_study_engine.study_guide import generate_all_study_guides

# ============================================================
# ⚙️ CONFIGURATION TOGGLE
# Set to True  -> Instant offline mock responses (0 API calls/tokens)
# Set to False -> Live generation (OpenAI + Gemini)
# ============================================================
USE_MOCK_LLM = False

app = FastAPI()

# Enable CORS for local web server communication (e.g., port 3000 to port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TopicRequest(BaseModel):
    topic: str


# ============================================================
# ⚙️ CONFIGURATION TOGGLES (Granular Control)
# Set to True  -> Reads local JSON file (0 tokens used)
# Set to False -> Runs live API generation
# ============================================================
USE_MOCK_CURRICULUM = False   # Turns off OpenAI, reads current_curriculum.json
USE_MOCK_STUDY_GUIDE = False # Leaves Gemini ON to test concurrency fixes --> CURRENTLY USING OPENAI CUZ GEMINI IS A BUM

@app.post("/api/build-pathway")
async def build_full_pathway(request: TopicRequest):
    print(f"\n🌱 Pathway build requested for topic: '{request.topic}'")
    
    try:
        # ---------------------------------------------------------
        # STEP 1: CURRICULUM ENGINE (OpenAI)
        # ---------------------------------------------------------
        if USE_MOCK_CURRICULUM:
            print("🟢 MOCK MODE: Loading Curriculum from local cache (0 OpenAI tokens)...")
            await asyncio.sleep(0.5) # Simulate slight network delay
            with open("current_curriculum.json", "r", encoding="utf-8") as f:
                curriculum_data = json.load(f)
        else:
            print("1️⃣ LIVE MODE: Generating Curriculum with OpenAI...")
            curriculum_data = generate_curriculum(request.topic)
            
        # ---------------------------------------------------------
        # STEP 2: STUDY ENGINE (Gemini)
        # ---------------------------------------------------------
        if USE_MOCK_STUDY_GUIDE:
            print("🟢 MOCK MODE: Loading Study Guides from local cache (0 Gemini tokens)...")
            await asyncio.sleep(0.5)
            with open("master_study_guide.json", "r", encoding="utf-8") as f:
                master_study_data = json.load(f)
        else:
            print("2️⃣ LIVE MODE: Generating Study Guides with Gemini...")
            master_study_data = await generate_all_study_guides()
            
        # ---------------------------------------------------------
        # STEP 3: RETURN PAYLOAD
        # ---------------------------------------------------------
        return {
            "status": "success",
            "curriculum": curriculum_data,
            "study_guides": master_study_data
        }
        
    except Exception as e:
        print(f"❌ Server Error during pipeline execution: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# 🛠️ INDIVIDUAL ENDPOINTS (For isolated testing & legacy calls)
# ============================================================

@app.post("/api/curriculum")
async def create_curriculum_standalone(request: TopicRequest):
    if USE_MOCK_LLM:
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
    if USE_MOCK_LLM:
        print("🟢 MOCK MODE: Returning master_study_guide.json")
        await asyncio.sleep(0.5)
        with open("master_study_guide.json", "r", encoding="utf-8") as f:
            return json.load(f)
            
    print("⚡ LIVE MODE: Triggering concurrent Study Guide generation...")
    try:
        return await generate_all_study_guides()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))