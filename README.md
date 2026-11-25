# Procucev Speech Studio

A real-time multilingual speech-to-text workspace for English, Hindi and Hinglish. Capture microphone audio, review provisional words, edit the finished text, and save searchable sessions. Dashboard totals, today's count and recorded duration come from MySQL. The workspace starts empty.

[Public repository](https://github.com/rushikeshpuresoftsolutions-png/procucev-speech-to-text) · [Open in GitHub Codespaces](https://codespaces.new/rushikeshpuresoftsolutions-png/procucev-speech-to-text)

## Run in a browser without installing Docker

Open the Codespaces link using a personal account with included compute and storage available. Choose the smallest available 2-core machine. The dev container starts Compose automatically. Once port 5173 is ready, open **Speech Studio** from the Ports panel in a new browser tab and allow microphone access. All inference and database storage run in the remote workspace. Stop the codespace when finished. Its forwarded HTTPS address is private by default and lasts only while the workspace runs. Codespaces usage is subject to the account's remaining allowance and billing settings.

## Local quick start

Install Git and Docker Desktop with Compose v2 (or Docker Engine and the Compose plugin on Linux). On Windows use Linux containers. Allow several GB of free disk space and memory for the three services. The first build requires network access to the package and image registries. The first recording downloads the multilingual model.

```sh
git clone https://github.com/rushikeshpuresoftsolutions-png/procucev-speech-to-text.git
cd procucev-speech-to-text
docker compose up --build
```

| Service | Local address |
| --- | --- |
| React and Vite | http://localhost:5173 |
| FastAPI health | http://localhost:8000/api/health |
| Interactive Swagger | http://localhost:8000/docs |
| MySQL 8.4 | localhost:3306 |

Docker publishes these ports on loopback. Use `docker compose ps` to inspect service health and `docker compose logs -f backend` to see startup or model failures. Stop with `docker compose down`. Named volumes preserve the database, generated app credential and model cache. **To permanently erase all three**, use `docker compose down --volumes`. Run this only for a deliberate full reset.

## Environment

All settings are optional for local Compose. To override them, copy `.env.example` to `.env` (Windows PowerShell: `Copy-Item .env.example .env`) before starting. The local file is ignored by Git. With blank passwords, the MySQL entrypoint generates random credentials. The application password persists in a dedicated volume. To manage MySQL with a known root password, set it before first initialization. Existing MySQL users require SQL-level password rotation.

| Variable | Meaning |
| --- | --- |
| MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD | Database defaults to `speech_to_text_db`, application user to `studio`. |
| DATABASE_URL | Optional SQLAlchemy `mysql+pymysql://USER:PASSWORD@HOST:PORT/DB?charset=utf8mb4` override. URL-encode credentials. Set the provider's TLS parameters for managed MySQL. |
| WHISPER_MODEL | Defaults to multilingual `small`; use `base`, `tiny` or a CTranslate2 model directory. English-only models cannot transcribe Hindi. |
| WHISPER_DEVICE, WHISPER_COMPUTE_TYPE | Default `cpu`, `int8`. |
| WHISPER_THREADS, WHISPER_BEAM_SIZE | Default 2 threads and beam size 2. Latency depends on the CPU. |
| FRONTEND_PORT, BACKEND_PORT | Published local ports, default 5173 and 8000. |
| CORS_ORIGINS | Comma-separated exact frontend origins allowed for HTTP and browser WebSocket connections. Update if frontend port changes. |
| VITE_API_URL, VITE_WS_URL | Defaults to the frontend origin via Vite proxy. For separate production hosts set the full HTTPS API base ending in `/api` and WSS endpoint ending in `/ws/transcribe` **at frontend build time**. |

## Architecture and source

React, Vite, Tailwind CSS, Axios and React Router provide the dashboard, live studio, history and editor. FastAPI exposes REST and WebSocket routes. SQLAlchemy manages request-scoped sessions and the schema. Pydantic validates writes and responses. The backend runs FFmpeg and Faster-Whisper locally. Audio is held in memory and discarded after the session.

```text
frontend/src/components/   shared record rows, waveform and request states
frontend/src/pages/        dashboard, live studio, history and record editor
frontend/src/hooks/        microphone, WebSocket and HTTP request lifecycles
frontend/src/services/     Axios client, endpoint and formatting helpers
backend/app/routes/        dashboard, health and transcription CRUD
backend/app/websocket/     WebSocket protocol, decoder and cleanup
backend/app/services/      model inference and overlapping audio windows
backend/app/schemas/       Pydantic request and response models
backend/app/models.py      SQLAlchemy transcriptions table
backend/tests/             MySQL, WebSocket and window tests
scripts/                   startup and end-to-end checks
docker-compose.yml         frontend, backend and mysql
```

### REST API

| Method | Endpoint | Behavior |
| --- | --- | --- |
| POST | /api/transcriptions | Create with title, content, language and duration in seconds. Returns 201 and the record. |
| GET | /api/transcriptions | Search title or content with `q`; use `page` and `limit`. Returns `items` and `total`, newest first. |
| GET | /api/transcriptions/{id} | Fetch one record. Missing IDs return 404. |
| PUT | /api/transcriptions/{id} | Replace title and content. |
| DELETE | /api/transcriptions/{id} | Delete one record. Returns 204. |
| GET | /api/dashboard/stats | Total count, today's count, accumulated seconds and five latest records. Optional `offset_minutes` is UTC minus local time. |
| GET | /api/health | DB query and service state; 503 on database connection failure. |

Language values are `en`, `hi`, `mixed` and `auto`. Database timestamps are UTC, returned with an explicit offset. The `transcriptions` table has an auto-increment integer id, title VARCHAR(180), Unicode content MEDIUMTEXT, language VARCHAR(16), duration FLOAT, indexed created_at DATETIME and updated_at DATETIME. Tables are created at startup.

### WebSocket and AI

Open `/ws/transcribe`. Send a JSON `start` message containing `type`, `mime` (e.g. `audio/webm;codecs=opus`) and `language`. After the `ready` status, MediaRecorder sends sequential binary chunks every 250 ms. Stop the recorder, send its last data event, then send `{"type":"stop"}` and wait for `complete`.

A continuous FFmpeg decoder consumes the original container stream and emits mono 16 kHz PCM. Inference runs in a separate bounded worker. Each pass adds four seconds of audio, retains a provisional two-second tail, and keeps left context across boundaries. Timestamped words before the stable boundary become numbered `final` updates. The client appends each ID once and replaces its `partial` display. Stop flushes the remaining audio. Silence filtering, word timing and transcription-mode decoding use Faster-Whisper. Forced Hindi or English and automatic multilingual modes are available.

The server returns `status`, `partial`, `final` or `error` messages. It bounds audio size, session length and concurrency, and closes decoder processes on cancellation. The UI releases microphone tracks on stop, failure and navigation. The first inference can take longer while the model downloads.

## Testing

The GitHub workflow builds the three containers, creates a row via the frontend proxy, recreates the containers, reads the same row, and runs automated backend and frontend suites. To reproduce on Linux with curl and jq:

```sh
bash scripts/verify-compose.sh
cd frontend && npm ci && npm test && npm run build
```

To run backend tests, install Python 3.12, FFmpeg, the backend requirements and `backend/requirements-test.txt`. Set `DATABASE_URL` to a disposable MySQL 8 database. From `backend/` run `python -m pytest tests -q`. The tests exercise MySQL connectivity, CRUD, search, statistics, validation, malformed controls, corrupt audio and overlap behavior.

With the studio running and backend dependencies available, stream a real Opus/WebM recording through the frontend proxy:

```sh
python scripts/stream-smoke.py english.webm en
python scripts/stream-smoke.py hindi.webm hi
python scripts/stream-smoke.py hinglish.webm mixed
```

For a microphone check open Live studio, choose a language, start and stop speaking, review the provisional and final words, edit the text and save. Search for it in History, edit or cancel, then test deletion with the confirmation dialog.

## Deployment

For an HTTPS static frontend, import the public repository in Vercel with root directory `frontend`, build command `npm run build` and output `dist`. Set both Vite URLs before building. Browser deep links are handled by `frontend/vercel.json`.

For a container host, use the `backend` build context and Dockerfile, expose HTTP port 8000 through a TLS ingress that supports WebSocket upgrades, set the exact frontend HTTPS origin in `CORS_ORIGINS`, and supply the MySQL 8 connection via a secret. Keep the database private. Use a single Uvicorn worker to avoid loading a separate model per worker. Allocate memory for cold model load as well as steady-state inference. Set up a persistent model cache when supported. Verify health, Swagger, all three language modes, CRUD and persistence on the deployed domain.

On an existing free VM with enough RAM, run the bundled MySQL and backend services with Compose and put a TLS reverse proxy in front of port 8000. The frontend can be deployed independently with Vercel. Microphone access requires HTTPS or loopback. Only select resources covered by the provider's free allowance.

## Operational limits

- The assignment has one shared workspace. Anyone with access can read, edit and delete the saved records. Use non-sensitive demo recordings on public instances.
- Two live sessions share one CPU inference worker. Slow CPUs may take longer than the spoken audio. A session is limited to 30 minutes.
- Short utterances, accents, noise and Hindi/English switches can produce missed words, substitutions or transliteration. Review the text before saving. Forced language selection helps monolingual sessions.
- Recognition uses overlapping finite windows. Timestamp jitter can still produce word-boundary errors. Audio is transient; disconnected sessions retain only text already received by the browser.
- A browser must support one of the accepted MediaRecorder formats. This project stores transcripts and metadata only. It has no audio playback archive.
- Codespaces is a temporary development preview. A permanent URL requires a provisioned backend and database.
