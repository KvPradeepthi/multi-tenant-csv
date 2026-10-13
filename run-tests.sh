#!/usr/bin/env sh
set -eu

npm ci
docker compose up -d --build

cleanup() {
  docker compose down
}
trap cleanup EXIT INT TERM

attempt=0
API_PORT="${API_PORT:-3002}"
DB_PORT="${DB_PORT:-5433}"
until curl --fail --silent "http://localhost:${API_PORT}/health" >/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "API did not become healthy" >&2
    exit 1
  fi
  sleep 2
done

DATABASE_URL="${DATABASE_URL:-postgres://app:app_password@localhost:${DB_PORT}/tenant_reports}" \
JWT_SECRET="${JWT_SECRET:-replace-with-a-long-random-secret}" \
npm run test:isolation
