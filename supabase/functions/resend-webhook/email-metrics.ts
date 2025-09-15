// Email metrics and analytics utilities for Resend webhook data
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export interface EmailMetrics {
  totalSent: number;
  delivered: number;
  bounced: number;
  complained: number;
  opened: number;
  clicked: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  complaintRate: number;
}

export interface EmailCampaignMetrics extends EmailMetrics {
  campaignId: string;
  emailType: string;
  campaignStarted: string;
  campaignEnded: string;
}

export interface UserEmailHealth {
  userId: string;
  email: string;
  healthScore: number;
  isSuppressed: boolean;
  suppressionReason: string | null;
  bounceCount: number;
  complaintCount: number;
  lastEngagementDate: string | null;
  totalEmailsSent: number;
  totalEmailsOpened: number;
  engagementRate: number;
}

/**
 * Calculate email metrics for a specific time period
 */
export async function calculateEmailMetrics(
  supabase: ReturnType<typeof createClient>,
  startDate: Date,
  endDate: Date,
  emailType?: string
): Promise<EmailMetrics> {
  let query = supabase
    .from("email_logs")
    .select("*")
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString());

  if (emailType) {
    query = query.eq("email_type", emailType);
  }

  const { data: emails, error } = await query;

  if (error || !emails) {
    throw new Error(`Failed to fetch email logs: ${error?.message}`);
  }

  const totalSent = emails.length;
  const delivered = emails.filter(e => e.status === "delivered").length;
  const bounced = emails.filter(e => e.status === "bounced").length;
  const complained = emails.filter(e => e.status === "complained").length;
  const opened = emails.filter(e => e.opened_at !== null).length;
  const clicked = emails.filter(e => e.last_clicked_at !== null).length;

  return {
    totalSent,
    delivered,
    bounced,
    complained,
    opened,
    clicked,
    deliveryRate: totalSent > 0 ? (delivered / totalSent) * 100 : 0,
    openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
    clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
    bounceRate: totalSent > 0 ? (bounced / totalSent) * 100 : 0,
    complaintRate: totalSent > 0 ? (complained / totalSent) * 100 : 0,
  };
}

/**
 * Get campaign-specific metrics
 */
export async function getCampaignMetrics(
  supabase: ReturnType<typeof createClient>,
  campaignId: string
): Promise<EmailCampaignMetrics | null> {
  const { data, error } = await supabase
    .from("email_campaign_metrics")
    .select("*")
    .eq("campaign_id", campaignId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    campaignId: data.campaign_id,
    emailType: data.email_type,
    totalSent: data.total_sent,
    delivered: data.delivered,
    bounced: data.bounced,
    complained: data.complained,
    opened: data.opened,
    clicked: data.clicked,
    deliveryRate: data.delivery_rate,
    openRate: data.open_rate,
    clickRate: data.click_rate,
    bounceRate: (data.bounced / data.total_sent) * 100,
    complaintRate: (data.complained / data.total_sent) * 100,
    campaignStarted: data.campaign_started,
    campaignEnded: data.campaign_ended,
  };
}

/**
 * Calculate user email health score
 */
