'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  X,
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
import { ConsentCheckboxes, EMPTY_CONSENT, isConsentComplete, type ConsentState } from './ConsentCheckboxes';
import { VoiceRecorder } from './VoiceRecorder';

interface VoiceCloneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  className?: string;
}

type WizardStep = 'intro' | 'consent' | 'record' | 'review' | 'processing';

const STEP_ORDER: WizardStep[] = ['intro', 'consent', 'record', 'review'];

export function VoiceCloneModal({ isOpen, onClose, onComplete, className }: VoiceCloneModalProps) {
  const [step, setStep] = useState<WizardStep>('intro');
  const [consent, setConsent] = useState<ConsentState>(EMPTY_CONSENT);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [voiceName, setVoiceName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Reset state when modal opens
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

      const { url } = await response.json();
      // Redirect to Stripe checkout
      window.location.href = url;
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className={cn(
          'relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl',
          'animate-scale-in',
          className
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white/95 backdrop-blur-sm rounded-t-2xl">
          <div className="flex items-center gap-3">
            {stepIndex > 0 && step !== 'processing' && (
              <button
                type="button"
                onClick={handleBack}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-muted hover:text-text transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="font-bold font-heading text-text">Create Your Voice</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-muted hover:text-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        {step !== 'processing' && (
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
              <span className="text-[10px] text-muted">Step {stepIndex + 1} of {STEP_ORDER.length}</span>
              <span className="text-[10px] text-muted capitalize">{step}</span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-6">
          {/* Step 1: Intro */}
          {step === 'intro' && (
            <div className="space-y-6">
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
                  <Mic className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold font-heading text-text">
                  Clone Your Voice with AI
                </h3>
                <p className="text-sm text-muted leading-relaxed max-w-sm mx-auto">
                  Record a short sample of your voice and our AI will create a custom voice
                  clone that you can use on any track you create.
                </p>
              </div>

              {/* Feature highlights */}
              <div className="space-y-3">
                <FeatureItem
                  icon={<Sparkles className="w-4 h-4 text-primary" />}
                  title="One-time fee of $29"
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

              {/* Price badge */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-center">
                <span className="text-2xl font-bold text-primary">$29</span>
                <span className="text-sm text-muted ml-2">one-time fee</span>
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
                  Please review and accept all agreements before proceeding
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
                  Give your voice a name and review before payment
                </p>
              </div>

              {/* Voice name input */}
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

              {/* Summary */}
              <div className="p-4 rounded-xl bg-gray-50 space-y-3">
                <h4 className="text-xs font-semibold text-muted uppercase tracking-wide">Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Audio Duration</span>
                    <span className="font-medium text-text">{Math.floor(audioDuration / 60)}:{(audioDuration % 60).toString().padStart(2, '0')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Consent</span>
                    <span className="font-medium text-accent">Complete</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="font-semibold text-text">Total</span>
                    <span className="font-bold text-primary text-lg">$29.00</span>
                  </div>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Processing state */}
          {step === 'processing' && (
            <div className="text-center py-8 space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
              <div>
                <h3 className="font-bold text-text">Creating your voice...</h3>
                <p className="text-sm text-muted mt-1">This usually takes 30-60 seconds</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer with actions */}
        {step !== 'processing' && (
          <div className="sticky bottom-0 px-6 py-4 border-t border-gray-100 bg-white/95 backdrop-blur-sm rounded-b-2xl">
            {step === 'review' ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canAdvance() || submitting}
                className={cn(
                  'w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-300',
                  'bg-primary hover:bg-primary/90',
                  (!canAdvance() || submitting) && 'opacity-50 cursor-not-allowed',
                  !submitting && canAdvance() && 'hover:shadow-lg hover:shadow-primary/20',
                )}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Redirecting to checkout...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Pay $29 & Create Voice
                  </span>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canAdvance()}
                className={cn(
                  'w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-300',
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
        )}
      </div>
    </div>
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
