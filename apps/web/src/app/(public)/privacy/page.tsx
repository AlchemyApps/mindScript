import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - MindScript',
  description: 'MindScript privacy policy for listeners and creators.',
};

export default function PrivacyPolicyPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold text-text font-heading mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted mb-8">Last updated: February 2026</p>

      <p className="text-text/80 leading-relaxed mb-6">
        MindScript (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) operates the MindScript
        mobile application and website. This policy explains how we collect, use, and
        protect your information.
      </p>

      <h2 className="text-xl font-semibold text-text mt-8 mb-3">1. Information We Collect</h2>

      <h3 className="text-base font-semibold text-text/90 mt-5 mb-2">Account Information</h3>
      <ul className="list-disc pl-6 space-y-1 text-text/80 mb-4">
        <li>Email address and password (for authentication)</li>
        <li>Display name and profile information (optional)</li>
      </ul>

      <h3 className="text-base font-semibold text-text/90 mt-5 mb-2">Usage Data</h3>
      <ul className="list-disc pl-6 space-y-1 text-text/80 mb-4">
        <li>Listening history and playback preferences</li>
        <li>Playlist data and library organization</li>
        <li>Device information (OS version, app version, device model)</li>
        <li>Crash reports and performance metrics</li>
      </ul>

      <h3 className="text-base font-semibold text-text/90 mt-5 mb-2">For Creators (Web App Only)</h3>
      <ul className="list-disc pl-6 space-y-1 text-text/80 mb-4">
        <li>Payment information processed by Stripe (we do not store card details)</li>
        <li>Content you create (scripts, audio configurations, track metadata)</li>
        <li>Payout information for marketplace earnings</li>
      </ul>

      <h2 className="text-xl font-semibold text-text mt-8 mb-3">2. How We Use Your Information</h2>
      <ul className="list-disc pl-6 space-y-1 text-text/80 mb-4">
        <li>Provide and maintain the MindScript service</li>
        <li>Personalize your listening experience</li>
        <li>Sync your library, playlists, and preferences across devices</li>
        <li>Process payments and manage subscriptions (creators)</li>
        <li>Send transactional emails (account verification, receipts, deletion notices)</li>
        <li>Improve our service and fix bugs</li>
      </ul>

      <h2 className="text-xl font-semibold text-text mt-8 mb-3">3. Third-Party Services</h2>
      <p className="text-text/80 leading-relaxed mb-3">We use the following third-party services:</p>
      <ul className="list-disc pl-6 space-y-1 text-text/80 mb-4">
        <li><strong className="font-medium text-text">Supabase</strong> - Authentication, database, and file storage</li>
        <li><strong className="font-medium text-text">Stripe</strong> - Payment processing (creators and purchasers)</li>
        <li><strong className="font-medium text-text">Sentry</strong> - Error tracking and crash reporting</li>
        <li><strong className="font-medium text-text">ElevenLabs</strong> - Text-to-speech voice generation</li>
        <li><strong className="font-medium text-text">OpenAI</strong> - AI-assisted script generation</li>
        <li><strong className="font-medium text-text">Resend</strong> - Transactional email delivery</li>
      </ul>
      <p className="text-text/80 leading-relaxed mb-4">Each service has its own privacy policy governing how they handle data.</p>

      <h2 className="text-xl font-semibold text-text mt-8 mb-3">4. Data Retention</h2>
      <ul className="list-disc pl-6 space-y-1 text-text/80 mb-4">
        <li>Account data is retained for as long as your account is active</li>
        <li>Upon account deletion, data is removed after a 30-day grace period</li>
        <li>Purchased content remains accessible to buyers (creator name is anonymized)</li>
        <li>Crash and analytics data is retained for up to 90 days</li>
      </ul>

      <h2 className="text-xl font-semibold text-text mt-8 mb-3">5. Account Deletion</h2>
      <p className="text-text/80 leading-relaxed mb-3">
        You can request account deletion from the Settings screen in the mobile app or
        from your profile settings on the web. Account deletion follows a 30-day grace
        period during which you can cancel by logging back in.
      </p>
      <p className="text-text/80 leading-relaxed mb-3">After 30 days:</p>
      <ul className="list-disc pl-6 space-y-1 text-text/80 mb-4">
        <li>Your profile information is permanently anonymized</li>
        <li>Your personal data and preferences are deleted</li>
        <li>Content you created for the marketplace is anonymized but remains available to existing buyers</li>
      </ul>

      <h2 className="text-xl font-semibold text-text mt-8 mb-3">6. Data Security</h2>
      <p className="text-text/80 leading-relaxed mb-4">
        We implement industry-standard security measures including encrypted connections
        (TLS), secure token storage, and row-level security policies on our database. Audio
        files are served via signed URLs with limited expiration.
      </p>

      <h2 className="text-xl font-semibold text-text mt-8 mb-3">7. Your Rights</h2>
      <p className="text-text/80 leading-relaxed mb-3">You have the right to:</p>
      <ul className="list-disc pl-6 space-y-1 text-text/80 mb-4">
        <li>Access the personal data we hold about you</li>
        <li>Request correction of inaccurate data</li>
        <li>Request deletion of your account and data</li>
        <li>Export your data</li>
      </ul>

      <h2 className="text-xl font-semibold text-text mt-8 mb-3">8. Children&apos;s Privacy</h2>
      <p className="text-text/80 leading-relaxed mb-4">
        MindScript is not directed at children under 13. We do not knowingly collect
        information from children under 13.
      </p>

      <h2 className="text-xl font-semibold text-text mt-8 mb-3">9. Changes to This Policy</h2>
      <p className="text-text/80 leading-relaxed mb-4">
        We may update this policy from time to time. We will notify you of significant
        changes via email or in-app notification.
      </p>

      <h2 className="text-xl font-semibold text-text mt-8 mb-3">10. Contact Us</h2>
      <p className="text-text/80 leading-relaxed">
        For questions about this privacy policy or your data, contact us at{' '}
        <a href="mailto:privacy@mindscript.studio" className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors">
          privacy@mindscript.studio
        </a>.
      </p>
    </article>
  );
}