export async function calculateUserEmailHealth(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  email: string
): Promise<UserEmailHealth> {
  // Get user email preferences
  const { data: preferences } = await supabase
    .from("user_email_preferences")
    .select("*")
    .eq("user_id", userId)
    .eq("email", email)
    .single();

  // Get recent email logs for the user
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentEmails } = await supabase
    .from("email_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("to_email", email)
    .gte("created_at", thirtyDaysAgo.toISOString());

  // Calculate health score (0-100)
  let healthScore = 100;

  if (preferences) {
    // Deduct points for bounces
    healthScore -= Math.min(preferences.bounce_count * 20, 60);

    // Deduct points for complaints (more severe)
    healthScore -= Math.min(preferences.complaint_count * 30, 60);

    // Add points for engagement
    const engagementRate = preferences.total_emails_sent > 0
      ? (preferences.total_emails_opened / preferences.total_emails_sent) * 100
      : 0;

    if (engagementRate > 50) {
      healthScore = Math.min(healthScore + 10, 100);
    } else if (engagementRate > 25) {
      healthScore = Math.min(healthScore + 5, 100);
    }

    // Check for recent engagement
    if (preferences.last_email_opened_at) {
      const daysSinceEngagement = Math.floor(
        (Date.now() - new Date(preferences.last_email_opened_at).getTime()) /
        (1000 * 60 * 60 * 24)
      );

      if (daysSinceEngagement > 90) {
        healthScore -= 10; // Inactive for 90+ days
      } else if (daysSinceEngagement > 30) {
        healthScore -= 5; // Inactive for 30+ days
      }
    }
  }

  // Ensure score is between 0 and 100
  healthScore = Math.max(0, Math.min(100, healthScore));

  return {
    userId,
    email,
    healthScore,
    isSuppressed: preferences?.is_suppressed || false,
    suppressionReason: preferences?.suppression_reason || null,
    bounceCount: preferences?.bounce_count || 0,
    complaintCount: preferences?.complaint_count || 0,
    lastEngagementDate: preferences?.last_email_opened_at || preferences?.last_email_clicked_at || null,
    totalEmailsSent: preferences?.total_emails_sent || 0,
    totalEmailsOpened: preferences?.total_emails_opened || 0,
    engagementRate: preferences?.total_emails_sent > 0
      ? (preferences.total_emails_opened / preferences.total_emails_sent) * 100
      : 0,
  };
}

/**
 * Get users who should be re-engaged
 */
export async function getInactiveUsers(
  supabase: ReturnType<typeof createClient>,
  daysInactive: number = 30
): Promise<Array<{ userId: string; email: string; lastEngagement: string | null }>> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

  const { data, error } = await supabase
    .from("user_email_preferences")
    .select("user_id, email, last_email_opened_at, last_email_clicked_at")
    .eq("is_suppressed", false)
    .or(`last_email_opened_at.lt.${cutoffDate.toISOString()},last_email_clicked_at.lt.${cutoffDate.toISOString()},and(last_email_opened_at.is.null,last_email_clicked_at.is.null)`);

  if (error || !data) {
    return [];
  }

  return data.map(user => ({
    userId: user.user_id,
    email: user.email,
    lastEngagement: user.last_email_opened_at || user.last_email_clicked_at,
  }));
}

/**
 * Get top engaged users
 */
