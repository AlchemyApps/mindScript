# Local Stripe Webhook Setup

These steps let the Next.js app receive `checkout.session.completed` events
from Stripe while you run the builder → checkout flow locally.

## 1. Install the Stripe CLI (already handled)

```bash
brew install stripe/stripe-cli/stripe
```

## 2. Authenticate the CLI

Run the login command and follow the link that appears:

```bash
stripe login
```

Copy the pairing code and complete the auth flow in your browser. Once the CLI
confirms, you can close the command.

## 3. Start the listener

From the repo root, either run the helper script:

```bash
scripts/start-stripe-webhook-listener.sh
```

or use the npm alias:

```bash
npm run stripe:listen
```

The CLI prints a webhook signing secret (`whsec_...`). Copy that value into
`apps/web/.env.local` (or your global `.env`) as `STRIPE_WEBHOOK_SECRET`.

> ℹ️ Restart `npm run dev` after changing the environment variable.

While the listener is running you will see incoming events mirrored in the
terminal. Leave it open while testing checkout locally.

## 4. Verify it works

1. Start the web app: `npm run dev`
2. Submit a builder checkout using Stripe test card `4242 4242 4242 4242`
3. Watch the listener terminal for `checkout.session.completed`
4. Confirm Supabase tables update (`webhook_events`, `purchases`, `audio_job_queue`)

When you are finished, cancel the listener with `Ctrl + C`.
