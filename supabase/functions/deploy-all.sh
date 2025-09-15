#!/bin/bash

# Deploy all webhook Edge Functions to Supabase
# Usage: ./deploy-all.sh [--production]

set -e

ENVIRONMENT="staging"

if [ "$1" = "--production" ]; then
  ENVIRONMENT="production"
  echo "🚀 Deploying to PRODUCTION environment"
else
  echo "📦 Deploying to STAGING environment"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "\n${YELLOW}Starting webhook Edge Functions deployment...${NC}\n"

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "${RED}Error: Supabase CLI is not installed${NC}"
    echo "Install it with: brew install supabase/tap/supabase"
    exit 1
fi

# Deploy each function
FUNCTIONS=("stripe-webhook" "revenuecat-webhook" "resend-webhook")

for func in "${FUNCTIONS[@]}"; do
    echo "\n${YELLOW}Deploying ${func}...${NC}"
    
    if supabase functions deploy "$func" --no-verify-jwt; then
        echo "${GREEN}✓ ${func} deployed successfully${NC}"
    else
        echo "${RED}✗ Failed to deploy ${func}${NC}"
        exit 1
    fi
done

echo "\n${GREEN}✅ All webhook Edge Functions deployed successfully!${NC}\n"

# Set secrets reminder
echo "${YELLOW}⚠️  Don't forget to set the following secrets:${NC}"
echo "  - STRIPE_SECRET_KEY"
echo "  - STRIPE_WEBHOOK_SECRET"
echo "  - REVENUECAT_WEBHOOK_AUTH_TOKEN"
echo "  - RESEND_WEBHOOK_SECRET"
echo "\nUse: supabase secrets set KEY=value\n"

# Webhook endpoint URLs
echo "${GREEN}Webhook Endpoints:${NC}"
echo "  Stripe:     https://<project-ref>.supabase.co/functions/v1/stripe-webhook"
echo "  RevenueCat: https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook"
echo "  Resend:     https://<project-ref>.supabase.co/functions/v1/resend-webhook"
echo ""