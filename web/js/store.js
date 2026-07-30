"use strict";

/* ============================================================
   store.js — where the learner's PROGRESS is saved and loaded.

   A multi-page site forgets everything when we move between pages, so we keep
   progress in the browser's sessionStorage and read it back on each page.
   sessionStorage is the whole app's "database" for one visit: it survives
   page-to-page navigation and reloads, and is wiped only by the "New prompt"
   button (exit.html) or by starting a new topic (index.html). There is no
   server-side persistence — you load in, work, and finish.

       sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress));

   Mastery is tracked with Bayesian Knowledge Tracing: every skill holds a
   probability (0..1) that the learner knows it. A subtopic counts as mastered
   at a tier only once EVERY one of its skills is above MASTERY_THRESHOLD.
   There is no fixed number of questions.

   The shape of a saved "progress" object:

       {
         current_tier:          1,          // the tier being worked through (1..3)
         flower_stage:          0,          // how many tiers are fully cleared (0..3)
         next_tier_to_unlock:   null,       // set when a tier is cleared
         course_complete:       false,
         last_studied_subtopic: null,       // index, for the dashboard
         mastery: [                         // one entry per subtopic (same order as SUBTOPICS)
           {
             1: { skill_scores: { "g = F/m": 0.2, ... }, is_mastered: false },   // Tier 1
             2: { skill_scores: { ... },                 is_mastered: false },   // Tier 2
             3: { defense_result: 'none' }               // Tier 3: 'none' | 'passed' | 'sent-back'
           },
           ...
         ]
       }
   ============================================================ */


const STORAGE_KEY = 'bloom.progress';

/* A skill counts as mastered once BKT is this confident the learner knows it. */
const MASTERY_THRESHOLD = 0.95;

/* Every skill starts here. BKT needs a non-zero prior, otherwise the score
   can never rise no matter how many questions are answered correctly. */
const BKT_PRIOR = 0.2;


/* Read one value out of the page's URL query string.
   Example: on study.html?i=1&page=2, get_url_parameter('page', 0) returns "2". */
function get_url_parameter(name, fallback) {
  const value = new URLSearchParams(window.location.search).get(name);
  return value === null ? fallback : value;
}


/* Build the starting BKT score map for one subtopic: every skill at the prior. */
function make_initial_skill_scores(skill_names) {
  const scores = {};
  skill_names.forEach(function (skill_name) { scores[skill_name] = BKT_PRIOR; });
  return scores;
}


/* Build a brand-new progress object: Tier 1, nothing mastered, flower a bud. */
function make_fresh_progress() {

  const mastery_per_subtopic = SUBTOPICS.map(function (subtopic) {
    return {
      1: { skill_scores: make_initial_skill_scores(subtopic.skills), is_mastered: false },
      2: { skill_scores: make_initial_skill_scores(subtopic.skills), is_mastered: false },
      3: { defense_result: 'none' }
    };
  });

  return {
    current_tier: 1,
    flower_stage: 0,
    next_tier_to_unlock: null,
    course_complete: false,
    last_studied_subtopic: null,
    mastery: mastery_per_subtopic
  };
}


/* Build a pre-filled progress object so the splash "Resume" path immediately
   shows something interesting: Tier 1 cleared, part-way through Tier 2. */
function make_demo_progress() {

  const progress = make_fresh_progress();

  progress.current_tier = 2;
  progress.flower_stage = 1;
  progress.last_studied_subtopic = 1;

  // Every subtopic has cleared Tier 1.
  progress.mastery.forEach(function (subtopic_mastery, subtopic_index) {
    Object.keys(subtopic_mastery[1].skill_scores).forEach(function (skill_name) {
      subtopic_mastery[1].skill_scores[skill_name] = 0.97;
    });
    subtopic_mastery[1].is_mastered = true;
  });

  // The last subtopic is part-way into Tier 2.
  const partial = progress.mastery[2][2].skill_scores;
  Object.keys(partial).slice(0, 2).forEach(function (skill_name) { partial[skill_name] = 0.6; });

  return progress;
}


/* Load the saved progress from sessionStorage, or a fresh start if none exists.

   Guards against a stale progress left over from a DIFFERENT curriculum: if its
   per-subtopic mastery array no longer matches the current number of subtopics,
   it is meaningless here (and indexing it would crash the curriculum page), so
   we discard it and start fresh. */
function load_progress() {
  try {
    const saved_text = sessionStorage.getItem(STORAGE_KEY);
    if (saved_text) {
      const saved_progress = JSON.parse(saved_text);

      const has_matching_mastery =
        saved_progress
        && Array.isArray(saved_progress.mastery)
        && saved_progress.mastery.length === SUBTOPICS.length;

      if (has_matching_mastery) {
        return saved_progress;
      }
    }
  } catch (error) {
    /* sessionStorage unavailable or unreadable — fall through to a fresh start */
  }
  return make_fresh_progress();
}


