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


// /* The raw curriculum object, exactly as the schema defines it.
//    (Loaded from data/curriculum.js just before this file.) */
// const raw_curriculum = BLOOM_CURRICULUM;

// const TOPIC = raw_curriculum.topic;                 // e.g. "Fields"
// const USER_QUERY = raw_curriculum.user_query;       // the learner's original request



// D
/* ============================================================
   THE CURRICULUM SOURCE
   Checks local storage for a live API response first. 
   If missing, falls back to the offline schema fixture.
   ============================================================ */


const cached_curriculum = localStorage.getItem('bloom_live_curriculum');

// Parse the live data if it exists, otherwise use the offline mock from curriculum.js
const raw_curriculum = cached_curriculum ? JSON.parse(cached_curriculum) : BLOOM_CURRICULUM;



const TOPIC = raw_curriculum.topic;
const USER_QUERY = raw_curriculum.user_query;





/* The three Bloom's-taxonomy tiers (the assessment bands). */
const TIER_NAMES = {
  1: 'Tier 1 · Knowledge & Comprehension',
  2: 'Tier 2 · Application & Analysis',
  3: 'Tier 3 · Synthesis & Evaluation'
};


// /* Which subtopics have fully-authored study text, looked up by name.
//    To add another later: create its study file and register it here. */
// const STUDY_BY_NAME = {};
// STUDY_BY_NAME[BLOOM_STUDY_GRAVITATIONAL.subtopic] = BLOOM_STUDY_GRAVITATIONAL;


// /* ============================================================
//    THE STUDY ENGINE API CLIENT
//    Fetches dynamic study materials from the backend based on 
//    the specific subtopic and its skills. Caches the result.
//    ============================================================ */
// async function fetch_study_data(subtopic_object) {
//   const cache_key = 'bloom_study_' + subtopic_object.subtopic;
//   const cached_study = localStorage.getItem(cache_key);

//   if (cached_study) {
//     return JSON.parse(cached_study);
//   }

//   try {
//     const response = await fetch('/api/study', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         subtopic_name: subtopic_object.subtopic,
//         skills: subtopic_object.skills
//       })
//     });

//     if (!response.ok) throw new Error('Backend returned ' + response.status);

//     const study_data = await response.json();
//     localStorage.setItem(cache_key, JSON.stringify(study_data));
//     return study_data;

//   } catch (error) {
//     console.error("Study API failed, falling back to offline mock.", error);
//     return typeof BLOOM_STUDY_GRAVITATIONAL !== 'undefined' ? BLOOM_STUDY_GRAVITATIONAL : null; 
//   }
// } --> REPLACED


const STUDY_BY_NAME = {};

/* ============================================================
   STUDY ENGINE CLIENT (ADAPTER ENHANCED)
   Reads pre-generated JSON and maps LLM output to UI models.
   ============================================================ */
async function fetch_study_data(subtopic_object) {
  const targetName = subtopic_object.subtopic || subtopic_object.name;
  console.log(`⏳ study.html loading data for: ${targetName}`);

  const sessionData = sessionStorage.getItem("bloom_session_cache");

  if (!sessionData || sessionData === "undefined" || sessionData === "null") {
      console.error("❌ No valid study data found. Redirecting to home page...");
      window.location.href = 'index.html'; 
      return null;
  }

  try {
      const masterData = JSON.parse(sessionData);

      if (masterData && masterData.study_guides) {
          // 1. Find matching guide (handles both wrapped and unwrapped JSON)
          let matchedEntry = masterData.study_guides.find(guide => {
              const item = guide.study_guide || guide;
              return item.subtopic === targetName;
          });

          // Fallback if exact match fails
          if (!matchedEntry && masterData.study_guides.length > 0) {
              console.warn(`⚠️ Exact name match not found for ${targetName}. Using first guide in list.`);
              matchedEntry = masterData.study_guides[0];
          }

          if (matchedEntry) {
              // 2. Unwrap nested "study_guide" object if present
              let guide = matchedEntry.study_guide || matchedEntry;

              // 3. Map "skills" array to "sections" so study.html doesn't crash on .forEach()
              if (!guide.sections && guide.skills) {
                  guide.sections = guide.skills.map(s => ({
                      heading: s.skill,
                      tier_1: s.tier_1,
                      tier_2: s.tier_2,
                      content: s.content || null
                  }));
              }

              // 4. Guarantee intro object exists
              if (!guide.intro) {
                  guide.intro = {
                      heading: 'About ' + guide.subtopic,
                      body: 'Welcome to ' + guide.subtopic + '.'
                  };
              }

              return guide;
          }
      }
      
      console.error("❌ JSON is empty. Redirecting to home...");
      window.location.href = 'index.html';
      return null;
      
  } catch (e) {
      console.error("❌ Failed to parse session cache. Redirecting to home...", e);
      window.location.href = 'index.html';
      return null;
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
    study: /*STUDY_BY_NAME[raw_subtopic.subtopic] ||*/ make_stub_study(raw_subtopic),

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
