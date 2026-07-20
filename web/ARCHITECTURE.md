# Bloom (web) — how the frontend works

A plain-English tour of how everything fits together. No framework, no
build step: just HTML files, CSS files, and small JavaScript files.

If it helps, hold onto the Streamlit comparison: in Streamlit one Python
script fetches data, processes it, and shows it, and the framework repaints
the page for us. Here those jobs are split — the HTML is the page, and a bit
of JavaScript does "read data → process → show". Nothing repaints unless our
code changes the page on purpose.


## The three kinds of file

1. **Pages** (`*.html`) — one per screen. Each is real, readable markup:
   the sidebar, the headings, empty containers, and (for repeated things) a
   `<template>`. At the bottom of each page is a short `<script>` that fills
   in the dynamic parts.

2. **Shared logic** (`js/*.js`) — the code every page reuses. Loaded with
   `<script src>` before the page's own script runs.

3. **Data** (`data/*.js`) — the course content, as plain JS objects. Today
   these are local fixtures; tomorrow they come from a server (see "backend
   seams").


## What each shared file is responsible for

    js/data.js            Reads the content fixtures and builds SUBTOPICS, the
                          one list the whole app renders from. (CONTENT seam.)

    js/store.js           Loads and saves the learner's progress (localStorage),
                          and the small helpers that read it. (PROGRESS seam.)

    js/render-helpers.js  Turns data into little bits of markup: the flower and
                          chart SVGs, the icons, and the study-text formatter.

    js/sidebar.js         Fills the shared sidebar on every page (icons, the
                          active-tab highlight, the tier readout, the tree).

    js/exam.js            The mocked exam question / defense bank, plus two
                          lookups. Only exam.html uses it.


## Two important objects

Almost everything reads one of these two objects.

**SUBTOPICS** (built in `data.js`) — the course content. A list; each entry is

    { name, skills: [...], capstone, study: { intro, sections: [...], capstone } }

A subtopic is always referred to by its position in this list (0, 1, 2) — no
IDs, matching the schema.

**progress** (loaded in `store.js`) — the learner's saved state:

    {
      current_tier,            // 1..3
      flower_stage,            // 0..3, how many tiers are fully cleared
      next_tier_to_unlock,     // set when a tier is cleared
      course_complete,
      last_studied_subtopic,
      mastery: [               // one per subtopic, same order as SUBTOPICS
        {
          1: { skills_mastered, is_mastered },   // Tier 1
          2: { skills_mastered, is_mastered },   // Tier 2
          3: { defense_result }                  // 'none' | 'passed' | 'sent-back'
        },
        ...
      ]
    }


## What happens when a page loads

Take `curriculum.html`. Opening it runs, top to bottom:

1. The browser draws the HTML — including the empty `<div id="subgrid">` and
   the `<template>` for a card.

2. The `<script src>` tags run in order, defining the shared things:
   `SUBTOPICS`, `load_progress()`, `flower_svg()`, `fill_sidebar()`, and so on.

3. The page's own inline `<script>` runs. It:
   - reads saved progress with `load_progress()`,
   - fills the sidebar with `fill_sidebar('curriculum', progress, ...)`,
   - loops over `SUBTOPICS`, clones the card template for each subtopic, and
     writes in the name/status/icon/bar,
   - fills the tier bar and the flower.

That is the whole "read data → process → show" cycle, done by hand instead of
by a framework.


## How we move between screens

Navigation is ordinary links. A subtopic card is an `<a href="subtopic.html?i=1">`.
Clicking it just opens that file.

Two pieces of state travel differently:

- **"Where am I looking"** rides in the URL: `subtopic.html?i=1`,
  `study.html?i=1&page=2`. Always visible in the address bar; read with
  `get_url_parameter('i', ...)`.

- **"What have I mastered"** is saved progress. Since each page load starts
  fresh, we persist it in localStorage via `save_progress()` and read it back
  with `load_progress()` on the next page.

Only `exam.html` changes without navigating: answering a question updates the
panel in place (still just `element.innerHTML = ...`), and it only jumps to
another page once the subtopic is settled.


## A concrete trace: mastering a subtopic

1. On `curriculum.html`, click a card → the browser opens `subtopic.html?i=1`.
2. `subtopic.html` reads `?i=1`, looks up `SUBTOPICS[1]`, and shows the hero +
   the Study / Assessment cards. "Assessment" links to `exam.html?i=1`.
3. `exam.html` reads `?i=1` and the saved `progress`. Because `current_tier`
   is (say) 1, it runs the question loop, drawing one question at a time.
4. Clicking "Mark correct" bumps `mastery[1][1].skills_mastered`. When it
   reaches the target, `mastery[1][1].is_mastered = true`.
5. It then calls `advance_progress_after_mastery(progress)`, which saves the
   progress and returns the next page — `curriculum.html`, or
   `progression.html` if that was the last subtopic at this tier.
6. The browser opens that page, which loads the just-saved progress and shows
   the updated flower and cards.


## The two backend seams

The app runs fully offline today. Going live means editing two files and
nothing else, because the rest of the app only reads `SUBTOPICS` and `progress`.

**Content — `js/data.js`.** Today it reads the local fixture:

    const raw_curriculum = BLOOM_CURRICULUM;

Later, fetch the same shape from the server:

    const raw_curriculum = await fetch('/api/curriculum').then(response => response.json());

Everything downstream (`SUBTOPICS`, every page) is unchanged.

**Progress — `js/store.js`.** Today `load_progress()` / `save_progress()` use
localStorage. Later, point them at the server:

    // save
    await fetch('/api/progress', { method: 'POST', body: JSON.stringify(progress) });
    // load
    const progress = await fetch('/api/progress').then(response => response.json());

Both "today" lines have the "later" version written beside them as a comment.


## If we would rather write less JavaScript

This design keeps the display logic in the browser. If a Python-first,
server-rendered approach (Flask/FastAPI + Jinja templates) fits better, Python
can fetch, process, and produce the HTML — much less JavaScript — at the cost
of needing a running server. The page designs and the two data shapes above
carry over unchanged either way.
