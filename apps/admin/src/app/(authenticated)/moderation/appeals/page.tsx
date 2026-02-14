'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { Check, CheckCircle, X, Clock, AlertCircle, ChevronRight, MessageSquare } from 'lucide-react'
import { format } from 'date-fns'

interface ModerationAppeal {
  id: string
  user_id: string
  action_id: string
  statement: string
  supporting_evidence: string | null
  status: 'pending' | 'under_review' | 'granted' | 'denied'
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  decision_notes: string | null
  profiles: {
    username: string
    display_name: string | null
  }
  moderation_actions: {
    action_type: string
    content_type: string
    content_id: string
    reason: string
    created_at: string
  }
}

export default function AppealsPage() {
  const [appeals, setAppeals] = useState<ModerationAppeal[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAppeal, setSelectedAppeal] = useState<ModerationAppeal | null>(null)
  const [decisionNotes, setDecisionNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchAppeals()
  }, [])

  const fetchAppeals = async () => {
    try {
      const { data, error } = await supabase
        .from('moderation_appeals')
        .select(`
          *,
          profiles!user_id (
            username,
            display_name
          ),
          moderation_actions!action_id (
            action_type,
            content_type,
            content_id,
            reason,
            created_at
          )
        `)
        .in('status', ['pending', 'under_review'])
        .order('created_at', { ascending: true })

      if (error) throw error
      setAppeals(data || [])
    } catch (error) {
      console.error('Error fetching appeals:', error)
      toast({
        title: 'Error',
        description: 'Failed to load appeals',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAppealDecision = async (appealId: string, granted: boolean) => {
    setProcessing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Update appeal status
      const { error: appealError } = await supabase
        .from('moderation_appeals')
        .update({
          status: granted ? 'granted' : 'denied',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          decision_notes: decisionNotes
        })
        .eq('id', appealId)

      if (appealError) throw appealError

      // If granted, reverse the moderation action
      if (granted && selectedAppeal) {
        const { error: actionError } = await supabase
          .from('moderation_actions')
          .update({
            reversed_at: new Date().toISOString(),
            reversed_by: user.id,
            reversal_reason: `Appeal granted: ${decisionNotes}`
          })
          .eq('id', selectedAppeal.action_id)

        if (actionError) throw actionError
      }

      toast({
        title: 'Success',
        description: `Appeal ${granted ? 'granted' : 'denied'} successfully`
      })

      // Refresh appeals list
      fetchAppeals()
      setSelectedAppeal(null)
      setDecisionNotes('')
    } catch (error) {
      console.error('Error processing appeal:', error)
      toast({
        title: 'Error',
        description: 'Failed to process appeal decision',
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  const getActionTypeLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      'warning_issued': 'Warning',
      'content_removed': 'Content Removed',
      'marketplace_delisted': 'Delisted',
      'user_suspended': 'Suspended',
      'user_banned': 'Banned'
    }
    return labels[actionType] || actionType
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'pending': 'default',
      'under_review': 'secondary'
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Moderation Appeals</h1>
          <p className="text-muted-foreground mt-2">
            Review and process user appeals for moderation actions
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-3 py-1">
          {appeals.length} Pending Appeals
        </Badge>
      </div>

      {appeals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No pending appeals</p>
            <p className="text-muted-foreground">All appeals have been processed</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {appeals.map((appeal) => (
            <Card
              key={appeal.id}
              className={selectedAppeal?.id === appeal.id ? 'ring-2 ring-primary' : ''}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      Appeal from @{appeal.profiles.username}
                      {getStatusBadge(appeal.status)}
                    </CardTitle>
                    <CardDescription>
                      Appealing: {getActionTypeLabel(appeal.moderation_actions.action_type)} - {appeal.moderation_actions.reason}
                    </CardDescription>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div>Submitted {format(new Date(appeal.created_at), 'MMM d, h:mm a')}</div>
                    <div>Original action: {format(new Date(appeal.moderation_actions.created_at), 'MMM d')}</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    User Statement
                  </h4>
                  <p className="text-sm bg-muted p-3 rounded-md">{appeal.statement}</p>
                </div>

                {appeal.supporting_evidence && (
                  <div>
                    <h4 className="font-semibold mb-2">Supporting Evidence</h4>
                    <p className="text-sm bg-muted p-3 rounded-md">{appeal.supporting_evidence}</p>
                  </div>
                )}

                {selectedAppeal?.id === appeal.id ? (
                  <div className="space-y-4 border-t pt-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Decision Notes (will be recorded)
                      </label>
                      <Textarea
                        value={decisionNotes}
                        onChange={(e) => setDecisionNotes(e.target.value)}
                        placeholder="Provide reasoning for your decision..."
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAppealDecision(appeal.id, true)}
                        disabled={processing || !decisionNotes}
                        className="flex-1"
                        variant="default"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Grant Appeal
                      </Button>
                      <Button
                        onClick={() => handleAppealDecision(appeal.id, false)}
                        disabled={processing || !decisionNotes}
                        className="flex-1"
                        variant="destructive"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Deny Appeal
                      </Button>
                      <Button
                        onClick={() => {
                          setSelectedAppeal(null)
                          setDecisionNotes('')
                        }}
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => setSelectedAppeal(appeal)}
                    variant="outline"
                    className="w-full"
                  >
                    Review Appeal
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}