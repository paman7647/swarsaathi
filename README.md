# SwarSaathi - Hindi + Telugu + English Multilingual Voice Bot

## Submission

| Item | Details |
| --- | --- |
| Candidate Name | Aman Kumar Pandey |
| Tech Stack | React, Tailwind CSS, Framer Motion, FastAPI, SQLite, Gemini API, Web Speech API, SpeechSynthesis |
| Ngrok URL | https://lullaby-follicle-manifesto.ngrok-free.dev |
| GitHub Repo | https://github.com/paman7647/swarsaathi |

## About

This project is a premium **Hindi, Telugu, and English** multilingual interactive voice bot.

It captures voice input from the microphone, displays live speech transcripts, queries the backend FastAPI service (integrated with Gemini model or custom local regex rules), and plays back natural speech replies to the user.

Example:

```text
User: Namaste, my name is Raju
Bot: Hello Raju ji, welcome! How can I help you today?

User: Mujhe ek software demo schedule cheyandi
Bot: Sure Raju ji, meeku demo schedule chestanu.
```

## Features

- **Premium Glassmorphic Auth Screen:** Elegant account registration and login portal utilizing spring slide transitions powered by Framer Motion.
- **JWT Authorization & Session Isolation:** Pure Python standard library JWT authorization layer, protecting private chat logs and sessions.
- **Interactive Script Selector:** Dynamically switch response scripts between native Devanagari/Telugu alphabets and standard Romanized scripts.
- **TTS Speed & Pitch Controls:** Custom range sliders to modify the rate and pitch of speech outputs on the fly.
- **Real-Time API Heartbeat:** Dynamic connectivity badge reflecting actual FastAPI server health status.
- **Mic Sound Effects:** Integrated Web Audio API beeps on microphone activation and deactivation.
- **Gemini API & Fallback Reasoning:** Deep learning responses from Gemini models with a precise rule-based regex fallback backup.
- **Chat Logs Export & Reset:** One-click clear session/profile button and log exporter (.txt file downloader).
- **Fully Responsive Layout:** Tailored slate dark and clean light mode dashboard experiences.

## Tech stack

- **Frontend (web/):** React, Vite, Tailwind CSS, Framer Motion, Axios
- **Backend (core/):** FastAPI, SQLite (pure standard library connectivity)
- **Security:** Pure-Python JWT implementation (HS256 signature)
- **Reply provider:** Gemini API
- **STT & TTS:** Web Speech API (SpeechRecognition & SpeechSynthesis)
- **Logs:** Plain Text exporter and SQLite backend storage

## Project files

```text
core/
  app/
    conversation.py
    db.py
    main.py
  tests/
web/
  src/
    components/
    hooks/
    App.jsx
README.md
```

## Run locally

### Backend

```bash
cd core
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Add your Gemini key in `core/.env`:

```text
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.5-flash
```

If the key is blank, the app still works with the rule replies.

### Frontend

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173` in the browser and allow microphone permission.

## Logs

Text logs are saved here:

```text
core/data/chat_history.txt
```

Log example:

```text
Session: session-id
Timestamp: timestamp
User: Namaste, naa peru Raju
Bot: Namaste Raju ji, aapko kaise help chahiye?
```

SQLite history is saved here:

```text
core/data/voice_bot.db
```

## API

### Chat

`POST /api/chat`

Request:

```json
{
  "transcript": "Namaste, naa peru Raju",
  "speech_locale": "mixed"
}
```

Response:

```json
{
  "session_id": "session-id",
  "reply": "Namaste Raju ji, aapko kaise help chahiye?",
  "reply_source": "gemini",
  "memory": {
    "user_name": "Raju",
    "last_intent": "greeting",
    "turns": 1
  }
}
```

### Session logs

`GET /api/sessions/{session_id}/logs`

### Health check

`GET /api/health`

## Checks

Backend:

```bash
cd core
pytest
```

Frontend:

```bash
cd web
npm run lint
npm run build
```

## Note

Speech recognition support depends on the browser. If voice input is not available, the text box can still be used to test the conversation flow.

Gemini API docs used:

- https://ai.google.dev/gemini-api/docs
- https://ai.google.dev/api
- https://googleapis-python-genai-70.mintlify.app/api/models/generate-content
