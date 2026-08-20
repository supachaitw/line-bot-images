#!/usr/bin/env bash
# =============================================================================
#  deploy-local.sh — ซ้อมขั้นตอน deploy ของธนาคารบนเครื่อง local
#  ใช้รูปแบบคำสั่งเดียวกับ deploy-<env>.sh ของโครงการอื่นในธนาคาร
#
#  วิธีใช้:
#    IMAGE_TAG=v0.1.00 ./deploy-local.sh build-only
#    ./deploy-local.sh deploy-only v0.1.00
#    ./deploy-local.sh health
#    ./deploy-local.sh version
#    ./deploy-local.sh rollback v0.0.99
#    ./deploy-local.sh logs | down
# =============================================================================
set -euo pipefail

APP_PORT="${APP_PORT:-8802}"
IMAGE_REPO="${IMAGE_REPO:-tanachok-web}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.deploy.yml}"
STATE_DIR=".deploy-state"
cmd="${1:-help}"

log() { printf '[local] %s\n' "$*"; }
die() { printf '[local] ✖ %s\n' "$*" >&2; exit 1; }

require_tag() {
  [ -n "${1:-}" ] || die "ต้องระบุ tag — ห้ามใช้ latest (กติกาของธนาคาร)"
  case "$1" in
    v[0-9]*.[0-9]*.[0-9]*) : ;;
    *) die "รูปแบบ tag ไม่ถูกต้อง: $1 (ต้องเป็น vx.x.xx)" ;;
  esac
}

case "$cmd" in

  build-only)
    tag="${IMAGE_TAG:-}"; require_tag "$tag"
    sha="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
    log "build $IMAGE_REPO:$tag (commit $sha)"
    docker build \
      --build-arg "APP_VERSION=$tag" \
      --build-arg "GIT_SHA=$sha" \
      -f docker/Dockerfile.web \
      -t "$IMAGE_REPO:$tag" .
    log "✔ built $IMAGE_REPO:$tag"
    if [ -n "${REGISTRY:-}" ]; then
      docker tag "$IMAGE_REPO:$tag" "$REGISTRY/$IMAGE_REPO:$tag"
      docker push "$REGISTRY/$IMAGE_REPO:$tag"
      log "✔ pushed $REGISTRY/$IMAGE_REPO:$tag"
    fi
    ;;

  deploy-only)
    tag="${2:-${IMAGE_TAG:-}}"; require_tag "$tag"
    mkdir -p "$STATE_DIR"
    # เก็บ image เดิมไว้ก่อน เผื่อต้อง rollback
    docker inspect tanachok-web-local --format '{{.Config.Image}}' \
      > "$STATE_DIR/local.last-image" 2>/dev/null || true
    log "deploy $IMAGE_REPO:$tag -> port $APP_PORT"
    # restart semantics เท่านั้น — ห้ามใช้ --force-recreate (ข้อมูลใน volume จะหาย)
    IMAGE_REPO="$IMAGE_REPO" IMAGE_TAG="$tag" APP_PORT="$APP_PORT" \
      docker compose -f "$COMPOSE_FILE" up -d
    log "✔ deployed"
    ;;

  health)
    log "รอ health check ที่ http://localhost:$APP_PORT/healthz"
    for i in $(seq 1 30); do
      code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$APP_PORT/healthz" || true)"
      if [ "$code" = "200" ]; then log "✔ healthy (HTTP 200)"; exit 0; fi
      sleep 2
    done
    die "health check ไม่ผ่านภายใน 60 วินาที — ดู ./deploy-local.sh logs"
    ;;

  version)
    curl -sf "http://localhost:$APP_PORT/version" || die "เรียก /version ไม่สำเร็จ"
    echo
    ;;

  rollback)
    tag="${2:-}"
    if [ -z "$tag" ] && [ -f "$STATE_DIR/local.last-image" ]; then
      tag="$(sed 's/.*://' "$STATE_DIR/local.last-image")"
      log "ถอยกลับไป tag ก่อนหน้า: $tag"
    fi
    require_tag "$tag"
    IMAGE_REPO="$IMAGE_REPO" IMAGE_TAG="$tag" APP_PORT="$APP_PORT" \
      docker compose -f "$COMPOSE_FILE" up -d
    log "✔ rolled back to $tag"
    ;;

  logs) docker compose -f "$COMPOSE_FILE" logs --tail 100 -f ;;
  down) docker compose -f "$COMPOSE_FILE" down ;;

  *)
    sed -n '2,20p' "$0"
    ;;
esac
