#!/usr/bin/env bash
set -uo pipefail

STAGE_DIR="/tmp/backend-stage"
TARGET_CLASSES="/app/target/classes"
TRIGGER_FILE="${TARGET_CLASSES}/.reloadtrigger"
CLASSES_CHANGED=0
UPDATED_COUNT=0

snapshot_sources() {
  {
    stat -c '%Y %s %n' /app/pom.xml 2>/dev/null || true
    find /app/src/main -type f -not -name '*.swp' -not -name '*~' -printf '%T@ %s %p\n' 2>/dev/null | sort
  } | md5sum | awk '{print $1}'
}

snapshot_pom() {
  stat -c '%Y %s' /app/pom.xml 2>/dev/null || echo ""
}

sync_sources_to_stage() {
  mkdir -p "${STAGE_DIR}/src"
  cp -f /app/pom.xml "${STAGE_DIR}/pom.xml"
  rm -rf "${STAGE_DIR}/src/main"
  cp -a /app/src/main "${STAGE_DIR}/src/main"
}

compile_stage() {
  local allow_online="${1:-0}"
  if [ "${allow_online}" -eq 1 ]; then
    (cd "${STAGE_DIR}" && mvn -q compile)
  else
    (cd "${STAGE_DIR}" && mvn -q compile -o) || (cd "${STAGE_DIR}" && mvn -q compile)
  fi
}

sync_classes_from_stage() {
  local stage_classes="${STAGE_DIR}/target/classes"
  CLASSES_CHANGED=0
  UPDATED_COUNT=0
  mkdir -p "${TARGET_CLASSES}"

  while IFS= read -r -d '' src_file; do
    local rel="${src_file#${stage_classes}/}"
    local dst_file="${TARGET_CLASSES}/${rel}"
    if [ ! -f "${dst_file}" ] || ! cmp -s "${src_file}" "${dst_file}"; then
      local tmp_file="${dst_file}.tmp.$$"
      mkdir -p "$(dirname "${dst_file}")"
      cp -p "${src_file}" "${tmp_file}" && mv -f "${tmp_file}" "${dst_file}"
      CLASSES_CHANGED=1
      UPDATED_COUNT=$((UPDATED_COUNT + 1))
    fi
  done < <(find "${stage_classes}" -type f -print0)

  while IFS= read -r -d '' dst_file; do
    local rel="${dst_file#${TARGET_CLASSES}/}"
    case "${rel}" in
      .reloadtrigger|*.tmp.*) continue ;;
    esac
    if [ ! -e "${stage_classes}/${rel}" ]; then
      rm -f "${dst_file}"
      CLASSES_CHANGED=1
      UPDATED_COUNT=$((UPDATED_COUNT + 1))
    fi
  done < <(find "${TARGET_CLASSES}" -type f -print0)
}

echo "[backend-dev] Running initial staged Maven compile..."
find "${TARGET_CLASSES}" -type f -name '*.tmp.*' -delete 2>/dev/null || true
LAST_HASH="$(snapshot_sources)"
LAST_POM="$(snapshot_pom)"
sync_sources_to_stage
if compile_stage 1; then
  sync_classes_from_stage
fi
date +%s%N > "${TRIGGER_FILE}"

APP_PID=""
WATCHER_PID=""

cleanup() {
  echo "[backend-dev] Stopping backend dev runner..."
  [ -n "${WATCHER_PID}" ] && kill "${WATCHER_PID}" 2>/dev/null || true
  [ -n "${APP_PID}" ] && kill "${APP_PID}" 2>/dev/null || true
  wait 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

watch_loop() {
  while true; do
    sleep 2
    CUR_HASH="$(snapshot_sources)"
    if [ "${CUR_HASH}" != "${LAST_HASH}" ]; then
      CUR_POM="$(snapshot_pom)"
      local pom_changed=0
      [ "${CUR_POM}" != "${LAST_POM}" ] && pom_changed=1

      echo "[backend-dev] Change detected -> compiling in staging..."
      sync_sources_to_stage
      if compile_stage "${pom_changed}"; then
        sync_classes_from_stage
        if [ "${pom_changed}" -eq 1 ]; then
          echo "[backend-dev] pom.xml updated; recreate container ('docker compose up -d --build backend') if dependencies changed."
        fi
        if [ "${CLASSES_CHANGED}" -eq 1 ]; then
          date +%s%N > "${TRIGGER_FILE}"
          echo "[backend-dev] Compile OK (${UPDATED_COUNT} file(s) synced) -> DevTools reloading..."
        else
          echo "[backend-dev] Compile OK (no bytecode/resource changes; reload skipped)."
        fi
      else
        echo "[backend-dev] Compile failed; active classes preserved. Fix errors and save again."
      fi
      LAST_HASH="${CUR_HASH}"
      LAST_POM="${CUR_POM}"
    fi
  done
}

watch_loop &
WATCHER_PID=$!

echo "[backend-dev] Starting Spring Boot on port 8080 (DevTools live reload enabled)..."
mvn -Dmaven.test.skip=true -Dmaven.compiler.skip=true -Dmaven.resources.skip=true spring-boot:run &
APP_PID=$!

wait "${APP_PID}"
EXIT_CODE=$?
cleanup
exit "${EXIT_CODE}"