/* Save the progress object to sessionStorage. */
function save_progress(progress) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    /* nothing we can do; progress just will not persist */
  }
}


/* ---- Tier-3 defense transcripts ----
   The defense chat is otherwise not persisted. Once a defense is passed we keep
   its transcript so the learner can reopen and reread it later. It is stored
   separately from progress, one entry per subtopic. */

function defense_transcript_key(subtopic_index) {
  return 'bloom.defense.' + subtopic_index;
}

/* Save one subtopic's defense transcript (the raw [role, content] messages). */
function save_defense_transcript(subtopic_index, messages) {
  try {
    const storage_key = defense_transcript_key(subtopic_index);
    sessionStorage.setItem(storage_key, JSON.stringify(messages));
  } catch (error) {
    /* unavailable — the transcript just will not persist */
  }
}

/* Load a saved defense transcript, or null if there is none. */
function load_defense_transcript(subtopic_index) {
  try {
    const storage_key = defense_transcript_key(subtopic_index);
    const saved_text = sessionStorage.getItem(storage_key);

    if (saved_text) {
      return JSON.parse(saved_text);
    }
  } catch (error) {
    /* fall through to null */
  }

  return null;
}


/* True once every skill in the map is above the mastery threshold. */
function are_all_skills_mastered(skill_scores) {
  return Object.keys(skill_scores).every(function (skill_name) {
    return skill_scores[skill_name] >= MASTERY_THRESHOLD;
  });
}


/* How far along a subtopic is at one tier, as a percentage.
   This is the average of its skill scores — an equal-weighted sum. */
function subtopic_mastery_percent(progress, subtopic_index, tier) {
  if (tier === 3) {
    return progress.mastery[subtopic_index][3].defense_result === 'passed' ? 100 : 0;
  }

  const scores = progress.mastery[subtopic_index][tier].skill_scores;
  const skill_names = Object.keys(scores);
  if (!skill_names.length) return 0;

  const total = skill_names.reduce(function (sum, skill_name) { return sum + scores[skill_name]; }, 0);
  return Math.round(total / skill_names.length * 100);
}


/* Like subtopic_mastery_percent, but stretched for DISPLAY so an untouched
   subtopic reads as 0%.

   Raw BKT scores never start at zero (they start at the prior), so the raw
   average shows a fresh subtopic at ~20%. For progress bars we stretch the range
   we care about — [prior .. threshold] onto [0 .. 100] — and clamp below the
   prior to 0. This changes only what is shown, never the stored P(L) values. */
function subtopic_display_percent(progress, subtopic_index, tier) {
  if (tier === 3) {
    if (progress.mastery[subtopic_index][3].defense_result === 'passed') {
      return 100;
    }
    return 0;
  }

  const skill_scores = progress.mastery[subtopic_index][tier].skill_scores;
  const skill_names = Object.keys(skill_scores);
  if (skill_names.length === 0) {
    return 0;
  }

  let total_score = 0;
  skill_names.forEach(function (skill_name) {
    total_score = total_score + skill_scores[skill_name];
  });
  const average_score = total_score / skill_names.length;

  const usable_range = MASTERY_THRESHOLD - BKT_PRIOR;
  const stretched_percent = (average_score - BKT_PRIOR) / usable_range * 100;

  if (stretched_percent < 0) {
    return 0;
  }
  if (stretched_percent > 100) {
    return 100;
  }
  return Math.round(stretched_percent);
}


/* ---- Overall progress + performance history (for the dashboard graph) ----

   The dashboard plots ONE monotonic 0..100% curve across the whole course:
   Tier 1 spans 0..33%, Tier 2 33..66%, Tier 3 66..100%. A point is recorded
   after every graded answer, so the curve grows through the session and dies
   with it (sessionStorage, like everything else). */

const HISTORY_KEY = 'bloom.history';

/* The average display-stretched mastery across all subtopics at one tier. */
function overall_tier_display_percent(progress, tier) {
  const subtopic_count = progress.mastery.length;
  if (subtopic_count === 0) {
    return 0;
  }

  let total_percent = 0;
  for (let subtopic_index = 0; subtopic_index < subtopic_count; subtopic_index = subtopic_index + 1) {
    total_percent = total_percent + subtopic_display_percent(progress, subtopic_index, tier);
  }
  return total_percent / subtopic_count;
}

/* Global course progress 0..100%: fully-cleared tiers plus the fractional
   progress through the current tier, spread evenly across the three tiers. */
function global_progress_percent(progress) {
  const tiers_fully_cleared = progress.flower_stage;   // 0..3

  let current_tier_percent = 0;
  if (!progress.course_complete && progress.current_tier <= 3) {
    current_tier_percent = overall_tier_display_percent(progress, progress.current_tier);
  }

  let global_percent = (tiers_fully_cleared * 100 + current_tier_percent) / 3;
  if (global_percent > 100) {
    global_percent = 100;
  }
  return Math.round(global_percent);
}

