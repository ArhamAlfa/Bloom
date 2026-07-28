import time
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, BaseMessage, SystemMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.prompt_values import PromptValue
from backend.shared.schemas import MessageSchema
from pydantic import BaseModel, Field
from typing import List, Tuple, Any, Dict, cast

llm = init_chat_model("ollama:qwen3-coder:30b", temperature=0.8)

# The judge is a separate job from the examiner: temperature 0 for a
# consistent verdict. A general instruction-tuned model tends to grade better
# than a code-specialised one, but any capable local model works.
judge_llm = init_chat_model("ollama:qwen3-coder:30b", temperature=0.0)

# The verdict shape. with_structured_output forces the model to fill exactly
# these fields.
#
# The judge does NOT grade the student — the EXAMINER is the authority on that.
# The judge only reads the examiner's latest message and classifies whether the
# examiner has concluded the defense and granted a pass.
#
# Field ORDER matters: structured output fills the fields top to bottom, so
# `reasoning` comes FIRST to make the model actually interpret the message
# before it commits to a verdict.
class DefenseVerdict(BaseModel):
    reasoning: str = Field(
        description="Interpret the EXAMINER's latest message: is it concluding "
        "the defense and granting a pass, or is it still challenging the student? "
        "Write this BEFORE deciding is_passed."
    )
    is_passed: bool = Field(
        description="The final decision, and it MUST match the reasoning above. "
        "True ONLY when the examiner's message clearly concludes the defense and "
        "grants the student a pass."
    )

verdict_judge = judge_llm.with_structured_output(DefenseVerdict)

JUDGE_SYSTEM = (
    "You read a single message written by an EXAMINER who is running a Socratic "
    "defense. Your ONLY job is to determine whether the examiner has CONCLUDED the "
    "defense and declared that the STUDENT has passed.\n"
    "Rules:\n"
    "- You are NOT grading the student. Do not evaluate the student's knowledge "
    "yourself. Judge only what the examiner's message signals.\n"
    "- is_passed is True ONLY if the examiner is clearly wrapping up and granting a "
    "pass / declaring the defense complete.\n"
    "- If the examiner asks any further question, poses a new challenge, or asks the "
    "student to go deeper, it has NOT concluded — is_passed is False, even if the "
    "message is full of praise.\n"
    "- Praise and compliments alone are NOT a pass; examiners routinely praise a "
    "point before pushing further.\n"
    "Write your reasoning about the examiner's intent first, then give is_passed."
)

def judge_defense(messages: List[Tuple[str, str]]) -> DefenseVerdict:
    # -----------------------------------------------------------------
    # TEMPORARY TEST HOOK — remove before real grading.
    #
    # If the student's most recent message contains this phrase, pass them
    # outright without asking the judge model. This lets us exercise the whole
    # pass path (metadata -> frontend -> mastery -> navigate) deterministically,
    # instead of hoping a model decides to pass us.
    PASS_TEST_PHRASE = "passtest"

    latest_user_text = ""
    for role, content in messages:
        if role == "user":
            latest_user_text = content

    if PASS_TEST_PHRASE in latest_user_text.lower():
        return DefenseVerdict(
            reasoning="[TEST] manual pass trigger via 'passtest'.",
            is_passed=True,
        )
    # -----------------------------------------------------------------

    # The pass decision hinges only on the EXAMINER's latest message: has the
    # examiner concluded the defense and granted a pass? So we hand the judge
    # exactly that message, and nothing else — the student's own turns are not
    # graded here.
    latest_examiner_message = ""
    for role, content in messages:
        if role == "ai":
            latest_examiner_message = content

    # No examiner turn yet (should not happen after seeding) — nothing to pass.
    if not latest_examiner_message.strip():
        return DefenseVerdict(
            reasoning="There is no examiner message to judge yet.",
            is_passed=False,
        )

    judge_messages = [
        ("system", JUDGE_SYSTEM),
        (
            "user",
            "EXAMINER's latest message:\n"
            "\"\"\"\n"
            f"{latest_examiner_message}\n"
            "\"\"\"\n\n"
            "Has the examiner concluded the defense and granted the student a pass?",
        ),
    ]

    # with_structured_output is typed as returning dict | BaseModel, so narrow
    # it back to our schema. The judge is bound to DefenseVerdict, so this is
    # the concrete type at runtime.
    raw_verdict = verdict_judge.invoke(judge_messages)
    verdict = cast(DefenseVerdict, raw_verdict)
    return verdict


# future function for dynamic model creation.
# for now we use hard-coded models since its easier.
def init_model():
    pass

def call_model(state: MessageSchema) -> MessageSchema:
    if not state.messages:
        init_model()

        # The topic the frontend opened. Fall back to a neutral phrase if it
        # sent nothing, so the examiner still has something to work with.
        topic = state.topic.strip()
        if not topic:
            topic = "the selected subtopic"

        # Build the two seed turns with the real topic interpolated in.
        system_prompt = (
            "You are BloomBot, a chatbot designed to test the understanding of a user on a given topic "
            "according to the upper two levels of blooms taxonomy (evaluation and synthesis). "
            "Prompt the user with something regarding the topic, and they will try to defend their stance. "
            "Your job will be to challenge them according to the aforementioned levels. "
            "Run a rigorous, multi-exchange defense and keep probing until you are genuinely convinced the "
            "student has demonstrated mastery at the evaluation and synthesis levels. "
            "YOU decide when the student passes. Only once you are fully convinced, CONCLUDE the defense: "
            "clearly congratulate the student and state that they have PASSED the defense — and in that same "
            "message do NOT ask any further question. As long as you still have any doubt, keep posing "
            "challenges and do NOT declare a pass. "
            f"The user's current topic is {topic}. Introduce yourself and provide him the prompt as well as core information."
        )

        kickoff_prompt = (
            f"[SYSTEM INIT]: Begin the interaction. Introduce yourself and ask the user if he wants the {topic} challenge."
        )

        state.messages = [
            ("system", system_prompt),
            ("user", kickoff_prompt),
        ]
    else:
        state.messages.append(("user", state.user_input))

    response = llm.invoke(state.messages)
    state.messages.append(("ai", str(response.content)))

    # Ask the separate judge whether the student has now passed. Its result is
    # a guaranteed boolean, so the frontend can read recent_metadata.is_passed
    # directly instead of scanning the chat text for a token.
    verdict = judge_defense(state.messages)

    # Print the verdict each turn so you can watch what the judge decides in the
    # server console while testing.
    print(f"[defense verdict] is_passed={verdict.is_passed} :: {verdict.reasoning}\n")

    state.recent_metadata = {
        "is_passed": verdict.is_passed,
        "reasoning": verdict.reasoning,
    }

    return state

if __name__ == "__main__":
    # Initial API call

    # Assume this is an incoming API call as a JSON object
    call = {
        "user_input": "",
        "messages": [],
        "metadata": {}
    }

    # What the frontend should be holding
    frontend_memory = call_model(MessageSchema(**call))

    while(True):
        # Loop and display from frontend memory
        latest_user, latest_message = frontend_memory.messages[-1]
        print(f"[{latest_user}]: ", end="")

        for char in latest_message:
            print(char, end="", flush=True)
            time.sleep(0.005)

        print("\n")
        # Frontend user input
        user_input = input("\033[44m[user]: ")
        print("\033[0m")

        # Emulated API Call
        call["user_input"] = user_input
        call["messages"] = frontend_memory.messages
        call["metadata"] = frontend_memory.recent_metadata

        frontend_memory = call_model(MessageSchema(**call))