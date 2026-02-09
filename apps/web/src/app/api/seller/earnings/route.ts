import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import {
  EarningsSummarySchema,
  EarningsPeriodSchema,
  PayoutRequestSchema,
  ExportEarningsSchema,
} from "@mindscript/schemas";

// Minimum payout amount in cents ($10)
const MINIMUM_PAYOUT_CENTS = 1000;

/**
 * Format cents to USD string
 */
function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Generate CSV from earnings data
 */
function generateCSV(earnings: any[]): string {
  const headers = ["Date", "Track", "Gross", "Platform Fee", "Processing Fee", "Net Earnings", "Status"];
  const rows = earnings.map(e => [
    new Date(e.created_at).toLocaleDateString(),
    e.track_title || e.track_id,
    formatCurrency(e.gross_cents),
    formatCurrency(e.platform_fee_cents),
    formatCurrency(e.processor_fee_cents),
    formatCurrency(e.seller_earnings_cents),
    e.payout_status,
  ]);

  return [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
  ].join("\n");
}

/**
 * GET /api/seller/earnings
 * Get earnings summary, period data, or export
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const format = searchParams.get("format");

    // Export earnings as CSV
    if (format === "csv") {
      const query = supabase
        .from("earnings_ledger")
        .select(`
          *,
          tracks!inner(title)
        `)
        .eq("seller_id", user.id);

      if (startDate) {
        query.gte("created_at", startDate);
      }
      if (endDate) {
        query.lte("created_at", endDate);
      }

      const { data: earnings, error } = await query.order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const csv = generateCSV(
        earnings.map(e => ({
          ...e,
          track_title: e.tracks?.title,
        }))
      );

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="earnings_export_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // Get earnings by period
    if (period && startDate && endDate) {
      const { data: earnings, error } = await supabase
        .from("earnings_ledger")
        .select("created_at, seller_earnings_cents, platform_fee_cents")
        .eq("seller_id", user.id)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      // Group by period
      const grouped = earnings.reduce((acc: any, e) => {
        const date = new Date(e.created_at);
        let key: string;

        switch (period) {
          case "daily":
            key = date.toISOString().split("T")[0];
            break;
          case "weekly":
            const week = Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000));
            key = `week-${week}`;
            break;
          case "monthly":
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            break;
          default:
            key = date.toISOString();
        }

        if (!acc[key]) {
          acc[key] = {
            date: key,
            earningsCents: 0,
            salesCount: 0,
            platformFeesCents: 0,
          };
        }

        acc[key].earningsCents += e.seller_earnings_cents;
        acc[key].platformFeesCents += e.platform_fee_cents;
        acc[key].salesCount += 1;

        return acc;
      }, {});

      const response = EarningsPeriodSchema.parse({
        period,
        startDate,
        endDate,
        data: Object.values(grouped).map((item: any) => ({
          date: item.date.includes("week-") || item.date.match(/^\d{4}-\d{2}$/) 
            ? new Date(startDate).toISOString() 
            : new Date(item.date).toISOString(),
          earningsCents: item.earningsCents,
          salesCount: item.salesCount,
          platformFeesCents: item.platformFeesCents,
        })),
      });

      return NextResponse.json(response);
    }

    // Get earnings summary
    const { data: summary, error: summaryError } = await supabase.rpc(
      "get_seller_earnings_summary",
      { p_seller_id: user.id }
    );

    if (summaryError) {
      throw summaryError;
    }

    const summaryData = summary?.[0] || {
      total_earnings_cents: 0,
      pending_payout_cents: 0,
      completed_payouts_cents: 0,
      available_balance_cents: 0,
      platform_fees_cents: 0,
      processing_fees_cents: 0,
      last_payout_date: null,
      next_payout_date: null,
    };

    const response = EarningsSummarySchema.parse({
      totalEarningsCents: summaryData.total_earnings_cents,
      pendingPayoutCents: summaryData.pending_payout_cents,
      completedPayoutsCents: summaryData.completed_payouts_cents,
      availableBalanceCents: summaryData.available_balance_cents,
      platformFeesCents: summaryData.platform_fees_cents,
      processingFeesCents: summaryData.processing_fees_cents,
      currency: "USD",
      lastPayoutDate: summaryData.last_payout_date,
      nextPayoutDate: summaryData.next_payout_date,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Earnings retrieval error:", error);
    return NextResponse.json(
      {
        error: "Failed to retrieve earnings",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/seller/earnings
 * Request manual payout
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validationResult = PayoutRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { amountCents, currency, reason, notes } = validationResult.data;

    // Check minimum payout amount
    if (amountCents < MINIMUM_PAYOUT_CENTS) {
      return NextResponse.json(
        { error: `Minimum payout amount is ${formatCurrency(MINIMUM_PAYOUT_CENTS)}` },
        { status: 400 }
      );
    }

    // Get available balance
    const { data: summary } = await supabase.rpc(
      "get_seller_earnings_summary",
      { p_seller_id: user.id }
    );

    const availableBalance = summary?.[0]?.available_balance_cents || 0;

    // Check sufficient balance
    if (amountCents > availableBalance) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      );
    }

    // Create payout request
    const { data: payout, error: payoutError } = await supabase
      .from("payouts")
      .insert({
        seller_id: user.id,
        amount_cents: amountCents,
        currency,
        status: "pending",
        period_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        period_end: new Date().toISOString(),
        transaction_count: 0, // Will be updated by scheduled job
        initiated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (payoutError) {
      throw payoutError;
    }

    // TODO: Trigger payout processing job

    return NextResponse.json({
      payoutId: payout.id,
      amountCents: payout.amount_cents,
      status: payout.status,
      message: "Payout request created. Processing will begin shortly.",
    });
  } catch (error) {
    console.error("Payout request error:", error);
    return NextResponse.json(
      {
        error: "Failed to create payout request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}