/* Read the recorded performance history (an array of global% values). */
function load_mastery_history() {
  try {
    const saved_text = sessionStorage.getItem(HISTORY_KEY);
    if (saved_text) {
      return JSON.parse(saved_text);
    }
  } catch (error) {
    /* unreadable — treat as empty */
  }
  return [];
}

/* Append the current global progress to the performance history. */
function record_mastery_point(progress) {
  const history = load_mastery_history();
  history.push(global_progress_percent(progress));

  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    /* nothing we can do; the point just will not persist */
  }
}


/* Count how many subtopics have cleared the current tier. */
function count_subtopics_cleared(progress) {
  const tier = progress.current_tier;

  return progress.mastery.filter(function (subtopic_mastery) {
    return tier === 3
      ? subtopic_mastery[3].defense_result === 'passed'
      : subtopic_mastery[tier].is_mastered;
  }).length;
}


/* A short caption describing the flower's current bloom stage. */
function flower_stage_label(progress) {
  const labels = ['In bud — no tiers cleared', 'Tier 1 cleared', 'Tier 2 cleared', 'Full bloom — all tiers cleared'];
  return labels[progress.flower_stage];
}


/* A one-line summary of how far the current tier has progressed. */
function tier_progress_summary(progress) {
  if (progress.course_complete) return 'All tiers complete';

  const cleared = count_subtopics_cleared(progress);
  return 'Tier ' + progress.current_tier + ' — ' + cleared + ' of ' + SUBTOPICS.length + ' subtopics mastered';
}


/* Work out the status label + colour for one subtopic at a given tier.
   Returns { label, css_class } where css_class is 'ok' | 'warn' | 'muted'. */
function get_subtopic_status(progress, subtopic_index, tier) {
  const subtopic_mastery = progress.mastery[subtopic_index];

  // Tier 3 is a pass/fail defense rather than a BKT score.
  if (tier === 3) {
    if (subtopic_mastery[3].defense_result === 'passed') return { label: 'Defense passed', css_class: 'ok' };
    if (subtopic_mastery[3].defense_result === 'sent-back') return { label: 'In review', css_class: 'warn' };
    return { label: 'Not attempted', css_class: 'muted' };
  }

  // Tiers 1 and 2 track BKT confidence per skill.
  if (subtopic_mastery[tier].is_mastered) return { label: 'Mastered', css_class: 'ok' };

  const has_started = subtopic_mastery_percent(progress, subtopic_index, tier) > Math.round(BKT_PRIOR * 100);
  return has_started ? { label: 'In progress', css_class: 'warn' } : { label: 'Not started', css_class: 'muted' };
}


/* Call this right after a subtopic is mastered. If every subtopic has now
   cleared the current tier, bloom the flower and line up the next tier (or
   finish the course). Saves the progress and returns the page to go to next. */
function advance_progress_after_mastery(progress) {
  const tier = progress.current_tier;

  const every_subtopic_cleared = progress.mastery.every(function (subtopic_mastery) {
    return tier === 3
      ? subtopic_mastery[3].defense_result === 'passed'
      : subtopic_mastery[tier].is_mastered;
  });

  // Still subtopics left at this tier — just go back to the curriculum.
  if (!every_subtopic_cleared) {
    save_progress(progress);
    return 'curriculum.html';
  }

  // The whole tier is cleared: bloom the flower one stage.
  progress.flower_stage = tier;

  if (tier < 3) {
    progress.next_tier_to_unlock = tier + 1;
  } else {
    progress.course_complete = true;
    progress.next_tier_to_unlock = null;
  }

  save_progress(progress);
  return 'progression.html';
}


/* ---- Study guide cache (the lazily-generated lessons) ----
   Each subtopic's study guide is generated on demand the first time the subtopic
   is opened (see study.html), then kept here so re-opening it never regenerates.
   They accumulate in one growing { study_guides: [...] } object under
   STUDY_GUIDES_STORAGE_KEY (defined in data.js, which loads before this file).
   data.js reads this same cache to build each subtopic's study content. */
function save_study_guide(guide) {
  let guides = [];

  // Read whatever guides we already have this session.
  try {
    const saved_text = sessionStorage.getItem(STUDY_GUIDES_STORAGE_KEY);
    if (saved_text) {
      const parsed = JSON.parse(saved_text);
      guides = parsed.study_guides || [];
    }
  } catch (error) {
    guides = [];
  }

  // If we already stored a guide for this subtopic, replace it; otherwise add it.
  let existing_index = -1;
  for (let index = 0; index < guides.length; index = index + 1) {
    if (guides[index] && guides[index].subtopic === guide.subtopic) {
      existing_index = index;
      break;
    }
  }

  if (existing_index >= 0) {
    guides[existing_index] = guide;
  } else {
    guides.push(guide);
  }

  const cache_object = { study_guides: guides };
  sessionStorage.setItem(STUDY_GUIDES_STORAGE_KEY, JSON.stringify(cache_object));
}
