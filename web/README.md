# Bloom — web (multi-page version)

A plain, multi-page version of the Bloom Pathway front end. No framework,
no build step, no npm — just HTML, CSS, and small JavaScript files. Every
screen is its own `.html` file we can open and read on its own.

## Run it

Open `index.html` in a browser. That's it. Navigation between screens is
ordinary links, so clicking around just opens the other local files.

## The pages (the flow)

Each screen is a real HTML file. We move between them with normal links:

```
index.html        splash / "has a save?"  → Start (fresh) or Resume
topic.html        "what do you want to learn?"  → dashboard
dashboard.html    flower, continue-learning, performance
curriculum.html   the subtopic cards + tier progress bar
subtopic.html     one subtopic: choose Study or Assessment      (?i=<subtopic>)
study.html        one study page at a time                      (?i=<subtopic>&page=<n>)
exam.html         the assessment loop OR the Tier 3 defense      (?i=<subtopic>)
progression.html  shown when a whole tier is cleared
exit.html         save & quit → back to the splash
```

"Which subtopic / which page am I on" is passed in the URL (e.g.
`study.html?i=1&page=2`), so it is always visible in the address bar.

## The shared files

```
styles/   base.css, layout.css, components.css   (the design — unchanged)
data/     curriculum.js, study.gravitational.js  (the schema fixtures)
js/
  data.js            builds SUBTOPICS from the fixtures        (CONTENT seam)
  store.js           saves / loads progress in localStorage    (PROGRESS seam)
  render-helpers.js  the flower, icons, chart, study formatting
  sidebar.js         fills the shared sidebar on every page
  exam.js            the mocked question / defense bank
```

Each page includes the shared files it needs with `<script src="…">`, then
has one short `<script>` at the bottom that fills its own dynamic bits.

## How a page works (the whole pattern)

There is no magic and no framework. A page:

1. loads the shared files,
2. reads saved progress with `loadProgress()` and the URL with `getParam()`,
3. writes text/HTML into the page's containers with standard DOM calls
   (`textContent`, `innerHTML`, cloning a `<template>`),
4. and for links, just points them at the next `.html` file.

Only `exam.html` updates in place (the question loop and the chat), because
those are interactions rather than page-to-page moves.

## The two backend seams

Today the app runs fully offline. Going live means changing two files, and
nothing else:

- **Content** — `js/data.js` reads the curriculum/study from the local
  fixtures. Swap that for `fetch('/api/...')` returning the same shapes.
- **Progress** — `js/store.js` saves/loads progress in the browser's
  localStorage. Swap `loadProgress()` / `saveProgress()` for reads/writes
  to the server.

Both files have the "later" version written as a comment right next to the
"today" version.

## Notes

- Progress is kept in `localStorage` so it survives moving between pages.
- Only **Gravitational fields** has fully authored study text; the other
  subtopics show a schema-generated stub (as the `project_dictionary`
  README intends).
- LaTeX in study text is lightly formatted (no maths library offline). With
  a build step, swap `render-helpers.js`'s formatter for KaTeX.
- Exam questions are mocked in `exam.js` — the schema does not define them.
