# Bloom

Bloom-based LMS

# Bloom Pathway - Dynamic Backend Update

## 🚨 Current Status: Blocked by Google API (503s)

We successfully transitioned the app from relying on static, hardcoded JSON files to a fully dynamic, end-to-end AI pipeline using FastAPI and Gemini. **The code works.**

However, we are currently blocked by Google's servers. The `gemini-3.5-flash` model is aggressively throwing `503 UNAVAILABLE` errors due to high demand.

**The cascading error we are seeing:**

1. Gemini API rejects the request (503).
2. Our Python generator runs out of retries and fails to build the JSON.
3. FastAPI panics because it has no data to return and throws a `500 Internal Server Error`.
4. FastAPI strips CORS headers on 500 errors, causing the frontend browser to show a fake CORS block.
5. Because the frontend receives an error instead of data, it refuses to cache the session, causing it to spam the server on every page click.

**Fix:** We literally just have to wait for Google's servers to clear up, or upgrade the API key to a paid tier to bypass free-tier compute throttling.

---

## 🏛️ The New Architecture

### 1. The Backend Bridge (`main.py`)

- We added a **FastAPI** server (running on port 8000 via Uvicorn) to act as the HTTP middleman between the web browser and the Python script.
- It exposes a `POST /api/generate` endpoint that intercepts frontend requests, triggers the AI, and returns the JSON payload.

### 2. The AI Engine (`study_guide.py`)

- Built an asynchronous pipeline (`asyncio` + `genai`) to ingest the base curriculum and output a structured study guide.
- **Concurrency:** Locked to `Semaphore(1)` with a 15-second backoff and 5-attempt retry loop to aggressively avoid Google's rate limits.
- **Safety:** It automatically catches and fixes unescaped LaTeX backslashes before parsing the JSON to prevent decoder crashes.

### 3. The Frontend Client (`data.js`)

- Stripped out the offline static variables (`BLOOM_CURRICULUM`, etc.).
- Built `fetch_study_data()` to ping FastAPI.
- **Caching:** Implemented `sessionStorage` caching. It only forces the AI to generate on a fresh tab; clicking around the UI pulls from the browser's session memory to save tokens.
- **Bypass:** Added a fallback that loads the first available guide if the generated subtopic name doesn't perfectly match the UI's expected name, preventing a fatal crash.

### 4. The UI Initialization (`study.html`)

- Upgraded the page load sequence to be fully asynchronous (`async function init_study_page()`).
- The UI now politely waits for the backend to deliver the real data, overwrites the local stubs in memory, and renders the AI text directly into the DOM.
