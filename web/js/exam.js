"use strict";

/* ============================================================
   exam.js — every call the exam makes to the backend.

   The backend is stateless: we send it a JSON object, it sends one back.
   Everything it needs to know travels in the request.

   TO GO LIVE, change one marked line in each of the three functions below.

   1. request_next_question(request) -> a question object
        send:    { curriculum, skill_mastery, past_questions, tier }
        receive: { question, answer, question_type, tier, skill, options? }

   2. request_grade(request) -> a single number (the skill's new BKT score)
        send:    { ...the question object, user_answer, current_score }
        receive: 0.0 .. 1.0

   3. call_model(state) -> the whole conversation, one turn further on
        send:    { user_input, messages, recent_metadata }
                 messages = [ [ 'system' | 'user' | 'ai', content ], ... ]
        receive: the same shape, with the learner's turn and the examiner's
                 reply appended, and recent_metadata refreshed by the backend.

   The frontend never decides which skill to ask about, and never decides
   whether a defense is passed. The backend tells us both — the pass verdict
   arrives as recent_metadata.is_passed on the returned state.

   The defense call is the one endpoint that is already live: it talks to the
   FastAPI backend exactly the way fake-frontend.py does. Tiers 1 and 2 are
   still mocked below.
   ============================================================ */


/* Where the FastAPI backend is listening. Matches fake-frontend.py. */
const BACKEND_BASE_URL = "http://127.0.0.1:8000";


/* ---- The three API calls. Swap the marked line for a real fetch. ---- */

/* Ask the backend for the next question for this subtopic. */
async function request_next_question(request) {
  return mock_generate_question(request);                                  // ← swap this line
  // return fetch('/api/question', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(request) }).then(response => response.json());
}


/* Send the learner's answer to the grader; get back the skill's new BKT score. */
async function request_grade(request) {
  return mock_grade_answer(request);                                       // ← swap this line
  // return fetch('/api/grade', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(request) }).then(response => response.json());
}


/* Send the current conversation state to the examiner and get the next state
   back. This is the real call — it posts to the FastAPI backend the same way
   fake-frontend.py does, and returns the full MessageSchema the backend sends.

   `state` is { user_input, messages, recent_metadata }. The returned object has
   the learner's turn and the examiner's reply appended to `messages`, and a
   fresh `recent_metadata` (which carries the is_passed verdict). */
async function call_model(state) {
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
  return next_state;
}


/* ============================================================
   Everything below here is the fake backend. Delete it once the
   real endpoints exist.
   ============================================================ */


/* A few hand-written questions, looked up by the skill they target. Any skill
   without an entry falls back to a question built from its curriculum objective. */
const MOCK_QUESTIONS = {
  'g = F/m': { question_type: 'mcq', question: 'Gravitational field strength g is defined as…', options: ['F · m', 'F / m', 'm / F', 'G · M'], answer: 'F / m' },
  'g = GM/r²': { question_type: 'mcq', question: 'Double your distance from a point mass. Its field strength g becomes…', options: ['×2', '÷2', '÷4', '×4'], answer: '÷4' },
  "Newton's law of gravitation": { question_type: 'mcq', question: 'The force between two masses is proportional to…', options: ['r', '1/r', '1/r²', 'r²'], answer: '1/r²' },
  'E = F/q': { question_type: 'mcq', question: 'Electric field strength E is defined as…', options: ['F · q', 'q / F', 'F / q', 'k · Q'], answer: 'F / q' },
  "Coulomb's law": { question_type: 'mcq', question: 'The force between two point charges is proportional to…', options: ['1/r²', 'r²', '1/r', 'r'], answer: '1/r²' },
  'Scalar vs vector fields': { question_type: 'mcq', question: 'Which of these is a vector field?', options: ['Room temperature', 'A gravitational field', 'Air pressure', 'A mass distribution'], answer: 'A gravitational field' }
};


/* Pick the skill the learner is weakest at. A real BKT engine would use its
   own selection policy; this is a reasonable stand-in. */
function pick_weakest_skill(skill_mastery) {
  const skill_names = Object.keys(skill_mastery);

  let weakest_skill_name = skill_names[0];
  let lowest_score = skill_mastery[weakest_skill_name];

  skill_names.forEach(function (skill_name) {
    const score = skill_mastery[skill_name];

    if (score < lowest_score) {
      lowest_score = score;
      weakest_skill_name = skill_name;
    }
  });

  return weakest_skill_name;
}


/* Look up the curriculum objective for one skill at one tier, so a fallback
   question has something real to ask about. */
function find_objective(curriculum, skill_name, tier) {
  const matching_skill = curriculum.skills.find(function (skill) {
    return skill.skill === skill_name;
  });

  if (!matching_skill) {
    return 'Demonstrate this skill';
  }

  if (tier === 2) {
    return matching_skill.tier_2;
  }
  return matching_skill.tier_1;
}


/* The fake question generator. */
function mock_generate_question(request) {
  const skill_name = pick_weakest_skill(request.skill_mastery);
  const hand_written = MOCK_QUESTIONS[skill_name];

  // Use a hand-written question if we have one for this skill.
  if (hand_written) {
    return {
      question: hand_written.question,
      answer: hand_written.answer,
      question_type: hand_written.question_type,
      options: hand_written.options,
      tier: request.tier,
      skill: skill_name
    };
  }

  // Otherwise build one out of the curriculum objective.
  const objective = find_objective(request.curriculum, skill_name, request.tier);

  return {
    question: 'For "' + skill_name + '": ' + objective + '.',
    answer: '(model answer — the real generator would write one)',
    question_type: 'short',
    tier: request.tier,
    skill: skill_name
  };
}


/* One step of Bayesian Knowledge Tracing: given how confident we were that the
   learner knows this skill, and whether they just got it right, return the new
   confidence. */
function bkt_update(current_score, was_correct) {
  const P_SLIP = 0.10;    // knows it but answers wrong
  const P_GUESS = 0.20;   // does not know it but answers right
  const P_LEARN = 0.15;   // chance of learning it from this attempt

  let posterior = 0;

  if (was_correct) {
    const correct_and_knows = current_score * (1 - P_SLIP);
    const correct_and_guessed = (1 - current_score) * P_GUESS;
    posterior = correct_and_knows / (correct_and_knows + correct_and_guessed);
  } else {
    const wrong_but_knows = current_score * P_SLIP;
    const wrong_and_does_not_know = (1 - current_score) * (1 - P_GUESS);
    posterior = wrong_but_knows / (wrong_but_knows + wrong_and_does_not_know);
  }

  // They may also have just learned it from this attempt.
  return posterior + (1 - posterior) * P_LEARN;
}


/* The fake grader. A real one would work out correctness from `user_answer`
   itself; the mock is simply told, because a human steers the grade by hand
   in this demo (the "Mark correct / Mark incorrect" buttons). */
function mock_grade_answer(request) {
  return bkt_update(request.current_score, request.was_correct === true);
}

/* The Tier-3 examiner is no longer mocked — it is the live call_model() above. */
