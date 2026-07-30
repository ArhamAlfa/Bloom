import os
import json
import time
from typing import List

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# ------------------------------------------------------------------
# Engine imports
# ------------------------------------------------------------------
# Tier 3 defense chatbot
from backend.exam.defense_chatbot import call_model
from backend.shared.schemas import MessageSchema

# Tier 1/2 exam engine (Bayesian Knowledge Tracing)
from backend.exam.question_generator import generate_question
from backend.exam.question_assessor import assess

# Curriculum + study engines
from backend.curriculum_study_engine.curriculum import generate_curriculum
from backend.curriculum_study_engine.study_guide import generate_one_study_guide


# ------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------
# When USE_MOCK is on, the curriculum and study endpoints return the checked-in
# project_dictionary fixtures instead of calling a model. Those fixtures are
# read-only sample assets, so mock mode is still fully stateless — it just lets
# you build and click through the whole frontend without spending tokens or
# needing any API keys. Flip it with USE_MOCK=true in .env.
USE_MOCK = os.environ.get("USE_MOCK", "false").lower() == "true"

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
FIXTURE_CURRICULUM = os.path.join(PROJECT_ROOT, "project_dictionary", "curriculum_engine_expected_output.json")
FIXTURE_STUDY = os.path.join(PROJECT_ROOT, "project_dictionary", "study_engine_subtopic_output.json")
WEB_DIR = os.path.join(PROJECT_ROOT, "web")


app = FastAPI(title="Bloom API")

# Permissive CORS: the static frontend and the API are served from the same
# origin here, but this keeps local development friction-free.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------
# Request bodies
# ------------------------------------------------------------------
class TopicRequest(BaseModel):
    topic: str


class StudyRequest(BaseModel):
    subtopic: dict


def _load_fixture(fixture_path: str) -> dict:
    with open(fixture_path, "r", encoding="utf-8") as fixture_file:
        return json.load(fixture_file)


# ------------------------------------------------------------------
# Retry with backoff for transient model errors (free-tier rate limits).
#
# Free LLM tiers throttle with 429s and occasional 503s. The exam endpoints make
# a live model call per question/answer, so a burst can trip a limit mid-session.
# We retry ONLY on errors that look transient, so genuine bugs still fail fast.
# ------------------------------------------------------------------
TRANSIENT_ERROR_MARKERS = ("429", "rate", "quota", "overload", "503", "timeout", "unavailable", "too many")


def _looks_transient(error) -> bool:
    error_text = str(error).lower()
    for marker in TRANSIENT_ERROR_MARKERS:
        if marker in error_text:
            return True
    return False


def _call_with_retry(func, *args, max_attempts=4, base_delay=2.0):
    """
    Call func(*args), retrying on transient errors with a growing backoff.
    Non-transient errors (real bugs) are raised immediately, not retried.
    """
    attempt = 1
    while True:
        try:
            return func(*args)
        except Exception as error:
            if attempt >= max_attempts or not _looks_transient(error):
                raise

            delay_seconds = base_delay * attempt
            print(f"Transient model error (attempt {attempt}/{max_attempts}) — backing off {delay_seconds}s: {error}")
            time.sleep(delay_seconds)
            attempt = attempt + 1


# ------------------------------------------------------------------
# Health
# ------------------------------------------------------------------
@app.get("/api/health")
def health():
    return {"status": "ok"}


# ------------------------------------------------------------------
# Tier 3 defense chatbot.
# Stateless: the full conversation state arrives in the request and the updated
# state is returned. The server holds nothing between calls.
# ------------------------------------------------------------------
@app.post("/call_model")
def defense_chatbot(state: MessageSchema) -> MessageSchema:
    state = call_model(state)
    return state


# ------------------------------------------------------------------
# Build pathway (fast): a topic in, the curriculum skeleton out.
# Study guides are NOT generated here — they come later, lazily, one subtopic at
# a time via /api/study, so the user lands on the dashboard quickly.
# ------------------------------------------------------------------
@app.post("/api/build-pathway")
def build_pathway(request: TopicRequest):
    print(f"Pathway build requested for topic: '{request.topic}'")
    try:
        if USE_MOCK:
            print("MOCK: returning curriculum fixture.")
            curriculum = _load_fixture(FIXTURE_CURRICULUM)
        else:
            curriculum = generate_curriculum(request.topic)

        return {"status": "success", "curriculum": curriculum}

    except Exception as error:
        print(f"Curriculum generation failed: {error}")
        raise HTTPException(status_code=500, detail=str(error))


# ------------------------------------------------------------------
# Build study guide (lazy): one subtopic skeleton in, one study guide out.
# The frontend caches the result in sessionStorage and only calls this the first
# time a given subtopic is opened.
# ------------------------------------------------------------------
@app.post("/api/study")
async def build_study_guide(request: StudyRequest):
    subtopic_name = request.subtopic.get("subtopic") or request.subtopic.get("name") or "subtopic"
    print(f"Study guide requested for: '{subtopic_name}'")
    try:
        if USE_MOCK:
            print("MOCK: returning study fixture.")
            return _load_fixture(FIXTURE_STUDY)

        guide = await generate_one_study_guide(request.subtopic)
        return guide

    except Exception as error:
        print(f"Study guide generation failed: {error}")
        raise HTTPException(status_code=500, detail=str(error))


# ------------------------------------------------------------------
# Tier 1/2 exam (Bayesian Knowledge Tracing).
#
# Stateless: the frontend sends every skill with its current P(L). /api/question
# returns one question; /api/grade grades one answer and returns the updated P(L)
# for the single skill tested. The frontend owns the loop and decides mastery.
# ------------------------------------------------------------------
class SkillState(BaseModel):
    skill: str
    tier_1: str
    tier_2: str
    p_l: float


class QuestionRequest(BaseModel):
    tier: int
    subtopic: dict
    skills: List[SkillState]
    asked: List[str] = []
    study: dict = {}


class QuestionPayload(BaseModel):
    skill: str
    tier: int
    type: str
    criterion: str
    question: str
    options: List[str] = []
    correct_index: int = -1
    expected_answer: str = ""


class GradeRequest(BaseModel):
    question: QuestionPayload
    user_answer: str
    p_l: float


@app.post("/api/question")
def exam_question(request: QuestionRequest):
    skills = [skill.model_dump() for skill in request.skills]
    try:
        return _call_with_retry(generate_question, request.tier, request.subtopic, skills, request.asked, request.study)
    except Exception as error:
        print(f"Question generation failed: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@app.post("/api/grade")
def exam_grade(request: GradeRequest):
    question = request.question.model_dump()
    try:
        return _call_with_retry(assess, question, request.user_answer, request.p_l)
    except Exception as error:
        print(f"Grading failed: {error}")
        raise HTTPException(status_code=500, detail=str(error))


# ------------------------------------------------------------------
# Frontend static files.
# MUST be mounted last: a catch-all mount at "/" would otherwise shadow the API
# routes declared above.
# ------------------------------------------------------------------
app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")


if __name__ == "__main__":
    print("Starting Bloom server on http://0.0.0.0:8000 ...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
