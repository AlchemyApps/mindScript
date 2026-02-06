'use client';

import { cn } from '../../lib/utils';

export interface ConsentState {
  hasConsent: boolean;
  isOver18: boolean;
  acceptsTerms: boolean;
  ownsVoice: boolean;
  understandsUsage: boolean;
  noImpersonation: boolean;
}

interface ConsentCheckboxesProps {
  consent: ConsentState;
  onChange: (consent: ConsentState) => void;
  className?: string;
}

const CONSENT_ITEMS: { key: keyof ConsentState; label: string; detail: string }[] = [
  {
    key: 'hasConsent',
    label: 'I consent to voice cloning',
    detail: 'I voluntarily agree to have my voice cloned using AI technology for use in audio tracks.',
  },
  {
    key: 'isOver18',
    label: 'I am 18 years or older',
    detail: 'I confirm that I am at least 18 years of age.',
  },
  {
    key: 'acceptsTerms',
    label: 'I accept the terms of service',
    detail: 'I have read and accept the Terms of Service and Privacy Policy for voice cloning.',
  },
  {
    key: 'ownsVoice',
    label: 'This is my own voice',
    detail: 'I confirm that the audio sample contains my own voice and I have the right to clone it.',
  },
  {
    key: 'understandsUsage',
    label: 'I understand how my voice will be used',
    detail: 'My cloned voice will be used to generate audio for meditation and affirmation tracks that I create.',
  },
  {
    key: 'noImpersonation',
    label: 'I agree to the no-impersonation policy',
    detail: 'I will not use this technology to impersonate others or for any unlawful purpose.',
  },
];

export function ConsentCheckboxes({ consent, onChange, className }: ConsentCheckboxesProps) {
  const allChecked = Object.values(consent).every(Boolean);

  const handleToggle = (key: keyof ConsentState) => {
    onChange({ ...consent, [key]: !consent[key] });
  };

  const handleToggleAll = () => {
    const newValue = !allChecked;
    onChange({
      hasConsent: newValue,
      isOver18: newValue,
      acceptsTerms: newValue,
      ownsVoice: newValue,
      understandsUsage: newValue,
      noImpersonation: newValue,
    });
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="space-y-3">
        {CONSENT_ITEMS.map((item) => (
          <label
            key={item.key}
            className={cn(
              'flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer',
              consent[item.key]
                ? 'border-accent/30 bg-accent/5'
                : 'border-gray-100 bg-white hover:border-gray-200'
            )}
          >
            <div className="mt-0.5 flex-shrink-0">
              <input
                type="checkbox"
                checked={consent[item.key]}
                onChange={() => handleToggle(item.key)}
                className="sr-only"
              />
              <div
                className={cn(
                  'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200',
                  consent[item.key]
                    ? 'bg-accent border-accent'
                    : 'border-gray-300 bg-white'
                )}
              >
                {consent[item.key] && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <span className="text-sm font-medium text-text block">{item.label}</span>
              <span className="text-xs text-muted mt-0.5 block leading-relaxed">{item.detail}</span>
            </div>
          </label>
        ))}
      </div>

      {/* Select all shortcut */}
      <button
        type="button"
        onClick={handleToggleAll}
        className="text-xs text-primary hover:text-primary/80 transition-colors"
      >
        {allChecked ? 'Uncheck all' : 'Accept all'}
      </button>
    </div>
  );
}

export const EMPTY_CONSENT: ConsentState = {
  hasConsent: false,
  isOver18: false,
  acceptsTerms: false,
  ownsVoice: false,
  understandsUsage: false,
  noImpersonation: false,
};

export function isConsentComplete(consent: ConsentState): boolean {
  return Object.values(consent).every(Boolean);
}
