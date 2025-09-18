import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { z } from 'zod'

const reportSchema = z.object({
  content_type: z.enum(['track', 'profile', 'seller_listing', 'review', 'comment']),
  content_id: z.string().uuid(),
  category: z.enum([
    'inappropriate_content',
    'offensive_language',
    'copyright_violation',
    'spam',
    'scam_fraud',
    'misleading_content',
    'harassment',
    'other'
  ]),
  description: z.string().max(500).optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = reportSchema.parse(body)

    // Check rate limiting - max 10 reports per day
    const { count: todayReports } = await supabase
      .from('content_reports')
      .select('*', { count: 'exact', head: true })
      .eq('reporter_id', user.id)
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())

    if (todayReports && todayReports >= 10) {
      return NextResponse.json(
        { error: 'Daily report limit exceeded. Please try again tomorrow.' },
        { status: 429 }
      )
    }

    // Check if user has already reported this content
    const { data: existingReport } = await supabase
      .from('content_reports')
      .select('id')
      .eq('reporter_id', user.id)
      .eq('content_type', validatedData.content_type)
      .eq('content_id', validatedData.content_id)
      .single()

    if (existingReport) {
      return NextResponse.json(
        { error: 'You have already reported this content' },
        { status: 409 }
      )
    }

    // Submit the report
    const { data: report, error: insertError } = await supabase
      .from('content_reports')
      .insert({
        content_type: validatedData.content_type,
        content_id: validatedData.content_id,
        reporter_id: user.id,
        category: validatedData.category,
        description: validatedData.description,
      })
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    // Check if this content now has multiple reports for auto-escalation
    const { count: totalReports } = await supabase
      .from('content_reports')
      .select('*', { count: 'exact', head: true })
      .eq('content_type', validatedData.content_type)
      .eq('content_id', validatedData.content_id)
      .eq('status', 'pending')

    // Auto-escalate if 3+ reports
    if (totalReports && totalReports >= 3) {
      await supabase
        .from('content_reports')
        .update({
          priority_score: 75,
          status: 'under_review'
        })
        .eq('content_type', validatedData.content_type)
        .eq('content_id', validatedData.content_id)
        .eq('status', 'pending')
    }

    return NextResponse.json({
      success: true,
      message: 'Report submitted successfully',
      reportId: report.id,
    })

  } catch (error) {
    console.error('Error handling report:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to submit report' },
      { status: 500 }
    )
  }
}

// GET endpoint for checking report status
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { searchParams } = new URL(request.url)

    const contentType = searchParams.get('content_type')
    const contentId = searchParams.get('content_id')

    if (!contentType || !contentId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has reported this content
    const { data: report } = await supabase
      .from('content_reports')
      .select('id, status, created_at')
      .eq('reporter_id', user.id)
      .eq('content_type', contentType)
      .eq('content_id', contentId)
      .single()

    return NextResponse.json({
      hasReported: !!report,
      report: report || null,
    })

  } catch (error) {
    console.error('Error checking report status:', error)
    return NextResponse.json(
      { error: 'Failed to check report status' },
      { status: 500 }
    )
  }
}