#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${FLASHPOINT_IMAGEGEN_ENV_FILE:-$REPO_ROOT/.env.local}"
ALLOW_DRY_RUN=0

for arg in "$@"; do
  if [ "$arg" = "--dry-run" ]; then
    ALLOW_DRY_RUN=1
    break
  fi
done

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [ -z "${OPENAI_API_KEY:-}" ] && [ "$ALLOW_DRY_RUN" -ne 1 ]; then
  cat >&2 <<EOF
OPENAI_API_KEY is not set for Flashpoint image generation.

Create a gitignored env file at:
  $ENV_FILE

Add:
  OPENAI_API_KEY=your_key_here

Then rerun this script.
EOF
  exit 1
fi

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
IMAGE_GEN="${IMAGE_GEN:-$CODEX_HOME/skills/imagegen/scripts/image_gen.py}"
export UV_CACHE_DIR="${UV_CACHE_DIR:-$REPO_ROOT/tmp/uv-cache}"

if [ ! -f "$IMAGE_GEN" ]; then
  cat >&2 <<EOF
Bundled image generation CLI not found at:
  $IMAGE_GEN

Expected shared skill path:
  \$CODEX_HOME/skills/imagegen/scripts/image_gen.py
EOF
  exit 1
fi

mkdir -p "$REPO_ROOT/output/imagegen" "$REPO_ROOT/tmp/imagegen" "$UV_CACHE_DIR"
cd "$REPO_ROOT"

if [ "$ALLOW_DRY_RUN" -eq 1 ]; then
  exec python3 "$IMAGE_GEN" "$@"
fi

if command -v uv >/dev/null 2>&1; then
  exec uv run --with openai --with pillow python "$IMAGE_GEN" "$@"
fi

exec python3 "$IMAGE_GEN" "$@"
