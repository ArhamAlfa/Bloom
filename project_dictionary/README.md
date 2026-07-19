# Bloom Pathway — Data Contracts

This folder holds the **expected JSON output** of two generation engines (for now). They double as the **single source of truth** for building the frontend offline, before the backend exists.

## Files

- **`curriculum_engine_expected_output.json`** — output of the Curriculum Engine. One topic → subtopics → skills, with a per-skill `tier_1`/`tier_2` objective and an optional subtopic-level `capstone`. Top-level `user_query` (raw request) and `topic` (LLM-scoped).
- **`study_engine_subtopic_output.json`** — output of the Study Engine, **for a single subtopic** (`Gravitational fields`). Structure: `intro` → `sections[]` (each with a `tier_1` core, a `tier_2` extension, and per-tier `further_reading`) → `capstone` prep section. Bodies are **Markdown + LaTeX** (`$...$` inline, `$$...$$` display; render with KaTeX/MathJax, e.g. `react-markdown` + `remark-math` + `rehype-katex`).

## How the frontend should use these

Build the UI **directly against these JSON files** for now. Load them as local imports/fixtures and shape every component around these structures. When the backend is ready, the only change is the data source:

```
// offline (now):    const data = await import('./curriculum_engine_expected_output.json')
// online (later):   const data = await fetch('/api/curriculum').then(r => r.json())
```

Same shape in, same components out — so treat these schemas as fixed and code to them.

## Important notes

- **No IDs anywhere.** Reference everything by list index (subtopic index, skill index, section index). Numbering like `3.1` / `3.1.1` is derived from position, not stored.
- **The study schema is per-subtopic.** The real backend produces one such object *per subtopic* (fanned out as parallel async calls, then merged into an array index-aligned with `curriculum...subtopics`). Only **Gravitational fields** is fleshed out here as the depth reference — every other subtopic follows the identical shape at similar depth. For offline dev, either reuse this one for all subtopics, or stub the others as one-sentence placeholders and keep Gravitational fields as the full example.
- **Tiers are gatekept.** `tier_2` unlocks after the `tier_1` exam is passed; the `capstone` section unlocks after `tier_2`. Each tier carries its own `further_reading`, so never show a resource for a tier the user hasn't reached.
- **Capstone = synthesis, authored separately.** The study `capstone` section maps onto the curriculum `capstone` brief; it's prep for the Tier 3 defense, not BKT-graded.
