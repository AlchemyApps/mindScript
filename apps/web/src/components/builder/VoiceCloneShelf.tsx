'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Mic,
  Shield,
  Sparkles,
  Loader2,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Drawer } from '../ui/Drawer';
import { ConsentCheckboxes, EMPTY_CONSENT, isConsentComplete, type ConsentState } from './ConsentCheckboxes';
import { VoiceRecorder } from './VoiceRecorder';
import { usePlayerStore } from '@/store/playerStore';

interface VoiceCloneShelfProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type WizardStep = 'intro' | 'consent' | 'record' | 'review';

const STEP_ORDER: WizardStep[] = ['intro', 'consent', 'record', 'review'];

export function VoiceCloneShelf({ isOpen, onClose, onComplete }: VoiceCloneShelfProps) {
  const [step, setStep] = useState<WizardStep>('intro');
  const [consent, setConsent] = useState<ConsentState>(EMPTY_CONSENT);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [voiceName, setVoiceName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFF, setIsFF] = useState(false);
  const [cloneFeeCents, setCloneFeeCents] = useState(2900);

  const { minimizeToPip, setPlayerMode, currentTrack } = usePlayerStore();

  // Check F&F status and fetch dynamic pricing
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/pricing/check-eligibility')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.ffTier === 'inner_circle' || data?.ffTier === 'cost_pass') {
          setIsFF(true);
        }
        if (data?.voiceCloneFeeCents) {
          setCloneFeeCents(data.voiceCloneFeeCents);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // When shelf opens, minimize player to PIP
  useEffect(() => {
    if (isOpen && currentTrack) {
      minimizeToPip();
    }
  }, [isOpen, currentTrack, minimizeToPip]);

  // When shelf closes, restore player to bar
  const handleClose = useCallback(() => {
    if (currentTrack) {
      setPlayerMode('bar');
    }
    onClose();
  }, [currentTrack, setPlayerMode, onClose]);

  // Reset state when shelf opens
  useEffect(() => {
    if (isOpen) {
      setStep('intro');
      setConsent(EMPTY_CONSENT);
      setAudioFile(null);
      setAudioDuration(0);
      setVoiceName('');
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  const stepIndex = STEP_ORDER.indexOf(step);

  const canAdvance = useCallback(() => {
    switch (step) {
      case 'intro': return true;
      case 'consent': return isConsentComplete(consent);
      case 'record': return audioFile !== null && audioDuration >= 60;
      case 'review': return voiceName.trim().length > 0;
      default: return false;
    }
  }, [step, consent, audioFile, audioDuration, voiceName]);

  const handleNext = useCallback(() => {
    if (!canAdvance()) return;
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEP_ORDER.length) {
      setStep(STEP_ORDER[nextIndex]);
      setError(null);
    }
  }, [canAdvance, stepIndex]);

  const handleBack = useCallback(() => {
    if (stepIndex > 0) {
      setStep(STEP_ORDER[stepIndex - 1]);
      setError(null);
    }
  }, [stepIndex]);

  const handleSubmit = useCallback(async () => {
    if (!audioFile || !voiceName.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('name', voiceName.trim());
      formData.append('consent', JSON.stringify({
        ...consent,
        timestamp: new Date().toISOString(),
      }));

      const response = await fetch('/api/voices/clone/initiate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to initiate voice cloning');
      }

      const data = await response.json();
      if (data.skipStripe) {
        // F&F user — clone started without payment
        window.location.href = data.url;
      } else {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }, [audioFile, voiceName, consent]);

  const handleAudioReady = useCallback((file: File, duration: number) => {
    setAudioFile(file);
    setAudioDuration(duration);
  }, []);

  const handleAudioClear = useCallback(() => {
    setAudioFile(null);
    setAudioDuration(0);
  }, []);

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title="Create Your Voice">
      <div className="flex flex-col h-full">
        {/* Progress bar */}
        <div className="px-6 pt-4">
          <div className="flex gap-1.5">
            {STEP_ORDER.map((s, i) => (
              <div
                key={s}
                className={cn(
                  'h-1 flex-1 rounded-full transition-all duration-300',
                  i <= stepIndex ? 'bg-primary' : 'bg-gray-200'
                )}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-muted">
              Step {stepIndex + 1} of {STEP_ORDER.length}
            </span>
            <span className="text-[10px] text-muted capitalize">{step}</span>
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 px-6 py-6 overflow-y-auto">
          {/* Step 1: Intro */}
          {step === 'intro' && (
            <div className="space-y-6">
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
                  <Mic className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold font-heading text-text">
                  Clone Your Voice
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  Record a short sample of your voice and we'll create a custom voice
                  clone that you can use on any track you create.
                </p>
              </div>

              <div className="space-y-3">
                <FeatureItem
                  icon={<Sparkles className="w-4 h-4 text-primary" />}
                  title={isFF ? 'Free for Friends & Family' : `One-time fee of $${(cloneFeeCents / 100).toFixed(0)}`}
                  description="Create your voice once, use it on unlimited tracks"
                />
                <FeatureItem
                  icon={<Mic className="w-4 h-4 text-accent" />}
                  title="60-180 seconds of audio"
                  description="Record or upload a clear sample of your voice"
                />
                <FeatureItem
                  icon={<Shield className="w-4 h-4 text-blue-500" />}
                  title="Secure & private"
                  description="Your voice data is encrypted and never shared"
                />
              </div>

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-center">
                {isFF ? (
                  <>
                    <span className="text-2xl font-bold text-accent">FREE</span>
                    <span className="text-sm text-muted ml-2">
                      <span className="line-through">${(cloneFeeCents / 100).toFixed(0)}</span> — Friends & Family
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-bold text-primary">${(cloneFeeCents / 100).toFixed(0)}</span>
                    <span className="text-sm text-muted ml-2">one-time fee</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Consent */}
          {step === 'consent' && (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent/10">
                  <Shield className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-lg font-bold font-heading text-text">
                  Consent & Agreement
                </h3>
                <p className="text-sm text-muted">
                  Please review and accept all agreements
                </p>
              </div>

              <ConsentCheckboxes consent={consent} onChange={setConsent} />
            </div>
          )}

          {/* Step 3: Record */}
          {step === 'record' && (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-500/10">
                  <Mic className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-lg font-bold font-heading text-text">
                  Record Your Voice
                </h3>
                <p className="text-sm text-muted">
                  Provide 60-180 seconds of clear audio
                </p>
              </div>

              <VoiceRecorder
                onAudioReady={handleAudioReady}
                onClear={handleAudioClear}
                hasAudio={audioFile !== null}
              />
            </div>
          )}

          {/* Step 4: Review & Name */}
          {step === 'review' && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold font-heading text-text">
                  Review & Name
                </h3>
                <p className="text-sm text-muted">
                  {isFF ? 'Give your voice a name and review before creating' : 'Give your voice a name and review before payment'}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text block">Voice Name</label>
                <input
                  type="text"
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  placeholder="e.g., My Voice, Studio Voice"
                  maxLength={100}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <span className="text-xs text-muted">{voiceName.length}/100</span>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 space-y-3">
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wide">Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Audio Duration</span>
                    <span className="font-medium text-text">
                      {Math.floor(audioDuration / 60)}:{(audioDuration % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Consent</span>
                    <span className="font-medium text-accent">Complete</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="font-semibold text-text">Total</span>
                    {isFF ? (
                      <span className="font-bold text-accent text-lg">
                        <span className="line-through text-muted text-sm mr-2">${(cloneFeeCents / 100).toFixed(2)}</span>
                        $0.00
                      </span>
                    ) : (
                      <span className="font-bold text-primary text-lg">${(cloneFeeCents / 100).toFixed(2)}</span>
                    )}
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with actions */}
        <div className="px-6 py-4 border-t border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-muted hover:text-text transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            {step === 'review' ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canAdvance() || submitting}
                className={cn(
                  'flex-1 py-3 px-6 rounded-xl font-semibold text-white transition-all duration-300',
                  'bg-primary hover:bg-primary/90',
                  (!canAdvance() || submitting) && 'opacity-50 cursor-not-allowed',
                  !submitting && canAdvance() && 'hover:shadow-lg hover:shadow-primary/20',
                )}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isFF ? 'Creating your voice...' : 'Redirecting to checkout...'}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    {isFF ? (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Create Voice — Free
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        Pay ${(cloneFeeCents / 100).toFixed(0)} & Create Voice
                      </>
                    )}
                  </span>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canAdvance()}
                className={cn(
                  'flex-1 py-3 px-6 rounded-xl font-semibold text-white transition-all duration-300',
                  'bg-primary hover:bg-primary/90',
                  !canAdvance() && 'opacity-50 cursor-not-allowed',
                  canAdvance() && 'hover:shadow-lg hover:shadow-primary/20',
                )}
              >
                <span className="flex items-center justify-center gap-2">
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/80">
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div>
        <span className="text-sm font-medium text-text block">{title}</span>
        <span className="text-xs text-muted">{description}</span>
      </div>
    </div>
  );
}
