import os
import json
import asyncio

from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from backend.shared.models import get_study_model


def _build_study_prompt() -> PromptTemplate:
    """
    Build the study-guide prompt.

    The reference schema is a checked-in, read-only asset in project_dictionary.
    Reading it is NOT request state — it is a fixed contract the model output must
    match. It is injected as a partial variable so the only per-call input is the
    subtopic skeleton.
    """
    reference_schema_path = os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        "project_dictionary",
        "study_engine_subtopic_output.json",
    )
    with open(reference_schema_path, "r", encoding="utf-8") as schema_file:
        reference_schema_string = schema_file.read()

    template = """You are an expert tutor. Generate a comprehensive markdown study guide based strictly on this curriculum skeleton:
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
        """

    # Only subtopic_data varies per call; reference_schema is fixed via partial.
    prompt = PromptTemplate(
        template=template,
        input_variables=["subtopic_data"],
        partial_variables={"reference_schema": reference_schema_string},
    )
    return prompt


async def generate_one_study_guide(subtopic: dict) -> dict:
    """
    Generate ONE subtopic's study guide.

    Stateless: the subtopic skeleton arrives as an argument, the finished guide is
    returned as a dict, and nothing is read from or written to disk except the
    read-only reference schema. This is the single unit the /api/study endpoint
    calls — one subtopic per request, so there is no fan-out and no concurrency
    throttle to manage here.

    On repeated failure it raises, so the caller can surface a clear error instead
    of storing an empty guide.
    """
    subtopic_name = subtopic.get("subtopic") or subtopic.get("name") or "Unknown subtopic"

    # The model is pulled from the central registry (cached), so which provider is
    # used is decided by STUDY_MODEL in .env, not here.
    llm = get_study_model()
    parser = JsonOutputParser()
    prompt = _build_study_prompt()
    chain = prompt | llm | parser

    subtopic_json = json.dumps(subtopic)

    max_retries = 3
    backoff_seconds = 10
    last_error = None

    for attempt in range(1, max_retries + 1):
        try:
            print(f"Generating study guide for '{subtopic_name}' (attempt {attempt}/{max_retries})...")
            study_guide = await chain.ainvoke({"subtopic_data": subtopic_json})
            print(f"Finished study guide for '{subtopic_name}'.")
            return study_guide
        except Exception as error:
            last_error = error
            print(f"'{subtopic_name}' attempt {attempt} failed: {error}")
            if attempt < max_retries:
                print(f"Backing off {backoff_seconds}s before retry...")
                await asyncio.sleep(backoff_seconds)

    # Every retry has been exhausted. Raise so the endpoint returns a real error.
    raise RuntimeError(f"Study-guide generation failed for '{subtopic_name}': {last_error}")


async def generate_all_study_guides(curriculum: dict) -> dict:
    """
    Convenience / debug helper: generate guides for every subtopic in a
    curriculum, sequentially.

    Stateless: the curriculum comes in as an argument, the merged result goes back
    out, and nothing is written to disk. The lazy /api/study endpoint does NOT use
    this — it calls generate_one_study_guide per subtopic. This exists for one-shot
    or manual batch runs. One failed subtopic is skipped rather than aborting the
    whole batch.
    """
    subtopics = curriculum.get("subtopics", [])
    study_guides = []

    for subtopic in subtopics:
        try:
            guide = await generate_one_study_guide(subtopic)
            study_guides.append(guide)
        except Exception as error:
            subtopic_name = subtopic.get("subtopic") or subtopic.get("name") or "Unknown subtopic"
            print(f"Skipping '{subtopic_name}': {error}")

    master_json = {
        "course": curriculum.get("topic", "Generated Course"),
        "study_guides": study_guides,
    }
    return master_json


if __name__ == "__main__":
    # Manual test runner. Loads the sample curriculum and generates guides for it.
    # NOTE: this makes real model calls and costs tokens.
    sample_path = os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        "project_dictionary",
        "curriculum_engine_expected_output.json",
    )
    with open(sample_path, "r", encoding="utf-8") as sample_file:
        sample_curriculum = json.load(sample_file)

    result = asyncio.run(generate_all_study_guides(sample_curriculum))
    print(f"Generated {len(result['study_guides'])} study guides.")
