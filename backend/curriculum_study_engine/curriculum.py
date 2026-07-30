from typing import List, Optional

from pydantic import BaseModel, Field

from backend.shared.models import get_curriculum_model


# ------------------------------------------------------------------
# Structured output schema.
#
# Native structured output means the model returns a typed object and the
# provider handles JSON serialisation, so there is no hand-written JSON to break
# (the same fix used in the study engine). The shape matches what the frontend
# renders against.
# ------------------------------------------------------------------
class Skill(BaseModel):
    skill: str = Field(description="A specific learning objective.")
    tier_1: str = Field(description="Knowledge & comprehension objective for this skill.")
    tier_2: str = Field(description="Application & analysis objective for this skill.")


class Subtopic(BaseModel):
    subtopic: str = Field(description="Name of the subtopic.")
    skills: List[Skill] = Field(description="The assessable skills for this subtopic.")
    capstone: Optional[str] = Field(
        default=None,
        description="A short synthesis/evaluation task for this subtopic, or null if it has none.",
    )


class Curriculum(BaseModel):
    topic: str = Field(description="The broad topic name.")
    user_query: str = Field(description="The learner's original request.")
    subtopics: List[Subtopic] = Field(description="3 to 5 subtopics that break down the topic.")


CURRICULUM_PROMPT_TEMPLATE = """You are an expert curriculum designer. Generate a comprehensive, structured curriculum for the topic: {topic}.

Break the topic into 3 to 5 subtopics. Each subtopic has a set of specific, assessable skills, and each skill has a Tier 1 objective (knowledge and comprehension) and a Tier 2 objective (application and analysis). Give each subtopic a short synthesis/evaluation capstone task, or leave it null if it does not need one.
"""


def generate_curriculum(topic_request: str) -> dict:
    """
    Generate the curriculum skeleton for a topic: subtopics, each with a list of
    skills, each skill carrying a tier_1 and tier_2 objective, plus a per-subtopic
    capstone.

    Stateless: the topic comes in, the curriculum goes back out as a dict, and
    nothing is written to disk. Uses native structured output, so there is no
    hand-written JSON that could fail to parse. Any failure raises, so the endpoint
    can turn it into a clean HTTP error instead of returning a fake curriculum.
    """
    print(f"Generating curriculum for: {topic_request}")

    # The model comes from the central registry, so which provider/model is used
    # is decided by CURRICULUM_MODEL in .env, not here.
    llm = get_curriculum_model()
    structured_llm = llm.with_structured_output(Curriculum)

    prompt_text = CURRICULUM_PROMPT_TEMPLATE.format(topic=topic_request)
    result = structured_llm.invoke(prompt_text)

    if isinstance(result, Curriculum):
        curriculum_data = result.model_dump()
    else:
        curriculum_data = dict(result)

    # Always record the learner's exact request, regardless of what the model put
    # in user_query — the frontend shows this back to them.
    curriculum_data["user_query"] = topic_request

    print("Curriculum generated.")
    return curriculum_data
