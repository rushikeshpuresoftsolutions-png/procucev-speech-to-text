#!/usr/bin/env bash
# Exercise the actual published ports and database after recreating all containers.
set -euo pipefail
docker compose up --build --wait --wait-timeout 240
base=http://127.0.0.1:5173
for _ in {1..30}; do curl -fsS "$base/api/health" >/dev/null && break; sleep 1; done
curl -fsS "$base/" | grep -q 'Speech Studio'
curl -fsS "$base/api/health" | jq -e '.database == "connected"'
curl -fsS http://localhost:8000/docs >/dev/null
row=$(curl -fsS -X POST "$base/api/transcriptions" -H 'Content-Type: application/json' \
  -d '{"title":"Compose persistence check","content":"आज we test the studio","language":"mixed","duration":4.25}')
id=$(jq -er '.id' <<< "$row")
docker compose down
docker compose up -d --wait --wait-timeout 240
for _ in {1..30}; do curl -fsS "$base/api/health" >/dev/null && break; sleep 1; done
curl -fsS "$base/api/transcriptions/$id" | jq -e '.content == "आज we test the studio"'
curl -fsS -X DELETE "$base/api/transcriptions/$id"
docker compose ps
