#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/fun-ai-agent}"
SERVICE_NAME="${SERVICE_NAME:-fun-ai-agent-web}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-main}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000}"
HEALTH_RETRIES="${HEALTH_RETRIES:-30}"
HEALTH_WAIT_SECONDS="${HEALTH_WAIT_SECONDS:-2}"
NPM_CMD="${NPM_CMD:-npm}"
MIN_NODE_MAJOR="${MIN_NODE_MAJOR:-20}"

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "ERROR: APP_DIR is invalid: ${APP_DIR}"
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git not found"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found"
  exit 1
fi

if ! command -v "${NPM_CMD}" >/dev/null 2>&1; then
  echo "ERROR: npm not found (NPM_CMD=${NPM_CMD})"
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "ERROR: systemctl not found"
  exit 1
fi

node_major="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
if [[ -z "${node_major}" ]]; then
  echo "ERROR: cannot detect Node.js version"
  exit 1
fi
if (( node_major < MIN_NODE_MAJOR )); then
  echo "ERROR: Node.js $(node -v) is too old, require >= v${MIN_NODE_MAJOR}"
  exit 1
fi

cd "${APP_DIR}"

echo "[1/5] Pull latest code from ${GIT_REMOTE}/${GIT_BRANCH}"
git fetch "${GIT_REMOTE}" "${GIT_BRANCH}"
git checkout "${GIT_BRANCH}"
git pull --ff-only "${GIT_REMOTE}" "${GIT_BRANCH}"

echo "[2/5] Install dependencies"
"${NPM_CMD}" ci

echo "[3/5] Build frontend"
"${NPM_CMD}" run build

echo "[4/5] Restart service ${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

echo "[5/5] Health check ${HEALTH_URL}"
for ((i=1; i<=HEALTH_RETRIES; i++)); do
  if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
    echo "SUCCESS: ${SERVICE_NAME} is healthy"
    systemctl --no-pager --full status "${SERVICE_NAME}" | head -n 20
    exit 0
  fi
  sleep "${HEALTH_WAIT_SECONDS}"
done

echo "ERROR: health check failed after ${HEALTH_RETRIES} retries"
systemctl --no-pager --full status "${SERVICE_NAME}" || true
journalctl -u "${SERVICE_NAME}" -n 100 --no-pager || true
exit 1
