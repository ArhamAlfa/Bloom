import random
from typing import List, cast

from pydantic import BaseModel, Field

from backend.shared.models import get_question_model


# ------------------------------------------------------------------
# Config
# ------------------------------------------------------------------
# Each tier lists its allowed question types in order [higher-guess, lower-guess].
# Tier 1 tests knowledge/comprehension; Tier 2 tests application/analysis.
QUESTION_TYPES_BY_TIER = {
    1: ["mcq", "short"],
    2: ["short", "long"],
}

# Once a skill's P(L) reaches this, we force the LOWER-guess question type so the
# final push to mastery cannot happen through lucky guessing.
ESCALATION_THRESHOLD = 0.6

# A skill at or above this P(L) is considered mastered and is not tested again.
MASTERY_THRESHOLD = 0.95

# Controls how sharply skill selection favours weaker skills. 1.0 is gentle;
# higher values hammer the weakest skill harder.
SELECTION_GAMMA = 1.0

# Appended to every generation prompt so questions render as real maths on the
# frontend (which turns $...$ LaTeX into sub/superscripts). Deliberately steers
# AWAY from backslash commands like \frac: those corrupt when the model emits
# JSON (\f is a JSON escape), and subscripts/superscripts cover what we need.
MATH_FORMAT_INSTRUCTION = (
    "Format any mathematical notation as inline LaTeX wrapped in single dollar signs. "
    "Use _ for subscripts and ^ for superscripts, and write fractions with a slash. "
    "For example: $V_g$, $r^2$, $g = -dV_g/dr$. Do not use LaTeX fraction commands."
)

# Stops the generator from writing questions that hand the student the answer.
NO_REVEAL_INSTRUCTION = (
    "Do NOT reveal, list, or hint at the answer inside the question itself. The "
    "student must supply it from their own knowledge."
)

# Prepended reasoning discipline: settle the correct answer FIRST, then build the
# question around it. This is what makes the generator self-consistent and catches
# it labelling a wrong option correct.
ANSWER_FIRST_INSTRUCTION = (
    "First work out the correct answer and why it is correct; only then write the "
    "question, and make sure everything you write is consistent with that answer."
)


# ------------------------------------------------------------------
# Structured output shapes the model must fill.
#
# `reasoning` is FIRST in each schema on purpose: structured output is filled top
# to bottom, so the model commits to the correct answer before writing the
# question. It is used only to steer generation and is not returned.
# ------------------------------------------------------------------
class MCQQuestion(BaseModel):
    reasoning: str = Field(
        description="FIRST, state the single correct answer to the question you will "
        "write and briefly why it is correct — before writing anything else."
    )
    question: str = Field(description="The question stem. Must NOT contain or hint at the answer.")
    options: List[str] = Field(description="Exactly four answer options.")
    correct_index: int = Field(
        description="0-based index of the single correct option. It MUST match the "
        "answer named in reasoning."
    )


class OpenQuestion(BaseModel):
    reasoning: str = Field(
        description="FIRST, work out the model answer and briefly why — before writing "
        "the question."
    )
    question: str = Field(description="The question stem, answerable in prose. Must NOT contain or hint at the answer.")
    expected_answer: str = Field(
        description="A concise model answer that fully satisfies the skill criterion. "
        "Used only for grading; never shown to the student."
    )


# ------------------------------------------------------------------
# Skill selection
# ------------------------------------------------------------------
def select_skill(skills: List[dict]) -> dict:
    """
    Choose which skill to test next. Skills already at mastery are excluded, and
    among the rest each is weighted by how far it still is from mastery, so weak
    skills are favoured while stronger ones remain possible.
    """
    # Only skills that are not yet mastered are candidates.
    candidate_skills = []
    for skill in skills:
        if skill["p_l"] < MASTERY_THRESHOLD:
            candidate_skills.append(skill)

    # Safety: if every skill is already mastered, fall back to the whole list.
    if not candidate_skills:
        candidate_skills = list(skills)

    # Weight each candidate by its distance from mastery, raised to GAMMA.
    weights = []
    for skill in candidate_skills:
        distance_from_mastery = 1.0 - skill["p_l"]
        weight = distance_from_mastery ** SELECTION_GAMMA
        weights.append(weight)

    # Safety: if all weights collapsed to zero, weight everything equally.
    total_weight = sum(weights)
    if total_weight <= 0.0:
        weights = [1.0 for _ in candidate_skills]

    chosen_skill = random.choices(candidate_skills, weights=weights, k=1)[0]
    return chosen_skill


# ------------------------------------------------------------------
# Question-type selection (the anti-guess escalation)
# ------------------------------------------------------------------
def choose_question_type(tier: int, p_l: float) -> str:
    """
    Pick the question type for this attempt. Early on (low P(L)) either of the
    tier's types is allowed. Once the skill nears mastery, force the lower-guess
    type so mastery cannot be reached by guessing.
    """
    allowed_types = QUESTION_TYPES_BY_TIER[tier]
    lower_guess_type = allowed_types[1]

    if p_l >= ESCALATION_THRESHOLD:
        return lower_guess_type

    return random.choice(allowed_types)


# ------------------------------------------------------------------
# Generation
# ------------------------------------------------------------------
def _build_avoid_block(asked: List[str]) -> str:
    """Turn the list of already-asked questions into a 'do not repeat' block."""
    if not asked:
        return ""

    lines = []
    for question_text in asked:
        lines.append("- " + question_text)
    joined_lines = "\n".join(lines)

    return (
        "\n\nDo NOT repeat or lightly reword any of these already-asked questions:\n"
        + joined_lines
    )


# How much study text to feed the generator. Bounds the context so a big study
# guide doesn't blow up latency on a local model — a tunable dial.
STUDY_CONTEXT_MAX_CHARS = 4000


