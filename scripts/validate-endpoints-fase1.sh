#!/usr/bin/env bash
#
# validate-endpoints-fase1.sh
# Verifica que los 7 endpoints requeridos por Fase Frontend 1 existen y
# responden con los códigos esperados. Resultado se imprime en consola y se
# guarda en logs/validation-fase1-<timestamp>.log.
#
# Pre-requisitos:
#   1. Backend levantado en BASE_URL (default: http://localhost:8500/api/v1).
#   2. Usuario seed creado (Paso 16). El script usa SEED_USERNAME / SEED_PASSWORD
#      del entorno o de un archivo .env-seed adyacente.
#
# Uso:
#   ./scripts/validate-endpoints-fase1.sh
#   BASE_URL=http://otro:8500/api/v1 ./scripts/validate-endpoints-fase1.sh
#
# Estrategia:
#   - Endpoints públicos: probamos directo.
#   - Endpoints autenticados: hacemos login primero, capturamos access/refresh
#     y los usamos para los siguientes calls.

set -u  # error si referenciamos variable no definida (mejor para CI)

BASE_URL="${BASE_URL:-http://localhost:8500/api/v1}"
SEED_USERNAME="${SEED_USERNAME:-}"
SEED_PASSWORD="${SEED_PASSWORD:-}"

# Cargar .env-seed si existe (para no exponer creds en CLI history)
if [ -f ".env-seed" ]; then
  # shellcheck disable=SC1091
  set -a; source .env-seed; set +a
fi

TS=$(date +%Y%m%d-%H%M%S)
LOG_DIR="logs"
LOG_FILE="${LOG_DIR}/validation-fase1-${TS}.log"
mkdir -p "${LOG_DIR}"

pass_count=0
fail_count=0
warn_count=0

# Helpers ---------------------------------------------------------------------

log() {
  echo -e "$*" | tee -a "${LOG_FILE}"
}

pass() {
  log "  ✅ $*"
  pass_count=$((pass_count + 1))
}

fail() {
  log "  ❌ $*"
  fail_count=$((fail_count + 1))
}

warn() {
  log "  ⚠️  $*"
  warn_count=$((warn_count + 1))
}

# Devuelve solo el HTTP status code de un curl, sin tocar stdout/stderr del cuerpo.
http_status() {
  curl -s -o /dev/null -w "%{http_code}" "$@"
}

# Devuelve cuerpo de respuesta (para parsear JSON luego).
http_body() {
  curl -s "$@"
}

# Banner ---------------------------------------------------------------------

log "================================================================"
log " Validación endpoints Fase Frontend 1 — ${TS}"
log " BASE_URL: ${BASE_URL}"
log "================================================================"

# 1. Sanity check: /api/schema/ accesible (drf-spectacular) -------------------
log ""
log "[0/7] Sanity check: /api/schema/ (OpenAPI)"
SCHEMA_URL="${BASE_URL%/api/v1}/api/schema/"
status=$(http_status -X GET "${SCHEMA_URL}" -H 'Accept: application/json')
if [ "${status}" = "200" ]; then
  pass "GET ${SCHEMA_URL} → 200 (schema OpenAPI disponible)"
else
  fail "GET ${SCHEMA_URL} → ${status} (esperado 200). Sin schema no podemos correr npm run types:gen."
fi

# 2. POST /auth/login/ (pública) ---------------------------------------------
log ""
log "[1/7] POST /auth/login/"
if [ -z "${SEED_USERNAME}" ] || [ -z "${SEED_PASSWORD}" ]; then
  warn "SEED_USERNAME / SEED_PASSWORD no definidos. Crear .env-seed o exportar antes de correr."
  warn "Skip endpoints autenticados. Sólo se valida que /auth/login/ rechaza credenciales vacías con 400/401."
  status=$(http_status -X POST "${BASE_URL}/auth/login/" \
    -H 'Content-Type: application/json' \
    -d '{}')
  if [ "${status}" = "400" ] || [ "${status}" = "401" ]; then
    pass "POST /auth/login/ con body vacío → ${status} (endpoint responde)"
  else
    fail "POST /auth/login/ con body vacío → ${status} (esperado 400/401)"
  fi
  ACCESS_TOKEN=""
  REFRESH_TOKEN=""
else
  LOGIN_BODY=$(http_body -X POST "${BASE_URL}/auth/login/" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${SEED_USERNAME}\",\"password\":\"${SEED_PASSWORD}\"}")
  if echo "${LOGIN_BODY}" | grep -q '"access"'; then
    pass "POST /auth/login/ → 200 con tokens access + refresh"
    ACCESS_TOKEN=$(echo "${LOGIN_BODY}" | grep -o '"access":"[^"]*"' | cut -d'"' -f4)
    REFRESH_TOKEN=$(echo "${LOGIN_BODY}" | grep -o '"refresh":"[^"]*"' | cut -d'"' -f4)
    # NOTA: el backend retorna solo {access, refresh}. Los campos 'user' y
    # 'requires_password_change' viajan en el payload JWT y se leen via
    # GET /users/me/ (verificado en paso [3/7]).
    pass "  Tokens access y refresh presentes (user_data se lee via /users/me/)"
  else
    fail "POST /auth/login/ con seed credentials no devolvió tokens. Body: ${LOGIN_BODY}"
    ACCESS_TOKEN=""
    REFRESH_TOKEN=""
  fi
