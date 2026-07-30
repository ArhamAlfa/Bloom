import os
import json
import asyncio
from typing import List

from pydantic import BaseModel, Field

from backend.shared.models import get_study_model


# ------------------------------------------------------------------
# Structured output schema.
#
# The model returns a typed object matching this shape, and the provider handles
# all JSON string escaping itself. That is what removes the whole class of
# "invalid json output" failures we used to hit on LaTeX-heavy content (\frac,
# \vec, etc. are illegal JSON escapes when the model hand-writes them).
# ------------------------------------------------------------------
class FurtherReading(BaseModel):
    title: str
    url: str


class TierContent(BaseModel):
    body: str = Field(description="Markdown body with LaTeX ($...$ inline, $$...$$ display).")
    further_reading: List[FurtherReading] = Field(
        default_factory=list,
        description="At least two real, high-quality external resources.",
    )


class StudySection(BaseModel):
    heading: str
    tier_1: TierContent = Field(description="Knowledge & comprehension level content.")
    tier_2: TierContent = Field(description="Application & analysis level content.")


class StudyIntro(BaseModel):
    heading: str
    body: str = Field(description="Markdown overview of the subtopic.")


class StudyCapstone(BaseModel):
    heading: str
    body: str = Field(description="A text-based, digital-friendly synthesis task.")
    further_reading: List[FurtherReading] = Field(default_factory=list)


class StudyGuide(BaseModel):
    subtopic: str
    intro: StudyIntro
    sections: List[StudySection] = Field(description="Between 5 and 6 substantial, detailed sections.")
    capstone: StudyCapstone


STUDY_PROMPT_TEMPLATE = """You are an expert tutor. Generate a comprehensive study guide for this subtopic skeleton:
{subtopic_data}

Requirements:
- Write all educational text in Markdown. Use $ for inline LaTeX and $$ for display equations, and use formal LaTeX for every formula (for example $$E = mc^2$$).
- Produce between 5 and 6 substantial, highly detailed sections. Each section has a Tier 1 body (knowledge and comprehension) and a Tier 2 body (application and analysis). Do not compress the material.
- Every section and the capstone must include a further_reading list of at least two real, high-quality external resources (Khan Academy, Wikipedia, or similar authoritative platforms) with a valid title and url.
- The capstone must be a text-based, digital-friendly synthesis task, such as writing a summary, solving a theoretical problem, or drafting a short essay. Do not assign physical projects like posters, models, or lab experiments.
"""


async def generate_one_study_guide(subtopic: dict) -> dict:
    """
    Generate ONE subtopic's study guide.

    Stateless: the subtopic skeleton arrives as an argument, the finished guide is
    returned as a dict, and nothing is read from or written to disk. Uses native
    structured output, so the model never hand-writes JSON and the LaTeX-escaping
    parse failures cannot happen. The retry loop remains only for genuinely
    transient errors (rate limits, timeouts).

    On repeated failure it raises, so the caller can surface a clear error instead
    of storing an empty guide.
    """
    subtopic_name = subtopic.get("subtopic") or subtopic.get("name") or "Unknown subtopic"

    # The model is pulled from the central registry (cached), so which provider is
    # used is decided by STUDY_MODEL in .env, not here.
    llm = get_study_model()
    structured_llm = llm.with_structured_output(StudyGuide)

    prompt_text = STUDY_PROMPT_TEMPLATE.format(subtopic_data=json.dumps(subtopic))

    max_retries = 3
    backoff_seconds = 10
    last_error = None

    for attempt in range(1, max_retries + 1):
        try:
            print(f"Generating study guide for '{subtopic_name}' (attempt {attempt}/{max_retries})...")
            result = await structured_llm.ainvoke(prompt_text)

            # with_structured_output returns the pydantic model; hand back a dict.
            if isinstance(result, StudyGuide):
                study_guide = result.model_dump()
            else:
                study_guide = dict(result)

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
