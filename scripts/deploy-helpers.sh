#!/bin/bash

# MindScript Deployment Helper Scripts
# Usage: ./scripts/deploy-helpers.sh [command] [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load environment variables if .env exists
if [ -f "$PROJECT_ROOT/.env" ]; then
  export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | xargs)
fi

# Helper functions
log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
  log_info "Checking prerequisites..."

  # Check Node.js version
  if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed"
    exit 1
  fi

  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -lt 18 ]; then
    log_error "Node.js version 18 or higher is required"
    exit 1
  fi

  # Check npm
  if ! command -v npm &> /dev/null; then
    log_error "npm is not installed"
    exit 1
  fi

  # Check Vercel CLI
  if ! command -v vercel &> /dev/null; then
    log_warn "Vercel CLI not installed. Installing..."
    npm install -g vercel
  fi

  # Check Supabase CLI
  if ! command -v supabase &> /dev/null; then
    log_warn "Supabase CLI not installed. Please install from https://supabase.com/docs/guides/cli"
    exit 1
  fi

  log_info "Prerequisites check passed ✓"
}

# Pre-deployment checks
pre_deploy_checks() {
  local environment=$1
  log_info "Running pre-deployment checks for $environment..."

  # Run tests
  log_info "Running tests..."
  npm run test || {
    log_error "Tests failed"
    exit 1
  }

  # Type checking
  log_info "Running type checks..."
  npm run typecheck || {
    log_error "Type checking failed"
    exit 1
  }

  # Linting
  log_info "Running linter..."
  npm run lint || {
    log_error "Linting failed"
    exit 1
  }

  # Build check
  log_info "Running build..."
  npm run build || {
    log_error "Build failed"
    exit 1
  }

  # Security audit
  log_info "Running security audit..."
  npm audit --audit-level=high || {
    log_warn "Security vulnerabilities found"
    read -p "Continue with deployment? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  }

  log_info "Pre-deployment checks passed ✓"
}

# Deploy to Vercel
deploy_vercel() {
  local app=$1
  local environment=$2

  log_info "Deploying $app to Vercel ($environment)..."

  cd "$PROJECT_ROOT/apps/$app"

  if [ "$environment" == "production" ]; then
    vercel deploy --prod --token=$VERCEL_TOKEN
  else
    vercel deploy --token=$VERCEL_TOKEN
  fi

  cd "$PROJECT_ROOT"
  log_info "Vercel deployment completed ✓"
}

# Deploy Edge Functions
deploy_edge_functions() {
  local environment=$1

  log_info "Deploying Edge Functions to Supabase ($environment)..."

  if [ "$environment" == "production" ]; then
    PROJECT_REF=$SUPABASE_PROJECT_ID_PROD
  else
    PROJECT_REF=$SUPABASE_PROJECT_ID_DEV
  fi

  # Deploy each function
  for dir in "$PROJECT_ROOT"/supabase/functions/*/; do
    if [ -f "$dir/index.ts" ]; then
      function_name=$(basename "$dir")
      log_info "Deploying function: $function_name"
      supabase functions deploy "$function_name" \
        --project-ref "$PROJECT_REF" \
        --no-verify-jwt
    fi
  done

  log_info "Edge Functions deployment completed ✓"
}

# Run database migrations
run_migrations() {
  local environment=$1

  log_info "Running database migrations ($environment)..."

  if [ "$environment" == "production" ]; then
    DB_URL=$DATABASE_URL_PROD
    read -p "⚠️  Are you sure you want to run migrations on PRODUCTION? Type 'yes' to confirm: " confirm
    if [ "$confirm" != "yes" ]; then
      log_info "Migration cancelled"
      return
    fi
  else
    DB_URL=$DATABASE_URL_DEV
  fi

  # Run migrations
  supabase db push --db-url "$DB_URL" --include-all

  log_info "Migrations completed ✓"
}

# Create database backup
backup_database() {
  local environment=$1

  log_info "Creating database backup ($environment)..."

  if [ "$environment" == "production" ]; then
    DB_URL=$DATABASE_URL_PROD
  else
    DB_URL=$DATABASE_URL_DEV
  fi

  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_FILE="backup_${environment}_${TIMESTAMP}.sql"

  supabase db dump --db-url "$DB_URL" -f "$BACKUP_FILE"
  gzip "$BACKUP_FILE"

  log_info "Backup created: ${BACKUP_FILE}.gz"
}

# Health check
health_check() {
  local environment=$1

  log_info "Running health checks ($environment)..."

  if [ "$environment" == "production" ]; then
    WEB_URL="https://mindscript.app"
    ADMIN_URL="https://admin.mindscript.app"
  else
    WEB_URL="https://staging.mindscript.app"
    ADMIN_URL="https://admin-staging.mindscript.app"
  fi

  # Check web app
  WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$WEB_URL/api/health")
  if [ "$WEB_STATUS" == "200" ]; then
    log_info "Web app: ✓ Healthy"
  else
    log_error "Web app: ✗ Unhealthy (Status: $WEB_STATUS)"
  fi

  # Check admin app
  ADMIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$ADMIN_URL/api/health")
  if [ "$ADMIN_STATUS" == "200" ]; then
    log_info "Admin app: ✓ Healthy"
  else
    log_error "Admin app: ✗ Unhealthy (Status: $ADMIN_STATUS)"
  fi

  # Check Edge Functions
  if [ "$environment" == "production" ]; then
    EDGE_URL="https://$SUPABASE_PROJECT_ID_PROD.supabase.co/functions/v1/health"
  else
    EDGE_URL="https://$SUPABASE_PROJECT_ID_DEV.supabase.co/functions/v1/health"
  fi

  EDGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$EDGE_URL")
  if [ "$EDGE_STATUS" == "200" ]; then
    log_info "Edge Functions: ✓ Healthy"
  else
    log_error "Edge Functions: ✗ Unhealthy (Status: $EDGE_STATUS)"
  fi
}

# Rollback deployment
rollback() {
  local environment=$1
  local commit=$2

  log_warn "Starting rollback to commit $commit for $environment..."

  read -p "⚠️  This will rollback the deployment. Are you sure? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Rollback cancelled"
    exit 0
  fi

  # Create backup first
  backup_database "$environment"

  # Checkout target commit
  git checkout "$commit"

  # Rebuild and deploy
  npm ci
  npm run build

  # Deploy apps
  deploy_vercel "web" "$environment"
  deploy_vercel "admin" "$environment"
  deploy_edge_functions "$environment"

  # Return to original branch
  git checkout -

  log_info "Rollback completed ✓"
}

# Sync environment variables
sync_env_vars() {
  local source=$1
  local target=$2

  log_info "Syncing environment variables from $source to $target..."

  # Pull env vars from source
  vercel env pull .env."$source" --environment="$source" --token=$VERCEL_TOKEN

  # Push to target
  while IFS= read -r line; do
    if [[ ! "$line" =~ ^# ]] && [[ -n "$line" ]]; then
      key=$(echo "$line" | cut -d'=' -f1)
      value=$(echo "$line" | cut -d'=' -f2-)
      vercel env add "$key" "$target" --token=$VERCEL_TOKEN <<< "$value"
    fi
  done < .env."$source"

  log_info "Environment variables synced ✓"
}

# Clear cache
clear_cache() {
  local environment=$1

  log_info "Clearing cache for $environment..."

  # Clear Vercel cache
  log_info "Clearing Vercel build cache..."
  vercel --scope=$VERCEL_ORG_ID --token=$VERCEL_TOKEN cache rm

  # Clear Turbo cache
  log_info "Clearing Turbo cache..."
  rm -rf node_modules/.cache/turbo

  # Clear Next.js cache
  log_info "Clearing Next.js cache..."
  rm -rf apps/web/.next/cache
  rm -rf apps/admin/.next/cache

  log_info "Cache cleared ✓"
}

# Main command handler
case "$1" in
  check)
    check_prerequisites
    ;;
  pre-deploy)
    pre_deploy_checks "${2:-staging}"
    ;;
  deploy-web)
    deploy_vercel "web" "${2:-staging}"
    ;;
  deploy-admin)
    deploy_vercel "admin" "${2:-staging}"
    ;;
  deploy-edge)
    deploy_edge_functions "${2:-staging}"
    ;;
  deploy-all)
    environment="${2:-staging}"
    pre_deploy_checks "$environment"
    deploy_vercel "web" "$environment"
    deploy_vercel "admin" "$environment"
    deploy_edge_functions "$environment"
    health_check "$environment"
    ;;
  migrate)
    run_migrations "${2:-staging}"
    ;;
  backup)
    backup_database "${2:-staging}"
    ;;
  health)
    health_check "${2:-staging}"
    ;;
  rollback)
    if [ -z "$2" ] || [ -z "$3" ]; then
      log_error "Usage: $0 rollback [environment] [commit]"
      exit 1
    fi
    rollback "$2" "$3"
    ;;
  sync-env)
    if [ -z "$2" ] || [ -z "$3" ]; then
      log_error "Usage: $0 sync-env [source] [target]"
      exit 1
    fi
    sync_env_vars "$2" "$3"
    ;;
  clear-cache)
    clear_cache "${2:-staging}"
    ;;
  *)
    echo "MindScript Deployment Helper"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  check              Check prerequisites"
    echo "  pre-deploy [env]   Run pre-deployment checks"
    echo "  deploy-web [env]   Deploy web app to Vercel"
    echo "  deploy-admin [env] Deploy admin app to Vercel"
    echo "  deploy-edge [env]  Deploy Edge Functions to Supabase"
    echo "  deploy-all [env]   Deploy all applications"
    echo "  migrate [env]      Run database migrations"
    echo "  backup [env]       Create database backup"
    echo "  health [env]       Run health checks"
    echo "  rollback [env] [commit] Rollback to specific commit"
    echo "  sync-env [src] [dst] Sync environment variables"
    echo "  clear-cache [env]  Clear all caches"
    echo ""
    echo "Environments: staging (default), production"
    echo ""
    echo "Examples:"
    echo "  $0 check"
    echo "  $0 deploy-all staging"
    echo "  $0 backup production"
    echo "  $0 rollback production abc123f"
    exit 0
    ;;
esac