export async function getTopEngagedUsers(
  supabase: ReturnType<typeof createClient>,
  limit: number = 10
): Promise<Array<UserEmailHealth>> {
  const { data, error } = await supabase
    .from("user_email_preferences")
    .select("*")
    .eq("is_suppressed", false)
    .gt("total_emails_opened", 0)
    .order("total_emails_opened", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  const healthScores = await Promise.all(
    data.map(pref => calculateUserEmailHealth(supabase, pref.user_id, pref.email))
  );

  return healthScores;
}

/**
 * Clean up old webhook events
 */
export async function cleanupOldWebhookEvents(
  supabase: ReturnType<typeof createClient>,
  daysToKeep: number = 90
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const { data, error } = await supabase
    .from("webhook_events")
    .delete()
    .eq("provider", "resend")
    .eq("processed", true)
    .lt("created_at", cutoffDate.toISOString())
    .select("id");

  if (error) {
    throw new Error(`Failed to cleanup webhook events: ${error.message}`);
  }

  return data?.length || 0;
}

/**
 * Get email performance by day of week
 */
export async function getPerformanceByDayOfWeek(
  supabase: ReturnType<typeof createClient>,
  startDate: Date,
  endDate: Date
): Promise<Record<string, EmailMetrics>> {
  const { data: emails, error } = await supabase
    .from("email_logs")
    .select("*")
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString());

  if (error || !emails) {
    throw new Error(`Failed to fetch email logs: ${error?.message}`);
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const metricsByDay: Record<string, any[]> = {};

  // Group emails by day of week
  emails.forEach(email => {
    const dayOfWeek = dayNames[new Date(email.created_at).getDay()];
    if (!metricsByDay[dayOfWeek]) {
      metricsByDay[dayOfWeek] = [];
    }
    metricsByDay[dayOfWeek].push(email);
  });

  // Calculate metrics for each day
  const result: Record<string, EmailMetrics> = {};

  for (const [day, dayEmails] of Object.entries(metricsByDay)) {
    const totalSent = dayEmails.length;
    const delivered = dayEmails.filter(e => e.status === "delivered").length;
    const bounced = dayEmails.filter(e => e.status === "bounced").length;
    const complained = dayEmails.filter(e => e.status === "complained").length;
    const opened = dayEmails.filter(e => e.opened_at !== null).length;
    const clicked = dayEmails.filter(e => e.last_clicked_at !== null).length;

    result[day] = {
      totalSent,
      delivered,
      bounced,
      complained,
      opened,
      clicked,
      deliveryRate: totalSent > 0 ? (delivered / totalSent) * 100 : 0,
      openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
      clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
      bounceRate: totalSent > 0 ? (bounced / totalSent) * 100 : 0,
      complaintRate: totalSent > 0 ? (complained / totalSent) * 100 : 0,
    };
  }

  return result;
}

/**
 * Get email performance by hour of day
 */
export async function getPerformanceByHourOfDay(
  supabase: ReturnType<typeof createClient>,
  startDate: Date,
  endDate: Date
): Promise<Record<number, EmailMetrics>> {
  const { data: emails, error } = await supabase
    .from("email_logs")
    .select("*")
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString());

  if (error || !emails) {
    throw new Error(`Failed to fetch email logs: ${error?.message}`);
  }

  const metricsByHour: Record<number, any[]> = {};

  // Group emails by hour
  emails.forEach(email => {
    const hour = new Date(email.created_at).getHours();
    if (!metricsByHour[hour]) {
      metricsByHour[hour] = [];
    }
    metricsByHour[hour].push(email);
  });

  // Calculate metrics for each hour
  const result: Record<number, EmailMetrics> = {};

  for (const [hour, hourEmails] of Object.entries(metricsByHour)) {
    const totalSent = hourEmails.length;
    const delivered = hourEmails.filter(e => e.status === "delivered").length;
    const bounced = hourEmails.filter(e => e.status === "bounced").length;
    const complained = hourEmails.filter(e => e.status === "complained").length;
    const opened = hourEmails.filter(e => e.opened_at !== null).length;
    const clicked = hourEmails.filter(e => e.last_clicked_at !== null).length;

    result[Number(hour)] = {
      totalSent,
      delivered,
      bounced,
      complained,
      opened,
      clicked,
      deliveryRate: totalSent > 0 ? (delivered / totalSent) * 100 : 0,
      openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
      clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
      bounceRate: totalSent > 0 ? (bounced / totalSent) * 100 : 0,
      complaintRate: totalSent > 0 ? (complained / totalSent) * 100 : 0,
    };
  }

  return result;
}

/**
 * Export metrics to CSV format
 */
export function exportMetricsToCSV(metrics: EmailMetrics[]): string {
  const headers = [
    "Total Sent",
    "Delivered",
    "Bounced",
    "Complained",
    "Opened",
    "Clicked",
    "Delivery Rate (%)",
    "Open Rate (%)",
    "Click Rate (%)",
    "Bounce Rate (%)",
    "Complaint Rate (%)",
  ];

  const rows = metrics.map(m => [
    m.totalSent,
    m.delivered,
    m.bounced,
    m.complained,
    m.opened,
    m.clicked,
    m.deliveryRate.toFixed(2),
    m.openRate.toFixed(2),
    m.clickRate.toFixed(2),
    m.bounceRate.toFixed(2),
    m.complaintRate.toFixed(2),
  ]);

  const csv = [
    headers.join(","),
    ...rows.map(row => row.join(",")),
  ].join("\n");

  return csv;
}