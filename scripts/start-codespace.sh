#!/usr/bin/env bash
set -eu
if [[ -n "${CODESPACE_NAME:-}" ]]; then
  export FRONTEND_HOST="${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  export CORS_ORIGINS="https://${FRONTEND_HOST},http://localhost:5173"
fi
docker compose up --build -d
