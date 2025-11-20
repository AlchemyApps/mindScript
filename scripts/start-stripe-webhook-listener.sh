#!/usr/bin/env bash

# Helper script to start the Stripe CLI webhook listener for local development.
# The command prints a webhook signing secret (whsec_...) you must copy into
# your .env.local as STRIPE_WEBHOOK_SECRET before starting the Next.js server.

set -euo pipefail

FORWARD_URL="http://localhost:3001/api/webhooks/stripe"
EVENTS="checkout.session.completed,payment_intent.succeeded,payment_intent.payment_failed"

echo "Starting Stripe CLI webhook listener..."
echo "Forwarding events (${EVENTS}) to ${FORWARD_URL}"
echo
echo "⚠️  When prompted, copy the webhook signing secret (whsec_...) and add/update"
echo "⚠️  STRIPE_WEBHOOK_SECRET in your apps/web/.env.local before running npm run dev."
echo

stripe listen --events "${EVENTS}" --forward-to "${FORWARD_URL}"
