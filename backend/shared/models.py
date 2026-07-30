"""
Central model registry for Bloom.

Every LLM used anywhere in the backend is constructed here, and nowhere else.
There are two reasons for this:

  1. One place to swap models. Each role reads its model string from an
     environment variable, so changing a model never touches engine code.

  2. Lazy construction. Models are built on first use, not at import time. So
     importing this module never forces a connection to a provider you are not
     using in a given request, and a missing Ollama daemon or API key can no
     longer crash the whole server at boot.

The provider is chosen by the model-string prefix, which LangChain's
init_chat_model understands directly:

    "ollama:qwen3-coder:30b"
    "google_genai:gemini-2.5-flash"
    "openai:gpt-4o-mini"
    "anthropic:claude-sonnet-4"
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from langchain.chat_models import init_chat_model


# ------------------------------------------------------------------
# Environment.
#
# Load the repository-root .env exactly once, at import time. The path is
# resolved from THIS file, not from the current working directory, so it loads
# correctly no matter where uvicorn is launched from.
#
#   backend/shared/models.py  ->  parent = shared
#                             ->  parent = backend
#                             ->  parent = repo root
# ------------------------------------------------------------------
THIS_FILE = Path(__file__).resolve()
REPO_ROOT = THIS_FILE.parent.parent.parent
ENV_PATH = REPO_ROOT / ".env"
load_dotenv(dotenv_path=ENV_PATH)


# ------------------------------------------------------------------
# Defaults.
#
# Each of these is used only when the matching environment variable is not set.
# ------------------------------------------------------------------
DEFAULT_EXAMINER_MODEL = "ollama:qwen3-coder:30b"
DEFAULT_JUDGE_MODEL = "ollama:qwen3-coder:30b"
DEFAULT_CURRICULUM_MODEL = "google_genai:gemini-2.5-flash"
DEFAULT_STUDY_MODEL = "google_genai:gemini-2.5-flash"

# The Tier 1/2 exam pair default to the local Ollama model so the exam runs with
# no API keys during development. Swap them (like everything else) via env vars.
DEFAULT_QUESTION_MODEL = "ollama:qwen3-coder:30b"
DEFAULT_GRADER_MODEL = "ollama:qwen3-coder:30b"


# ------------------------------------------------------------------
# Cache.
#
# Each model is built once and then reused. The cache starts empty and is
# filled lazily by the getter functions below.
# ------------------------------------------------------------------
_model_cache = {}


def _build_and_cache_model(role_name, model_string, temperature):
    """
    Construct one chat model, store it under role_name, and return it.

    Deliberately small: build, cache, return. Every getter funnels through here
    so there is exactly one place that calls init_chat_model.
    """
    model = init_chat_model(model_string, temperature=temperature)
    _model_cache[role_name] = model
    return model


def get_examiner():
    """
    The Tier 3 defense examiner. A higher temperature gives it varied, less
    repetitive questioning.
    """
    cached_model = _model_cache.get("examiner")
    if cached_model is not None:
        return cached_model

    model_string = os.environ.get("EXAMINER_MODEL", DEFAULT_EXAMINER_MODEL)
    temperature = 0.8
    return _build_and_cache_model("examiner", model_string, temperature)


def get_judge():
    """
    The pass/fail verdict model. Temperature 0 keeps the decision consistent
    across identical inputs.
    """
    cached_model = _model_cache.get("judge")
    if cached_model is not None:
        return cached_model

    model_string = os.environ.get("JUDGE_MODEL", DEFAULT_JUDGE_MODEL)
    temperature = 0.0
    return _build_and_cache_model("judge", model_string, temperature)


def get_curriculum_model():
    """
    Generates the curriculum skeleton (subtopics and skills) from a topic.
    Temperature 0 for a stable, well-structured breakdown.
    """
    cached_model = _model_cache.get("curriculum")
    if cached_model is not None:
        return cached_model

    model_string = os.environ.get("CURRICULUM_MODEL", DEFAULT_CURRICULUM_MODEL)
    temperature = 0.0
    return _build_and_cache_model("curriculum", model_string, temperature)


def get_study_model():
    """
    Generates one subtopic's study guide. A little temperature helps the prose
    read naturally without wandering off the curriculum skeleton.
    """
    cached_model = _model_cache.get("study")
    if cached_model is not None:
        return cached_model

    model_string = os.environ.get("STUDY_MODEL", DEFAULT_STUDY_MODEL)
    temperature = 0.2
    return _build_and_cache_model("study", model_string, temperature)


def get_question_model():
    """
    Generates Tier 1/2 exam questions. A little temperature keeps the phrasing
    varied so repeated questions on a skill don't feel identical.
    """
    cached_model = _model_cache.get("question")
    if cached_model is not None:
        return cached_model

    model_string = os.environ.get("QUESTION_MODEL", DEFAULT_QUESTION_MODEL)
    temperature = 0.7
    return _build_and_cache_model("question", model_string, temperature)


def get_grader_model():
    """
    Grades short/long exam answers. Temperature 0 for a consistent correct /
    incorrect verdict on the same answer.
    """
    cached_model = _model_cache.get("grader")
    if cached_model is not None:
        return cached_model

    model_string = os.environ.get("GRADER_MODEL", DEFAULT_GRADER_MODEL)
    temperature = 0.0
    return _build_and_cache_model("grader", model_string, temperature)
