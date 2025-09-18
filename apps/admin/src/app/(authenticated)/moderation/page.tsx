'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Shield, AlertTriangle, CheckCircle, XCircle, Clock, Flag, Eye, TrendingUp, Users, BarChart3, Activity } from 'lucide-react'
import { formatDistanceToNow, subDays, format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface ContentReport {
  id: string
  content_type: string
  content_id: string
  reporter_id: string
  category: string
  description: string | null
  status: 'pending' | 'under_review' | 'actioned' | 'dismissed' | 'auto_dismissed'
  priority_score: number
  reviewed_at: string | null
  reviewed_by: string | null
  review_notes: string | null
  created_at: string
  profiles: {
    username: string
    display_name: string | null
  }
}

interface ModerationMetrics {
  totalReports: number
  pendingReports: number
  actionedReports: number
  dismissedReports: number
  averageResponseTime: number
  falsePositiveRate: number
  reportsByCategory: { category: string; count: number }[]
  weeklyTrend: { date: string; reports: number; actions: number }[]
  topReporters: { username: string; reports: number; accuracy: number }[]
}

export default function ModerationPage() {
  const [reports, setReports] = useState<ContentReport[]>([])
  const [metrics, setMetrics] = useState<ModerationMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState<'queue' | 'metrics'>('queue')
  const [selectedStatus, setSelectedStatus] = useState<string>('pending')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [processing, setProcessing] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchReports()
    fetchMetrics()
  }, [selectedStatus, selectedCategory])

  const fetchReports = async () => {
    try {
      let query = supabase
        .from('content_reports')
        .select(`
          *,
          profiles!reporter_id (
            username,
            display_name
          )
        `)
        .order('priority_score', { ascending: false })
        .limit(50)

      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus)
      }
      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory)
      }

      const { data, error } = await query

      if (error) throw error
      setReports(data || [])
    } catch (error) {
      console.error('Error fetching reports:', error)
      toast({
        title: 'Error',
        description: 'Failed to load reports',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchMetrics = async () => {
    try {
      const now = new Date()
      const weekAgo = subDays(now, 7)

      // Fetch various metrics in parallel
      const [
        { data: totalData },
        { data: categoryData },
        { data: weeklyData },
        { data: topReportersData }
      ] = await Promise.all([
        // Total counts
        supabase
          .from('content_reports')
          .select('status', { count: 'exact' }),

        // Reports by category
        supabase
          .from('content_reports')
          .select('category')
          .gte('created_at', weekAgo.toISOString()),

        // Weekly trend data
        supabase
          .from('content_reports')
          .select('created_at, status')
          .gte('created_at', weekAgo.toISOString()),

        // Top reporters with credibility
        supabase
          .from('reporter_credibility')
          .select(`
            user_id,
            total_reports,
            accurate_reports,
            credibility_score,
            profiles!user_id (
              username
            )
          `)
          .order('total_reports', { ascending: false })
          .limit(5)
      ])

      // Process metrics
      const categoryCount: Record<string, number> = {}
      categoryData?.forEach(report => {
        categoryCount[report.category] = (categoryCount[report.category] || 0) + 1
      })

      // Process weekly trend
      const dailyData: Record<string, { reports: number; actions: number }> = {}
      for (let i = 0; i < 7; i++) {
        const date = format(subDays(now, i), 'MMM d')
        dailyData[date] = { reports: 0, actions: 0 }
      }

      weeklyData?.forEach(report => {
        const date = format(new Date(report.created_at), 'MMM d')
        if (dailyData[date]) {
          dailyData[date].reports++
          if (report.status === 'actioned') {
            dailyData[date].actions++
          }
        }
      })

      const statusCounts = {
        pending: 0,
        actioned: 0,
        dismissed: 0,
        under_review: 0,
        auto_dismissed: 0
      }

      totalData?.forEach(report => {
        statusCounts[report.status as keyof typeof statusCounts]++
      })

      const totalReports = Object.values(statusCounts).reduce((a, b) => a + b, 0)
      const falsePositiveRate = totalReports > 0
        ? ((statusCounts.dismissed + statusCounts.auto_dismissed) / totalReports) * 100
        : 0

      setMetrics({
        totalReports,
        pendingReports: statusCounts.pending,
        actionedReports: statusCounts.actioned,
        dismissedReports: statusCounts.dismissed + statusCounts.auto_dismissed,
        averageResponseTime: 2.5, // This would need actual calculation
        falsePositiveRate,
        reportsByCategory: Object.entries(categoryCount).map(([category, count]) => ({
          category,
          count
        })),
        weeklyTrend: Object.entries(dailyData).reverse().map(([date, data]) => ({
          date,
          ...data
        })),
        topReporters: topReportersData?.map(reporter => ({
          username: reporter.profiles?.username || 'Unknown',
          reports: reporter.total_reports,
          accuracy: reporter.credibility_score * 100
        })) || []
      })
    } catch (error) {
      console.error('Error fetching metrics:', error)
    }
  }

  const handleReportAction = async (reportId: string, action: 'approve' | 'dismiss') => {
    setProcessing(reportId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const newStatus = action === 'approve' ? 'actioned' : 'dismissed'

      const { error } = await supabase
        .from('content_reports')
        .update({
          status: newStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          review_notes: `${action === 'approve' ? 'Action taken' : 'Dismissed'} by admin`
        })
        .eq('id', reportId)

      if (error) throw error

      // Update reporter credibility
      await supabase.rpc('update_reporter_credibility', {
        p_report_id: reportId,
        p_was_accurate: action === 'approve'
      })

      toast({
        title: 'Success',
        description: `Report ${action === 'approve' ? 'actioned' : 'dismissed'} successfully`
      })

      fetchReports()
      fetchMetrics()
    } catch (error) {
      console.error('Error processing report:', error)
      toast({
        title: 'Error',
        description: 'Failed to process report',
        variant: 'destructive'
      })
    } finally {
      setProcessing(null)
    }
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'inappropriate_content': 'Inappropriate',
      'offensive_language': 'Offensive Language',
      'copyright_violation': 'Copyright',
      'spam': 'Spam',
      'scam_fraud': 'Scam/Fraud',
      'misleading_content': 'Misleading',
      'harassment': 'Harassment',
      'other': 'Other'
    }
    return labels[category] || category
  }

  const getPriorityBadge = (score: number) => {
    if (score >= 70) return <Badge variant="destructive">Critical</Badge>
    if (score >= 50) return <Badge variant="default" className="bg-orange-500">High</Badge>
    if (score >= 30) return <Badge variant="secondary">Medium</Badge>
    return <Badge variant="outline">Low</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Content Moderation
          </h1>
          <p className="text-muted-foreground mt-2">
            Review reported content and monitor platform safety
          </p>
        </div>
        <Link href="/moderation/appeals">
          <Button variant="outline">
            View Appeals
            <Badge className="ml-2" variant="secondary">New</Badge>
          </Button>
        </Link>
      </div>

      <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as 'queue' | 'metrics')}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="queue">
            Moderation Queue
            {metrics && metrics.pendingReports > 0 && (
              <Badge className="ml-2" variant="destructive">{metrics.pendingReports}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="metrics">Metrics & Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="actioned">Actioned</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="inappropriate_content">Inappropriate</SelectItem>
                  <SelectItem value="offensive_language">Offensive Language</SelectItem>
                  <SelectItem value="copyright_violation">Copyright</SelectItem>
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="scam_fraud">Scam/Fraud</SelectItem>
                  <SelectItem value="harassment">Harassment</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Reports List */}
          <div className="space-y-4">
            {reports.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-64">
                  <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No reports to review</p>
                  <p className="text-muted-foreground">All reports have been processed</p>
                </CardContent>
              </Card>
            ) : (
              reports.map((report) => (
                <Card key={report.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{report.content_type}</Badge>
                          <Badge variant="secondary">{getCategoryLabel(report.category)}</Badge>
                          {getPriorityBadge(report.priority_score)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Reported by @{report.profiles.username} • {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                        </p>
                        {report.description && (
                          <p className="text-sm bg-muted p-2 rounded">{report.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {report.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleReportAction(report.id, 'approve')}
                              disabled={processing === report.id}
                            >
                              Take Action
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReportAction(report.id, 'dismiss')}
                              disabled={processing === report.id}
                            >
                              Dismiss
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          {/* Metrics Overview */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.totalReports || 0}</div>
                <p className="text-xs text-muted-foreground">All time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.pendingReports || 0}</div>
                <p className="text-xs text-muted-foreground">Requires action</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">False Positive Rate</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.falsePositiveRate.toFixed(1) || 0}%</div>
                <p className="text-xs text-muted-foreground">Dismissed reports</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.averageResponseTime || 0}h</div>
                <p className="text-xs text-muted-foreground">Time to action</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Report Trend</CardTitle>
                <CardDescription>Reports and actions over the past week</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics?.weeklyTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="reports" stroke="#8884d8" name="Reports" />
                    <Line type="monotone" dataKey="actions" stroke="#82ca9d" name="Actions" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reports by Category</CardTitle>
                <CardDescription>Distribution of report types this week</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics?.reportsByCategory || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top Reporters */}
          <Card>
            <CardHeader>
              <CardTitle>Top Reporters</CardTitle>
              <CardDescription>Most active content reporters with credibility scores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics?.topReporters.map((reporter, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-medium">@{reporter.username}</p>
                        <p className="text-sm text-muted-foreground">{reporter.reports} reports</p>
                      </div>
                    </div>
                    <Badge variant={reporter.accuracy >= 80 ? 'default' : 'secondary'}>
                      {reporter.accuracy.toFixed(0)}% accurate
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}