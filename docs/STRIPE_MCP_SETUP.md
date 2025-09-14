# Stripe MCP Server Setup Guide

## Overview
The Stripe MCP (Model Context Protocol) server allows Claude to interact with your Stripe account directly, enabling it to create products, prices, customers, and manage payments.

## Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- Stripe account with API keys
- Claude Desktop app

## Step 1: Install Stripe MCP Server

```bash
# Using npm
npm install -g @modelcontextprotocol/server-stripe

# Or using npx (no installation needed)
npx @modelcontextprotocol/server-stripe
```

## Step 2: Get Your Stripe API Keys

1. Log into your [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers → API keys**
3. Copy your **Secret key** (starts with `sk_test_` for test mode or `sk_live_` for live mode)
4. Keep this key secure - never commit it to git!

## Step 3: Configure Claude Desktop

### macOS Configuration

1. Open Claude Desktop settings
2. Go to **Developer → Edit Config**
3. Add the Stripe MCP configuration to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "stripe": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-stripe"
      ],
      "env": {
        "STRIPE_API_KEY": "sk_test_YOUR_STRIPE_SECRET_KEY_HERE"
      }
    }
  }
}
```

### Alternative: Using node directly (if globally installed)

```json
{
  "mcpServers": {
    "stripe": {
      "command": "mcp-server-stripe",
      "env": {
        "STRIPE_API_KEY": "sk_test_YOUR_STRIPE_SECRET_KEY_HERE"
      }
    }
  }
}
```

## Step 4: Environment-Specific Setup

### For Test Mode (Recommended for Development)
Use your test API key starting with `sk_test_`:
```json
"env": {
  "STRIPE_API_KEY": "sk_test_..."
}
```

### For Live Mode (Production)
Use your live API key starting with `sk_live_`:
```json
"env": {
  "STRIPE_API_KEY": "sk_live_..."
}
```

⚠️ **WARNING**: Be extremely careful with live keys! They can create real charges.

## Step 5: Restart Claude Desktop

After adding the configuration:
1. Save the config file
2. Completely quit Claude Desktop (Cmd+Q on macOS)
3. Restart Claude Desktop
4. The Stripe MCP should now be available

## Step 6: Verify Installation

In a new Claude conversation, you can verify the MCP is working:
1. Ask: "Can you check my Stripe account info?"
2. Claude should be able to use the `get_stripe_account_info` tool
3. You should see your Stripe account details

## Available Stripe MCP Tools

Once configured, Claude can use these tools:

### Account & Search
- `get_stripe_account_info` - Get your account details
- `search_stripe_documentation` - Search Stripe docs
- `search_stripe_resources` - Search for Stripe objects

### Customers
- `list_customers` - List customers
- `create_customer` - Create new customer

### Products & Pricing
- `list_products` - List products
- `create_product` - Create product
- `list_prices` - List prices
- `create_price` - Create price

### Payments
- `create_payment_link` - Create payment link
- `list_payment_intents` - List payment intents
- `create_refund` - Process refunds

### Invoices
- `list_invoices` - List invoices
- `create_invoice` - Create invoice
- `create_invoice_item` - Add invoice item
- `finalize_invoice` - Finalize invoice

### Subscriptions
- `list_subscriptions` - List subscriptions
- `update_subscription` - Update subscription
- `cancel_subscription` - Cancel subscription

### Coupons & Disputes
- `list_coupons` - List coupons
- `create_coupon` - Create coupon
- `list_disputes` - List disputes
- `update_dispute` - Update dispute

## Troubleshooting

### MCP Not Showing Up
1. Ensure Claude Desktop is completely quit and restarted
2. Check the config file has valid JSON syntax
3. Verify the API key is correct and has proper permissions

### Permission Errors
1. Ensure your Stripe API key has the necessary permissions
2. For test mode, use `sk_test_` keys
3. Check if your Stripe account is verified

### Connection Issues
1. Check your internet connection
2. Verify Stripe's API status at https://status.stripe.com
3. Try using a different API key

### Config File Location
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

## Security Best Practices

1. **Never share your secret API keys**
2. **Use test keys for development**
3. **Rotate keys regularly**
4. **Use restricted keys when possible** (create in Stripe Dashboard)
5. **Don't commit API keys to version control**

## For MindScript Project

The MindScript project uses Stripe for:
- Web checkout (Stripe Checkout)
- Seller payouts (Stripe Connect)
- Subscription management
- Payment processing

Make sure to use the same Stripe account that's configured in your `.env.local`:
```env
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Additional Resources

- [Stripe API Documentation](https://stripe.com/docs/api)
- [MCP Protocol Documentation](https://modelcontextprotocol.io)
- [Stripe MCP Server GitHub](https://github.com/modelcontextprotocol/servers/tree/main/src/stripe)

---

*Note: This guide is for setting up the Stripe MCP server to work with Claude Desktop. Always use test mode keys during development and be careful with production keys.*