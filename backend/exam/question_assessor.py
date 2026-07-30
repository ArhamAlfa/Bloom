from typing import cast

from pydantic import BaseModel, Field

from backend.shared.models import get_grader_model


# ------------------------------------------------------------------
# BKT parameters, chosen per question type.
#
#   guess (G):   chance of answering correctly WITHOUT knowing the skill.
#                MCQ is highest (you can pick the right option by luck).
#   slip  (S):   chance of answering incorrectly DESPITE knowing the skill.
#                Long answers slip a little more (careless / partial).
#   transit (T): chance the attempt itself teaches the skill.
# ------------------------------------------------------------------
BKT_PARAMS = {
    "mcq":   {"guess": 0.25, "slip": 0.10, "transit": 0.15},
    "short": {"guess": 0.10, "slip": 0.10, "transit": 0.15},
    "long":  {"guess": 0.05, "slip": 0.15, "transit": 0.15},
}


# The grader's verdict shape. reasoning comes FIRST so the model interprets the
# answer before committing to a verdict (the same pattern the defense judge uses).
class GradeVerdict(BaseModel):
    reasoning: str = Field(
        description="Explain whether the student's answer meets the criterion, "
        "written BEFORE deciding is_correct."
    )
    is_correct: bool = Field(
        description="True only if the answer clearly demonstrates the skill criterion."
    )


# ------------------------------------------------------------------
# The BKT update (closed form, one observation at a time).
# ------------------------------------------------------------------
def bkt_update(p_l, correct, guess, slip, transit):
    """
    Standard Bayesian Knowledge Tracing update.

    Step 1 conditions the current estimate on what we just observed (a correct or
    incorrect answer). Step 2 accounts for the chance the attempt taught the skill.
    """
    if correct:
        numerator = p_l * (1.0 - slip)
        denominator = p_l * (1.0 - slip) + (1.0 - p_l) * guess
    else:
        numerator = p_l * slip
        denominator = p_l * slip + (1.0 - p_l) * (1.0 - guess)

    # Guard against a divide-by-zero from degenerate parameters.
    if denominator <= 0.0:
        p_l_given_observation = p_l
    else:
        p_l_given_observation = numerator / denominator

    p_l_next = p_l_given_observation + (1.0 - p_l_given_observation) * transit
    return p_l_next


# ------------------------------------------------------------------
# Correctness, per question type.
# ------------------------------------------------------------------
def grade_mcq(correct_index, user_answer):
    """MCQ is deterministic: the selected option index must be the correct one."""
    try:
        selected_index = int(user_answer)
    except (TypeError, ValueError):
        return False

    return selected_index == correct_index


def judge_open_response(criterion, question, expected_answer, user_answer):
    """
    Grade a short or long answer with the LLM. Returns (is_correct, reasoning).

    The grader is anchored by a model answer (expected_answer) generated alongside
    the question, so it has a concrete reference instead of inventing its own bar.
    It judges whether the student got the GIST — the core understanding the
    criterion asks for — not whether they matched the model answer exactly.
    """
    llm = get_grader_model()
    structured_llm = llm.with_structured_output(GradeVerdict)

    # The expected answer may be empty on older/edge questions; only include it
    # when we actually have one.
    reference_block = ""
    if expected_answer and expected_answer.strip():
        reference_block = f"Model answer (a correct reference, for your judgement only):\n{expected_answer}\n\n"

    prompt = (
        "You are grading whether a student's answer demonstrates a specific skill.\n"
        f"The skill criterion (what a correct answer must show): {criterion}\n\n"
        f"Question:\n{question}\n\n"
        f"{reference_block}"
        f"Student's answer:\n{user_answer}\n\n"
        "Judge whether the student got the GIST — the core understanding the criterion "
        "asks for — using the model answer only as a reference for what 'correct' means. "
        "Do NOT require an exact match to the model answer, and do NOT invent extra "
        "requirements the criterion does not mention. Mark the answer correct when the "
        "core understanding is present; do NOT fail it for minor, pedantic, or stylistic "
        "issues (for example equivalent units, wording, notation, or small factual slips "
        "that don't undermine the main point). If it is genuinely borderline, mark it "
        "correct. Write your reasoning first, then give is_correct."
    )

    raw_verdict = structured_llm.invoke(prompt)
    verdict = cast(GradeVerdict, raw_verdict)
    return verdict.is_correct, verdict.reasoning


def _mcq_feedback(question):
    """A helpful message naming the right option after a wrong MCQ answer."""
    options = question.get("options", [])
    correct_index = question.get("correct_index", -1)

    if 0 <= correct_index < len(options):
        return "Incorrect. The correct answer was: " + options[correct_index]

    return "Incorrect."


# ------------------------------------------------------------------
# Assess one answer and move the skill's needle.
# ------------------------------------------------------------------
def assess(question, user_answer, p_l):
    """
    Grade one answer and apply BKT to the tested skill.

    Stateless: takes the question payload (from the generator), the student's
    answer, and that skill's current P(L); returns { is_correct, p_l_new,
    feedback }. The frontend overwrites the skill's score with p_l_new and decides
    whether the whole subtopic is now mastered.
    """
    question_type = question["type"]

    # 1. Determine correctness.
    if question_type == "mcq":
        is_correct = grade_mcq(question["correct_index"], user_answer)
        if is_correct:
            feedback = "Correct."
        else:
            feedback = _mcq_feedback(question)
    else:
        expected_answer = question.get("expected_answer", "")
        is_correct, feedback = judge_open_response(
            question["criterion"], question["question"], expected_answer, user_answer
        )

    # 2. Apply BKT with the parameters for this question type.
    params = BKT_PARAMS.get(question_type, BKT_PARAMS["short"])
    p_l_new = bkt_update(p_l, is_correct, params["guess"], params["slip"], params["transit"])

    return {
        "is_correct": is_correct,
        "p_l_new": p_l_new,
        "feedback": feedback,
    }
