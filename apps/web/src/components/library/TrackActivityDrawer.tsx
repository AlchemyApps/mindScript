'use client';

import { useState, useEffect } from 'react';
import {
  Mic2,
  Music,
  Waves,
  Clock,
  Sparkles,
  CreditCard,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { Badge } from '@mindscript/ui';
import { GlassCard } from '../ui/GlassCard';
import { cn } from '../../lib/utils';

interface TrackActivityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  trackId: string | null;
}

interface ActivityData {
  track: {
    id: string;
    title: string;
    status: string;
    voiceConfig: { provider: string; voice_id: string; name?: string } | null;
    musicConfig: { slug?: string; name?: string } | null;
    frequencyConfig: {
      solfeggio?: { frequency: number };
      binaural?: { band: string };
    } | null;
    outputConfig: { duration_minutes?: number; loop?: boolean } | null;
    editCount: number;
    createdAt: string;
    updatedAt: string;
  };
  renderHistory: Array<{
    id: string;
    status: string;
    progress: number;
    createdAt: string;
    updatedAt: string;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    type: string;
    createdAt: string;
  }>;
}

const RENDER_STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  completed: { icon: CheckCircle, color: 'text-accent', label: 'Completed' },
  processing: { icon: Loader2, color: 'text-primary animate-spin', label: 'Processing' },
  pending: { icon: Clock, color: 'text-warm-gold', label: 'Pending' },
  failed: { icon: XCircle, color: 'text-error', label: 'Failed' },
  queued: { icon: Clock, color: 'text-muted', label: 'Queued' },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function TrackActivityDrawer({ isOpen, onClose, trackId }: TrackActivityDrawerProps) {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !trackId) {
      setData(null);
      return;
    }

    const fetchActivity = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/tracks/${trackId}/activity`);
        if (!res.ok) throw new Error('Failed to load activity');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [isOpen, trackId]);

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Track Activity">
      <div className="px-6 py-4 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {error && (
          <GlassCard hover="none" className="text-center py-8">
            <AlertCircle className="w-8 h-8 text-error mx-auto mb-2" />
            <p className="text-sm text-error">{error}</p>
          </GlassCard>
        )}

        {data && (
          <>
            {/* Track Config Section */}
            <section>
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
                Track Configuration
              </h3>
              <GlassCard hover="none" className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted">
                    <Mic2 className="w-4 h-4" />
                    <span>Voice</span>
                  </div>
                  <span className="font-medium text-text">
                    {data.track.voiceConfig?.name || data.track.voiceConfig?.voice_id || 'N/A'}
                    {data.track.voiceConfig?.provider && (
                      <span className="text-muted ml-1">
                        ({data.track.voiceConfig.provider === 'openai' ? 'Standard' : 'Premium'})
                      </span>
                    )}
                  </span>
                </div>

                {data.track.musicConfig && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted">
                      <Music className="w-4 h-4" />
                      <span>Music</span>
                    </div>
                    <span className="font-medium text-text">
                      {data.track.musicConfig.name || data.track.musicConfig.slug || 'Selected'}
                    </span>
                  </div>
                )}

                {data.track.frequencyConfig?.solfeggio && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted">
                      <Waves className="w-4 h-4" />
                      <span>Solfeggio</span>
                    </div>
                    <span className="font-medium text-text">
                      {data.track.frequencyConfig.solfeggio.frequency} Hz
                    </span>
                  </div>
                )}

                {data.track.frequencyConfig?.binaural && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted">
                      <Sparkles className="w-4 h-4" />
                      <span>Binaural</span>
                    </div>
                    <span className="font-medium text-text capitalize">
                      {data.track.frequencyConfig.binaural.band}
                    </span>
                  </div>
                )}

                {data.track.outputConfig?.duration_minutes && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted">
                      <Clock className="w-4 h-4" />
                      <span>Duration</span>
                    </div>
                    <span className="font-medium text-text">
                      {data.track.outputConfig.duration_minutes} min
                      {data.track.outputConfig.loop ? ' (looped)' : ''}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted">
                    <RefreshCw className="w-4 h-4" />
                    <span>Edits</span>
                  </div>
                  <span className="font-medium text-text">{data.track.editCount || 0}</span>
                </div>

                <div className="pt-2 border-t border-gray-100 text-xs text-muted">
                  Created {formatDate(data.track.createdAt)}
                </div>
              </GlassCard>
            </section>

            {/* Render Timeline Section */}
            <section>
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
                Render History
              </h3>
              {data.renderHistory.length === 0 ? (
                <p className="text-sm text-muted">No render jobs found</p>
              ) : (
                <div className="space-y-3">
                  {data.renderHistory.map((job, index) => {
                    const config = RENDER_STATUS_CONFIG[job.status] || RENDER_STATUS_CONFIG.pending;
                    const Icon = config.icon;

                    return (
                      <GlassCard key={job.id} hover="none" noPadding className="p-3">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                            job.status === 'completed' && 'bg-accent/10',
                            job.status === 'failed' && 'bg-error/10',
                            job.status !== 'completed' && job.status !== 'failed' && 'bg-primary/10',
                          )}>
                            <Icon className={cn('w-4 h-4', config.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <Badge
                                variant={
                                  job.status === 'completed' ? 'success' :
                                  job.status === 'failed' ? 'error' :
                                  'warning'
                                }
                                className="text-xs"
                              >
                                {config.label}
                              </Badge>
                              {job.progress > 0 && job.status !== 'completed' && (
                                <span className="text-xs text-muted">{job.progress}%</span>
                              )}
                            </div>
                            <p className="text-xs text-muted mt-1">
                              {formatDate(job.createdAt)}
                              {index === 0 && data.renderHistory.length > 1 && (
                                <span className="text-primary ml-1">(latest)</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </GlassCard>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Payment Section */}
            <section>
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
                Payment History
              </h3>
              {data.payments.length === 0 ? (
                <p className="text-sm text-muted">No payments found</p>
              ) : (
                <div className="space-y-3">
                  {data.payments.map((payment) => (
                    <GlassCard key={payment.id} hover="none" noPadding className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                            <CreditCard className="w-4 h-4 text-accent" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text capitalize">
                              {payment.type.replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs text-muted">
                              {formatDate(payment.createdAt)}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-text">
                          ${(payment.amount / 100).toFixed(2)}
                        </span>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Drawer>
  );
}
