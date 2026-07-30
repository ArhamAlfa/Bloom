import json

from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from backend.shared.models import get_curriculum_model


def generate_curriculum(topic_request: str) -> dict:
    """
    Generate the curriculum skeleton for a topic: subtopics, each with a list of
    skills, each skill carrying a tier_1 and tier_2 objective, plus a per-subtopic
    capstone.

    Stateless: the topic comes in, the curriculum goes back out as a dict, and
    nothing is written to disk. Handing the result to the frontend is the caller's
    job (the /api/build-pathway endpoint). Any failure raises, so the endpoint can
    turn it into a clean HTTP error instead of returning a fake curriculum.
    """
    print(f"Generating curriculum for: {topic_request}")

    # The model comes from the central registry, so which provider/model is used
    # is decided by CURRICULUM_MODEL in .env, not here.
    llm = get_curriculum_model()
    parser = JsonOutputParser()

    # A strict, hardcoded output schema keeps the JSON shape stable for the
    # frontend, which renders directly against it.
    prompt = PromptTemplate(
        template="""You are an expert curriculum designer.
        Generate a comprehensive, structured curriculum for the topic: {topic}.

        You must output ONLY valid JSON that adheres strictly to this exact schema structure:
        {{
            "topic": "The broad topic name",
            "user_query": "{topic}",
            "subtopics": [
                {{
                    "subtopic": "Name of the subtopic",
                    "skills": [
                        {{
                            "skill": "Specific learning objective",
                            "tier_1": "Basic knowledge/comprehension description",
                            "tier_2": "Application/analysis description"
                        }}
                    ],
                    "capstone": "A short synthesis/evaluation task for this subtopic (a single string), or null if it has none"
                }}
            ]
        }}""",
        input_variables=["topic"],
    )

    # Prompt -> model -> JSON parser. The parser returns a clean Python dict.
    chain = prompt | llm | parser

    curriculum_data = chain.invoke({"topic": topic_request})
    print("Curriculum generated.")
    return curriculum_data
