#!/bin/bash

# =============================================================================
# SCOGO AI DEPLOYMENT VALIDATION SCRIPT
# =============================================================================
# Validates that all services are properly deployed and operational
#
# Usage:
#   ./scripts/validate-deployment.sh [environment]
#
# Arguments:
#   environment - Optional: development (default), staging, or production
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-development}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
  export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

# Default values
BACKEND_BASE_URL="${BACKEND_BASE_URL:-http://localhost:4000}"
TIMEOUT=10

# Validation results
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNINGS=0

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
  echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

print_check() {
  echo -e "${BLUE}▶${NC} Checking: $1"
}

print_success() {
  echo -e "${GREEN}✓${NC} $1"
  ((CHECKS_PASSED++))
}

print_failure() {
  echo -e "${RED}✗${NC} $1"
  ((CHECKS_FAILED++))
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
  ((CHECKS_WARNINGS++))
}

print_info() {
  echo -e "  ${NC}ℹ${NC} $1"
}

check_command() {
  if command -v "$1" &> /dev/null; then
    print_success "Command '$1' is available"
    return 0
  else
    print_failure "Command '$1' is not available"
    return 1
  fi
}

check_http_endpoint() {
  local url="$1"
  local expected_status="${2:-200}"
  local description="$3"

  print_check "$description"

  local response
  response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" 2>/dev/null)

  if [ "$response" = "$expected_status" ]; then
    print_success "HTTP $response - $description"
    return 0
  else
    print_failure "Expected HTTP $expected_status, got $response - $description"
    print_info "URL: $url"
    return 1
  fi
}

check_json_endpoint() {
  local url="$1"
  local jq_filter="$2"
  local expected_value="$3"
  local description="$4"

  print_check "$description"

  if ! command -v jq &> /dev/null; then
    print_warning "jq not installed - skipping JSON validation"
    return 0
  fi

  local response
  response=$(curl -s --max-time $TIMEOUT "$url" 2>/dev/null)

  if [ -z "$response" ]; then
    print_failure "No response from $url"
    return 1
  fi

  local actual_value
  actual_value=$(echo "$response" | jq -r "$jq_filter" 2>/dev/null)

  if [ "$actual_value" = "$expected_value" ]; then
    print_success "$description: $actual_value"
    return 0
  else
    print_failure "$description: expected '$expected_value', got '$actual_value'"
    print_info "Response: $response"
    return 1
  fi
}

check_env_var() {
  local var_name="$1"
  local description="$2"

  print_check "$description"

  if [ -n "${!var_name}" ]; then
    # Mask sensitive values
    if [[ "$var_name" =~ (SECRET|KEY|PASSWORD|TOKEN) ]]; then
      print_success "$var_name is set (value masked)"
    else
      print_success "$var_name = ${!var_name}"
    fi
    return 0
  else
    print_failure "$var_name is not set"
    return 1
  fi
}

# =============================================================================
# Validation Checks
# =============================================================================

print_header "SCOGO AI DEPLOYMENT VALIDATION - $ENVIRONMENT"

echo "Environment: $ENVIRONMENT"
echo "Backend URL: $BACKEND_BASE_URL"
echo "Project Root: $PROJECT_ROOT"
echo ""

# -----------------------------------------------------------------------------
# Check 1: Required Commands
# -----------------------------------------------------------------------------
print_header "1. Required Commands"

check_command "curl" || true
check_command "node" || true
check_command "npm" || true
check_command "docker" || true
check_command "docker-compose" || true

# -----------------------------------------------------------------------------
# Check 2: Environment Variables
# -----------------------------------------------------------------------------
print_header "2. Environment Variables"

check_env_var "NODE_ENV" "Node environment" || true
check_env_var "BACKEND_BASE_URL" "Backend base URL" || true
check_env_var "GOOGLE_OAUTH_CLIENT_ID" "Google OAuth client ID" || true
check_env_var "LIVEKIT_API_KEY" "LiveKit API key" || true
check_env_var "LIVEKIT_API_SECRET" "LiveKit API secret" || true
check_env_var "LIVEKIT_HOST" "LiveKit host URL" || true
check_env_var "GEMINI_API_KEY" "Gemini API key" || true

# -----------------------------------------------------------------------------
# Check 3: Backend Service
# -----------------------------------------------------------------------------
print_header "3. Backend Service"

check_http_endpoint "$BACKEND_BASE_URL/health" "200" "Backend health endpoint"

if command -v jq &> /dev/null; then
  check_json_endpoint "$BACKEND_BASE_URL/health" ".status" "ok" "Backend status"
  check_json_endpoint "$BACKEND_BASE_URL/health" ".environment" "$ENVIRONMENT" "Backend environment"
  check_json_endpoint "$BACKEND_BASE_URL/health" ".services.livekit.configured" "true" "LiveKit configured"
fi

# -----------------------------------------------------------------------------
# Check 4: API Documentation
# -----------------------------------------------------------------------------
print_header "4. API Documentation"

check_http_endpoint "$BACKEND_BASE_URL/api-docs.json" "200" "OpenAPI specification endpoint"

