"use strict";

/* ============================================================
   exam.js — every call the exam makes to the backend.

   The backend is stateless: we send it a JSON object, it sends one back.
   Everything it needs travels in the request; nothing is kept on the server.

   1. request_next_question(request) -> a question object
        The page sends { curriculum, skill_mastery, past_questions, tier }.
        We translate that into the backend's /api/question shape (each skill with
        its current P(L)), call it, and normalise the reply for the page.

   2. request_grade(request) -> { is_correct, p_l_new, feedback }
        The page sends the whole question plus the user's answer and the skill's
        current score. The backend grades it (MCQ deterministically, short/long
        with the grader model) and returns the skill's new BKT score.

   3. call_model(state) -> the whole Tier-3 defense conversation, one turn on.
   ============================================================ */


/* Same-origin: the frontend is served by the same FastAPI app as the API. */
const BACKEND_BASE_URL = "";


/* ---- Tier 1 / 2 ---------------------------------------------------------- */

/* Ask the backend for the next question for this subtopic. */
async function request_next_question(request) {
  const curriculum = request.curriculum;          // raw subtopic { subtopic, skills:[...], capstone }
  const skill_mastery = request.skill_mastery;    // { skill name -> P(L) }

  // Build the skills array the backend needs: each skill with its current P(L).
  const skills = curriculum.skills.map(function (skill) {
    return {
      skill: skill.skill,
      tier_1: skill.tier_1,
      tier_2: skill.tier_2,
      p_l: skill_mastery[skill.skill]
    };
  });

  // The questions already asked this session, so the generator avoids repeats.
  const past_questions = request.past_questions || [];
  const asked = past_questions.map(function (past_question) {
    return past_question.question;
  });

  const body = {
    tier: request.tier,
    subtopic: curriculum,
    skills: skills,
    asked: asked,
    study: request.study || {}
  };

  const response = await fetch(BACKEND_BASE_URL + "/api/question", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error("Backend /api/question returned HTTP " + response.status);
  }

  const backend_question = await response.json();

  // Normalise to the shape the exam page renders from. The backend calls the
  // type field "type"; the page uses "question_type".
  return {
    skill: backend_question.skill,
    tier: backend_question.tier,
    question_type: backend_question.type,
    question: backend_question.question,
    criterion: backend_question.criterion,
    options: backend_question.options || [],
    correct_index: backend_question.correct_index,
    expected_answer: backend_question.expected_answer || ""
  };
}


/* Send the learner's answer to the grader; get back the verdict and new score. */
async function request_grade(request) {

  // Rebuild the exact question payload the backend expects.
  let correct_index = -1;
  if (typeof request.correct_index === "number") {
    correct_index = request.correct_index;
  }

  const question_payload = {
    skill: request.skill,
    tier: request.tier,
    type: request.question_type,
    criterion: request.criterion,
    question: request.question,
    options: request.options || [],
    correct_index: correct_index,
    expected_answer: request.expected_answer || ""
  };

  const body = {
    question: question_payload,
    user_answer: String(request.user_answer),
    p_l: request.current_score
  };

  const response = await fetch(BACKEND_BASE_URL + "/api/grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error("Backend /api/grade returned HTTP " + response.status);
  }

  return await response.json();   // { is_correct, p_l_new, feedback }
}


/* ---- Tier 3 defense ------------------------------------------------------ */

/* Send the current conversation state to the examiner and get the next state
   back. The whole conversation is cached in sessionStorage per subtopic so
   re-entering the page reopens it without another backend call. */
async function call_model(state) {
  const subtopicIndex = new URLSearchParams(window.location.search).get('i') || '0';
  const cacheKey = `bloom_chat_state_${subtopicIndex}`;

  // If entering the page fresh with empty state, reopen the cached conversation.
  if (!state.user_input && (!state.messages || state.messages.length === 0)) {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      console.log("Loading cached chatbot session from memory (0 API calls)...");
      return JSON.parse(cached);
    }
  }

  const url = BACKEND_BASE_URL + "/call_model";

  const request_options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state)
  };

  const response = await fetch(url, request_options);

  if (!response.ok) {
    throw new Error("Backend /call_model returned HTTP " + response.status);
  }

  const next_state = await response.json();

  // Save the updated conversation to memory.
  sessionStorage.setItem(cacheKey, JSON.stringify(next_state));
  return next_state;
}