fi

# Si no tenemos token, saltamos los autenticados
if [ -z "${ACCESS_TOKEN}" ]; then
  log ""
  warn "Sin ACCESS_TOKEN no se pueden validar endpoints autenticados (2/7 a 7/7). Saltando."
  log ""
  log "================================================================"
  log "Resumen: ${pass_count} pass · ${fail_count} fail · ${warn_count} warn"
  log "================================================================"
  exit 1
fi

AUTH_HEADER="Authorization: Bearer ${ACCESS_TOKEN}"

# 3. POST /auth/refresh/ -----------------------------------------------------
log ""
log "[2/7] POST /auth/refresh/"
# Una sola llamada: cuerpo en stdout, status en stderr usando formato combinado.
REFRESH_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/refresh/" \
  -H 'Content-Type: application/json' \
  -d "{\"refresh\":\"${REFRESH_TOKEN}\"}")
REFRESH_STATUS=$(echo "${REFRESH_RESPONSE}" | tail -n1)
REFRESH_BODY=$(echo "${REFRESH_RESPONSE}" | head -n-1)
if [ "${REFRESH_STATUS}" = "200" ]; then
  pass "POST /auth/refresh/ → 200"
  # simplejwt rotate_refresh_tokens=True: el token anterior queda inválido.
  # Capturar el nuevo refresh para usarlo en logout (paso [7/7]).
  NEW_REFRESH=$(echo "${REFRESH_BODY}" | grep -o '"refresh":"[^"]*"' | cut -d'"' -f4)
  if [ -n "${NEW_REFRESH}" ]; then
    REFRESH_TOKEN="${NEW_REFRESH}"
    pass "  Nuevo refresh token capturado (rotation activa)"
  fi
else
  fail "POST /auth/refresh/ → ${REFRESH_STATUS} (esperado 200)"
fi

# 4. GET /users/me/ ----------------------------------------------------------
log ""
log "[3/7] GET /users/me/"
ME_BODY=$(http_body -X GET "${BASE_URL}/users/me/" -H "${AUTH_HEADER}")
ME_STATUS=$(http_status -X GET "${BASE_URL}/users/me/" -H "${AUTH_HEADER}")
if [ "${ME_STATUS}" = "200" ]; then
  pass "GET /users/me/ → 200"
  for field in id username email user_role datacentrals; do
    if echo "${ME_BODY}" | grep -q "\"${field}\""; then
      pass "  Response incluye '${field}'"
    else
      fail "  Response NO incluye '${field}' — esperado por product-doc Paso 1.3"
    fi
  done
else
  fail "GET /users/me/ → ${ME_STATUS} (esperado 200)"
fi

# 5. GET /organizations/data-centrals-main/ ----------------------------------
log ""
log "[4/7] GET /organizations/data-centrals-main/"
status=$(http_status -X GET "${BASE_URL}/organizations/data-centrals-main/" -H "${AUTH_HEADER}")
if [ "${status}" = "200" ]; then
  pass "GET /organizations/data-centrals-main/ → 200"
else
  fail "GET /organizations/data-centrals-main/ → ${status} (esperado 200)"
fi

# 6. GET /organizations/datacentrals/ ----------------------------------------
log ""
log "[5/7] GET /organizations/datacentrals/"
status=$(http_status -X GET "${BASE_URL}/organizations/datacentrals/" -H "${AUTH_HEADER}")
if [ "${status}" = "200" ]; then
  pass "GET /organizations/datacentrals/ → 200 (sin filtro)"
else
  fail "GET /organizations/datacentrals/ → ${status} (esperado 200)"
fi

# 7. POST /auth/change-password/ ---------------------------------------------
log ""
log "[6/7] POST /auth/change-password/ (probamos con body inválido para no cambiar la pwd)"
status=$(http_status -X POST "${BASE_URL}/auth/change-password/" \
  -H "${AUTH_HEADER}" \
  -H 'Content-Type: application/json' \
  -d '{}')
if [ "${status}" = "400" ]; then
  pass "POST /auth/change-password/ con body vacío → 400 (endpoint existe y valida input)"
else
  warn "POST /auth/change-password/ con body vacío → ${status} (esperado 400). Verificar manualmente."
fi

# 8. POST /auth/logout/ (al final, invalida el refresh) ----------------------
log ""
log "[7/7] POST /auth/logout/"
status=$(http_status -X POST "${BASE_URL}/auth/logout/" \
  -H "${AUTH_HEADER}" \
  -H 'Content-Type: application/json' \
  -d "{\"refresh\":\"${REFRESH_TOKEN}\"}")
if [ "${status}" = "205" ] || [ "${status}" = "200" ] || [ "${status}" = "204" ]; then
  pass "POST /auth/logout/ → ${status} (refresh blacklisted)"
else
  fail "POST /auth/logout/ → ${status} (esperado 205, 200 o 204)"
fi

# Resumen final --------------------------------------------------------------
log ""
log "================================================================"
log " Resumen Fase Frontend 1: ${pass_count} pass · ${fail_count} fail · ${warn_count} warn"
log " Log completo guardado en ${LOG_FILE}"
log "================================================================"

if [ "${fail_count}" -gt 0 ]; then
  exit 1
fi
exit 0