if command -v jq &> /dev/null; then
  OPENAPI_SPEC=$(curl -s --max-time $TIMEOUT "$BACKEND_BASE_URL/api-docs.json" 2>/dev/null)

  if [ -n "$OPENAPI_SPEC" ]; then
    ENDPOINT_COUNT=$(echo "$OPENAPI_SPEC" | jq '.paths | length' 2>/dev/null || echo "0")
    SCHEMA_COUNT=$(echo "$OPENAPI_SPEC" | jq '.components.schemas | length' 2>/dev/null || echo "0")

    if [ "$ENDPOINT_COUNT" -gt 0 ]; then
      print_success "API documentation has $ENDPOINT_COUNT endpoints documented"
    else
      print_warning "API documentation has no endpoints"
    fi

    if [ "$SCHEMA_COUNT" -gt 0 ]; then
      print_success "API documentation has $SCHEMA_COUNT schemas defined"
    else
      print_warning "API documentation has no schemas"
    fi
  fi
fi

check_http_endpoint "$BACKEND_BASE_URL/api-docs/" "200" "Swagger UI endpoint"

# -----------------------------------------------------------------------------
# Check 5: Backend API Endpoints
# -----------------------------------------------------------------------------
print_header "5. Backend API Endpoints"

check_http_endpoint "$BACKEND_BASE_URL/api/config" "200" "Client config endpoint"

# Token endpoint requires authentication, check for 401
print_check "LiveKit token endpoint (requires auth)"
TOKEN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$BACKEND_BASE_URL/api/token/livekit" -X POST -H "Content-Type: application/json" 2>/dev/null)
if [ "$TOKEN_RESPONSE" = "401" ]; then
  print_success "Token endpoint requires authentication (HTTP 401)"
else
  print_warning "Token endpoint returned HTTP $TOKEN_RESPONSE (expected 401)"
fi

# -----------------------------------------------------------------------------
# Check 6: Docker Containers (if Docker environment)
# -----------------------------------------------------------------------------
if [ "$ENVIRONMENT" != "development" ] && command -v docker &> /dev/null; then
  print_header "6. Docker Containers"

  print_check "Docker containers status"

  if docker ps --format "{{.Names}}" | grep -q "scogo"; then
    RUNNING_CONTAINERS=$(docker ps --filter "name=scogo" --format "{{.Names}}" | wc -l)
    print_success "$RUNNING_CONTAINERS Scogo containers running"

    # List containers
    echo ""
    echo "Running containers:"
    docker ps --filter "name=scogo" --format "  - {{.Names}} ({{.Status}})"
  else
    print_warning "No Scogo containers found running"
  fi
fi

# -----------------------------------------------------------------------------
# Check 7: Extension Build
# -----------------------------------------------------------------------------
print_header "7. Extension Build"

if [ -d "$PROJECT_ROOT/extension/dist" ]; then
  print_success "Extension dist directory exists"

  REQUIRED_FILES=(
    "extension/dist/manifest.json"
    "extension/dist/background.js"
    "extension/dist/popup/popup.html"
    "extension/dist/popup/popup.js"
  )

  for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$PROJECT_ROOT/$file" ]; then
      print_success "$file exists"
    else
      print_failure "$file is missing"
    fi
  done
else
  print_failure "Extension dist directory not found - run 'npm run build' in extension/"
fi

# -----------------------------------------------------------------------------
# Check 8: Security Configuration
# -----------------------------------------------------------------------------
print_header "8. Security Configuration"

# Check ALLOW_DEV_TOKENS setting
if [ "$ENVIRONMENT" = "production" ]; then
  if [ "$ALLOW_DEV_TOKENS" = "false" ] || [ -z "$ALLOW_DEV_TOKENS" ]; then
    print_success "Development tokens disabled in production"
  else
    print_failure "SECURITY RISK: Development tokens enabled in production (ALLOW_DEV_TOKENS=$ALLOW_DEV_TOKENS)"
  fi
fi

# Check NODE_ENV
if [ "$NODE_ENV" = "production" ] && [ "$ENVIRONMENT" = "production" ]; then
  print_success "NODE_ENV correctly set to production"
elif [ "$NODE_ENV" != "production" ] && [ "$ENVIRONMENT" != "production" ]; then
  print_success "NODE_ENV correctly set to $NODE_ENV"
else
  print_warning "NODE_ENV ($NODE_ENV) doesn't match ENVIRONMENT ($ENVIRONMENT)"
fi

# -----------------------------------------------------------------------------
# Check 9: Network Connectivity
# -----------------------------------------------------------------------------
print_header "9. Network Connectivity"

if [ -n "$LIVEKIT_HOST" ]; then
  # Extract host from wss:// URL
  LIVEKIT_DOMAIN=$(echo "$LIVEKIT_HOST" | sed 's|wss://||' | sed 's|/.*||')

  print_check "LiveKit host reachability"
  if curl -s --max-time 5 "https://$LIVEKIT_DOMAIN" > /dev/null 2>&1; then
    print_success "LiveKit host is reachable: $LIVEKIT_DOMAIN"
  else
    print_warning "LiveKit host may not be reachable: $LIVEKIT_DOMAIN"
  fi
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
print_header "VALIDATION SUMMARY"

TOTAL_CHECKS=$((CHECKS_PASSED + CHECKS_FAILED + CHECKS_WARNINGS))

echo -e "${GREEN}Passed:${NC}   $CHECKS_PASSED"
echo -e "${YELLOW}Warnings:${NC} $CHECKS_WARNINGS"
echo -e "${RED}Failed:${NC}   $CHECKS_FAILED"
echo -e "${BLUE}Total:${NC}    $TOTAL_CHECKS"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All critical checks passed!${NC}"

  if [ $CHECKS_WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠ There are $CHECKS_WARNINGS warnings to review${NC}"
  fi

  exit 0
else
  echo -e "${RED}✗ $CHECKS_FAILED checks failed!${NC}"
  echo -e "${YELLOW}Please fix the failures above before deploying${NC}"
  exit 1
fi
