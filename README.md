# Bloom — Adaptive Learning Pathway

Bloom is an adaptive learning web application built on Bloom's Taxonomy, designed to take a learner from first principles to demonstrated mastery through dynamic study lessons, curriculum outlines, and targeted assessments.

---

## 🛠️ Architecture & Backend Seams

The project is structured around two clean backend seams, separating static frontend rendering from dynamic AI generation:

1. **The Curriculum Engine (`backend/curriculum_study_engine/curriculum.py`)**: Uses OpenAI (GPT-4o/4o-mini) via LangChain to generate the structural JSON outline (`current_curriculum.json`) based on the user's prompt.
2. **The Study Engine (`backend/curriculum_study_engine/study_guide.py`)**: Asynchronously processes each subtopic to generate deep-dive markdown study guides, LaTeX formulas, and external resource links, compiled into `master_study_guide.json`.

---

## 🚀 Recent Accomplishments & Changes

- **End-to-End Pipeline Integration**: Connected the landing page (`index.html`) to a FastAPI backend (`main.py`), allowing users to type any custom topic and dynamically build a custom curriculum and study pathway in real-time.
- **Resilient Caching Layer**: Implemented browser `localStorage` and `sessionStorage` caching to securely store generated payloads and prevent redundant API calls during a session.
- **Model-Agnostic LLM Migration**: Swapped study guide generation from flaky free-tier models to robust, paid-tier OpenAI infrastructure (`gpt-4o-mini`), eliminating concurrency bottlenecks (`503` errors) and speeding up generation with smart semaphores.
- **Schema Alignment & Normalization**: Standardized JSON serialization between the backend generators and frontend renderers (`study.html`, `dashboard.html`, and `data.js`) to ensure seamless data binding without runtime `undefined` errors.
- **Content Expansion**: Upgraded the study engine prompt to generate comprehensive multi-section modules (5–6 detailed sections per subtopic) equipped with automated `further_reading` reference arrays.
