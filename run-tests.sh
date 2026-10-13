#!/usr/bin/env sh
set -eu

npm ci
docker compose up -d --build

cleanup() {
  docker compose down
}
trap cleanup EXIT INT TERM

attempt=0
until curl --fail --silent http://localhost:3000/health >/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "API did not become healthy" >&2
    exit 1
  fi
  sleep 2
done

DATABASE_URL=postgres://app:app_password@localhost:5432/tenant_reports \
JWT_SECRET=replace-with-a-long-random-secret \
npm run test:isolation