def _build_study_context(study: dict) -> str:
    """
    Condense a subtopic's study guide into a bounded block of context so the
    generator can ground its questions in the actual lesson (genre, setting,
    specific facts) instead of only paraphrasing the one-line skill metric.

    Pulls the intro plus each section's heading and tier bodies, then truncates.
    """
    if not study:
        return ""

    parts = []

    intro = study.get("intro") or {}
    if intro.get("body"):
        parts.append(intro["body"])

    for section in study.get("sections", []):
        heading = section.get("heading")
        if heading:
            parts.append(heading)

        tier_1 = section.get("tier_1") or {}
        if tier_1.get("body"):
            parts.append(tier_1["body"])

        tier_2 = section.get("tier_2") or {}
        if tier_2.get("body"):
            parts.append(tier_2["body"])

    text = "\n\n".join(parts)
    if len(text) > STUDY_CONTEXT_MAX_CHARS:
        text = text[:STUDY_CONTEXT_MAX_CHARS]

    if not text:
        return ""

    return (
        "\n\nBase your question on the following study material the student has "
        "learned. Draw on its specific facts and ideas — do NOT merely restate the "
        "skill:\n\"\"\"\n" + text + "\n\"\"\""
    )


def _generate_mcq(subtopic_name: str, skill_name: str, criterion: str, asked: List[str], study_context: str) -> dict:
    llm = get_question_model()
    structured_llm = llm.with_structured_output(MCQQuestion)

    prompt = (
        "You are an examiner writing ONE multiple-choice question to test a student's "
        "mastery of a specific skill.\n"
        f"Subtopic: {subtopic_name}\n"
        f"Skill: {skill_name}\n"
        f"What mastery looks like at this level: {criterion}\n\n"
        + ANSWER_FIRST_INSTRUCTION + "\n"
        "Write a single, focused multiple-choice question that tests exactly this skill "
        "at this level.\n"
        "Provide exactly FOUR options. Exactly ONE must be correct, and the other three "
        "must be plausible but wrong.\n"
        "Set correct_index to the 0-based position of the correct option.\n"
        + NO_REVEAL_INSTRUCTION + "\n"
        + MATH_FORMAT_INSTRUCTION
        + study_context
        + _build_avoid_block(asked)
    )

    raw_result = structured_llm.invoke(prompt)
    result = cast(MCQQuestion, raw_result)

    return {
        "question": result.question,
        "options": result.options,
        "correct_index": result.correct_index,
    }


def _generate_open(subtopic_name: str, skill_name: str, criterion: str, question_type: str, asked: List[str], study_context: str) -> dict:
    llm = get_question_model()
    structured_llm = llm.with_structured_output(OpenQuestion)

    if question_type == "short":
        length_instruction = "a SHORT-ANSWER question answerable in one or two sentences"
    else:
        length_instruction = "a LONG-ANSWER question requiring a paragraph-length, multi-step explanation"

    prompt = (
        f"You are an examiner writing ONE {length_instruction} to test a student's mastery "
        "of a specific skill.\n"
        f"Subtopic: {subtopic_name}\n"
        f"Skill: {skill_name}\n"
        f"What mastery looks like at this level: {criterion}\n\n"
        + ANSWER_FIRST_INSTRUCTION + "\n"
        "Write a single, focused question that tests exactly this skill at this level, "
        "and provide the model answer in expected_answer.\n"
        + NO_REVEAL_INSTRUCTION + "\n"
        + MATH_FORMAT_INSTRUCTION
        + study_context
        + _build_avoid_block(asked)
    )

    raw_result = structured_llm.invoke(prompt)
    result = cast(OpenQuestion, raw_result)

    return {
        "question": result.question,
        "expected_answer": result.expected_answer,
    }


def generate_question(tier: int, subtopic: dict, skills: List[dict], asked: List[str] = None, study: dict = None) -> dict:
    """
    Generate the next exam question for a subtopic at a given tier.

    Stateless: the caller passes every skill with its current P(L) and the list of
    questions already asked this session. This picks a skill (weighted toward weak
    ones), picks a question type (escalating away from guessable types near
    mastery), and generates a question that avoids repeats. Nothing is stored.

    Returns the payload the frontend caches and echoes back when grading:
        { skill, tier, type, criterion, question, options, correct_index, expected_answer }
    For open-response questions, options is [] and correct_index is -1, and
    expected_answer carries the model answer the grader checks the student against.
    For MCQ, expected_answer is "" (the correct option index is the answer).
    """
    if asked is None:
        asked = []
    if study is None:
        study = {}

    chosen_skill = select_skill(skills)
    p_l = chosen_skill["p_l"]
    question_type = choose_question_type(tier, p_l)

    # The criterion describes what mastery of this skill looks like at this tier.
    if tier == 1:
        criterion = chosen_skill["tier_1"]
    else:
        criterion = chosen_skill["tier_2"]

    subtopic_name = subtopic.get("subtopic") or subtopic.get("name") or "this subtopic"

    # Condensed lesson text so questions are grounded in what the student studied.
    study_context = _build_study_context(study)

    if question_type == "mcq":
        question_data = _generate_mcq(subtopic_name, chosen_skill["skill"], criterion, asked, study_context)
    else:
        question_data = _generate_open(subtopic_name, chosen_skill["skill"], criterion, question_type, asked, study_context)

    payload = {
        "skill": chosen_skill["skill"],
        "tier": tier,
        "type": question_type,
        "criterion": criterion,
        "question": question_data["question"],
        "options": question_data.get("options", []),
        "correct_index": question_data.get("correct_index", -1),
        "expected_answer": question_data.get("expected_answer", ""),
    }
    return payload
