'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Activity,
  TrendingUp,
  Users,
  DollarSign,
  Mail
} from 'lucide-react'

interface QueueStats {
  type: string
  pending: number
  processing: number
  completed: number
  failed: number
  retry: number
  dead_letter: number
}

interface JobDetails {
  id: string
  type: string
  status: string
  priority: string
  progress: number
  stage?: string
  created_at: string
  started_at?: string
  completed_at?: string
  error?: string
  retry_count: number
}

interface WorkerHealth {
  status: 'healthy' | 'unhealthy'
  database: string
  processors: {
    email: boolean
    audio_render: boolean
    payout: boolean
    analytics: boolean
  }
  timestamp: string
}

export default function QueueMonitoringPage() {
  const [stats, setStats] = useState<QueueStats[]>([])
  const [recentJobs, setRecentJobs] = useState<JobDetails[]>([])
  const [deadLetterJobs, setDeadLetterJobs] = useState<JobDetails[]>([])
  const [workerHealth, setWorkerHealth] = useState<WorkerHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    fetchQueueData()
    const interval = setInterval(fetchQueueData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchQueueData = async () => {
    try {
      // Fetch queue statistics
      const { data: queueData } = await supabase
        .from('job_queue')
        .select('type, status')

      if (queueData) {
        const statsMap: Record<string, QueueStats> = {}

        queueData.forEach(job => {
          if (!statsMap[job.type]) {
            statsMap[job.type] = {
              type: job.type,
              pending: 0,
              processing: 0,
              completed: 0,
              failed: 0,
              retry: 0,
              dead_letter: 0,
            }
          }
          statsMap[job.type][job.status as keyof Omit<QueueStats, 'type'>]++
        })

        setStats(Object.values(statsMap))
      }

      // Fetch recent jobs
      const { data: jobs } = await supabase
        .from('job_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      setRecentJobs(jobs || [])

      // Fetch dead letter queue
      const { data: deadLetter } = await supabase
        .from('job_dead_letter')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      setDeadLetterJobs(deadLetter || [])

      // Check worker health
      await checkWorkerHealth()

    } catch (error) {
      console.error('Failed to fetch queue data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const checkWorkerHealth = async () => {
    try {
      const response = await fetch('/api/queue/health')
      if (response.ok) {
        const health = await response.json()
        setWorkerHealth(health)
      }
    } catch (error) {
      console.error('Failed to check worker health:', error)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchQueueData()
  }

  const retryJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('job_queue')
        .update({
          status: 'pending',
          retry_count: 0,
          error: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      if (!error) {
        await fetchQueueData()
      }
    } catch (error) {
      console.error('Failed to retry job:', error)
    }
  }

  const cancelJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('job_queue')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      if (!error) {
        await fetchQueueData()
      }
    } catch (error) {
      console.error('Failed to cancel job:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      case 'failed':
      case 'dead_letter':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'pending':
      case 'retry':
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'payout':
        return <DollarSign className="h-4 w-4" />
      case 'analytics':
        return <TrendingUp className="h-4 w-4" />
      case 'audio_render':
        return <Activity className="h-4 w-4" />
      default:
        return <Users className="h-4 w-4" />
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'processing':
        return 'default'
      case 'failed':
      case 'dead_letter':
        return 'destructive'
      case 'pending':
      case 'retry':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Queue Monitoring</h1>
          <p className="text-muted-foreground">Monitor background job processing and worker health</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Worker Health Status */}
      {workerHealth && (
        <Alert className={workerHealth.status === 'healthy' ? 'border-green-500' : 'border-red-500'}>
          <Activity className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>
                Worker Status: <strong>{workerHealth.status}</strong> |
                Database: <strong>{workerHealth.database}</strong>
              </span>
              <div className="flex gap-4">
                {Object.entries(workerHealth.processors).map(([name, healthy]) => (
                  <span key={name} className="flex items-center gap-1">
                    {name}: {healthy ?
                      <CheckCircle className="h-4 w-4 text-green-500" /> :
                      <XCircle className="h-4 w-4 text-red-500" />
                    }
                  </span>
                ))}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Queue Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.type}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {getTypeIcon(stat.type)}
                {stat.type.replace('_', ' ').toUpperCase()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Pending</span>
                  <Badge variant="secondary">{stat.pending}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Processing</span>
                  <Badge>{stat.processing}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Completed</span>
                  <Badge variant="success">{stat.completed}</Badge>
                </div>
                {(stat.failed > 0 || stat.retry > 0) && (
                  <>
                    <div className="flex justify-between">
                      <span>Failed</span>
                      <Badge variant="destructive">{stat.failed}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Retry</span>
                      <Badge variant="secondary">{stat.retry}</Badge>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dead Letter Queue Alert */}
      {deadLetterJobs.length > 0 && (
        <Alert className="border-red-500">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>{deadLetterJobs.length} jobs in dead letter queue</strong> -
            These jobs have exceeded retry limits and require manual intervention.
          </AlertDescription>
        </Alert>
      )}

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Jobs</CardTitle>
          <CardDescription>Latest 20 jobs across all queues</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentJobs.map((job) => (
              <div key={job.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{job.type}</span>
                        <Badge variant={getStatusBadgeVariant(job.status)}>
                          {job.status}
                        </Badge>
                        <Badge variant="outline">{job.priority}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Created: {new Date(job.created_at).toLocaleString()}
                        {job.retry_count > 0 && (
                          <span className="ml-2">• Retries: {job.retry_count}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.progress > 0 && job.progress < 100 && (
                      <div className="w-20">
                        <Progress value={job.progress} className="h-2" />
                      </div>
                    )}
                    {job.status === 'failed' && (
                      <Button size="sm" variant="outline" onClick={() => retryJob(job.id)}>
                        Retry
                      </Button>
                    )}
                    {(job.status === 'pending' || job.status === 'processing') && (
                      <Button size="sm" variant="destructive" onClick={() => cancelJob(job.id)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
                {job.error && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
                    Error: {job.error}
                  </div>
                )}
                {job.stage && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    Stage: {job.stage}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}