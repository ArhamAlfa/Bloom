"use strict";

/* ============================================================
   data.js — where the course CONTENT comes from.

   This is one of the two "backend seams". Today the curriculum and
   study text are loaded from the fixtures in ../data/*.js (plain JS
   copies of the schema in ../../project_dictionary). When a real
   backend exists, only this file changes: fetch the same shapes from
   an API and build SUBTOPICS exactly the same way.

       // today (offline):
       const raw_curriculum = BLOOM_CURRICULUM;

       // later (real backend):
       // const raw_curriculum = await fetch('/api/curriculum').then(response => response.json());

   Everything else in the app only ever reads SUBTOPICS, so it never
   needs to know where the data came from.
   ============================================================ */


/* The client "database" keys. sessionStorage is the whole app's memory for one
   visit: it survives page-to-page navigation and reloads, and is wiped by the
   "New prompt" button (exit.html) or by starting a new topic (index.html).
   These are defined here because data.js loads before every other script, so the
   rest of the app can reference them. */
const CURRICULUM_STORAGE_KEY = 'bloom.curriculum';
const STUDY_GUIDES_STORAGE_KEY = 'bloom.study_guides';

/* Use the live curriculum built by /api/build-pathway if one is stored for this
   session; otherwise fall back to the bundled fixture so the app still renders
   (e.g. when opening a page directly during development). */
const stored_curriculum_text = sessionStorage.getItem(CURRICULUM_STORAGE_KEY);
let raw_curriculum;
if (stored_curriculum_text) {
  raw_curriculum = JSON.parse(stored_curriculum_text);
} else {
  raw_curriculum = BLOOM_CURRICULUM;
}


const TOPIC = raw_curriculum.topic;                 // e.g. "Fields"
const USER_QUERY = raw_curriculum.user_query;       // the learner's original request


/* The three Bloom's-taxonomy tiers (the assessment bands). */
const TIER_NAMES = {
  1: 'Tier 1 · Knowledge & Comprehension',
  2: 'Tier 2 · Application & Analysis',
  3: 'Tier 3 · Synthesis & Evaluation'
};


/* Which subtopics have fully-authored study text, looked up by name.
   To add another later: create its study file and register it here. */
const STUDY_BY_NAME = {};
STUDY_BY_NAME[BLOOM_STUDY_GRAVITATIONAL.subtopic] = BLOOM_STUDY_GRAVITATIONAL;


/* Pull in any study guides generated so far this session. They are produced
   lazily, one subtopic at a time (see study.html), and accumulate in the cache
   under STUDY_GUIDES_STORAGE_KEY as { study_guides: [...] }. Each is keyed by its
   subtopic name so it lines up with the matching curriculum subtopic. */
const stored_study_text = sessionStorage.getItem(STUDY_GUIDES_STORAGE_KEY);
if (stored_study_text) {
  try {
    const parsed_study = JSON.parse(stored_study_text);
    const generated_guides = parsed_study.study_guides || [];

    generated_guides.forEach(function (guide) {
      if (guide && guide.subtopic) {
        STUDY_BY_NAME[guide.subtopic] = guide;
      }
    });
  } catch (error) {
    console.error('Could not read cached study guides:', error);
  }
}






/* Build placeholder study content for a subtopic the Study Engine has not
   authored yet. It has the same shape as real study data, but its section
   bodies are just the short curriculum objectives, so the study screen is
   never empty. */
function make_stub_study(raw_subtopic) {

  const placeholder_sections = raw_subtopic.skills.map(function (skill) {
    return {
      heading: skill.skill,
      tier_1: { body: skill.tier_1, further_reading: [] },
      tier_2: { body: skill.tier_2, further_reading: [] }
    };
  });

  return {
    subtopic: raw_subtopic.subtopic,
    stub: true,
    intro: {
      heading: 'About ' + raw_subtopic.subtopic,
      body: 'A full study lesson for **' + raw_subtopic.subtopic + '** has not been authored yet. '
        + 'The outline below is generated from the curriculum objectives for each skill.'
    },
    sections: placeholder_sections,
    capstone: raw_subtopic.capstone
      ? { heading: 'Bringing it together', body: raw_subtopic.capstone, further_reading: [] }
      : null
  };
}


/* SUBTOPICS is the model the whole app renders from: one tidy entry per
   curriculum subtopic. Everything refers to a subtopic by its position in
   this list (no IDs), exactly as the schema intends. */
const SUBTOPICS = raw_curriculum.subtopics.map(function (raw_subtopic) {
  return {
    name: raw_subtopic.subtopic,
    skills: raw_subtopic.skills.map(function (skill) { return skill.skill; }),
    capstone: raw_subtopic.capstone,
    study: STUDY_BY_NAME[raw_subtopic.subtopic] || make_stub_study(raw_subtopic),

    // The untouched curriculum entry for this subtopic. The exam sends this
    // straight to the question generator, which needs the per-skill objectives.
    curriculum: raw_subtopic
  };
});


/* How many skills a subtopic lists in the curriculum. */
function skill_count(subtopic_index) {
  return SUBTOPICS[subtopic_index].skills.length;
}


/* Return the ordered list of study "pages" for one subtopic:
   an intro page (numbered M.0), one page per section (M.1, M.2 …), and a
   final capstone page (M.C) if the subtopic has one. "M" is the subtopic's
   human-friendly number, which is just its list position plus one. */
function get_study_pages(subtopic_index) {

  const subtopic = SUBTOPICS[subtopic_index];
  const study = subtopic.study;
  const subtopic_number = subtopic_index + 1;

  const page_list = [];

  // The intro / overview page.
  page_list.push({
    kind: 'intro',
    num: subtopic_number + '.0',
    title: (study.intro && study.intro.heading) || ('About ' + subtopic.name)
  });

  // One page per section.
  study.sections.forEach(function (section, section_index) {
    page_list.push({
      kind: 'section',
      section_index: section_index,
      num: subtopic_number + '.' + (section_index + 1),
      title: section.heading
    });
  });

  // The capstone page, if this subtopic has a capstone.
  if (study.capstone) {
    page_list.push({
      kind: 'capstone',
      num: subtopic_number + '.C',
      title: study.capstone.heading
    });
  }

  return page_list;
}
