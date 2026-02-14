import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - MindScript',
  description: 'MindScript privacy policy for listeners and creators.',
};

export default function PrivacyPolicyPage() {
  return (
    <article className="prose prose-gray max-w-none">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-gray-500">Last updated: February 2026</p>

      <p>
        MindScript (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) operates the MindScript
        mobile application and website. This policy explains how we collect, use, and
        protect your information.
      </p>

      <h2>1. Information We Collect</h2>

      <h3>Account Information</h3>
      <ul>
        <li>Email address and password (for authentication)</li>
        <li>Display name and profile information (optional)</li>
      </ul>

      <h3>Usage Data</h3>
      <ul>
        <li>Listening history and playback preferences</li>
        <li>Playlist data and library organization</li>
        <li>Device information (OS version, app version, device model)</li>
        <li>Crash reports and performance metrics</li>
      </ul>

      <h3>For Creators (Web App Only)</h3>
      <ul>
        <li>Payment information processed by Stripe (we do not store card details)</li>
        <li>Content you create (scripts, audio configurations, track metadata)</li>
        <li>Payout information for marketplace earnings</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>Provide and maintain the MindScript service</li>
        <li>Personalize your listening experience</li>
        <li>Sync your library, playlists, and preferences across devices</li>
        <li>Process payments and manage subscriptions (creators)</li>
        <li>Send transactional emails (account verification, receipts, deletion notices)</li>
        <li>Improve our service and fix bugs</li>
      </ul>

      <h2>3. Third-Party Services</h2>
      <p>We use the following third-party services:</p>
      <ul>
        <li><strong>Supabase</strong> - Authentication, database, and file storage</li>
        <li><strong>Stripe</strong> - Payment processing (creators and purchasers)</li>
        <li><strong>Sentry</strong> - Error tracking and crash reporting</li>
        <li><strong>ElevenLabs</strong> - Text-to-speech voice generation</li>
        <li><strong>OpenAI</strong> - AI-assisted script generation</li>
        <li><strong>Resend</strong> - Transactional email delivery</li>
      </ul>
      <p>Each service has its own privacy policy governing how they handle data.</p>

      <h2>4. Data Retention</h2>
      <ul>
        <li>Account data is retained for as long as your account is active</li>
        <li>Upon account deletion, data is removed after a 30-day grace period</li>
        <li>Purchased content remains accessible to buyers (creator name is anonymized)</li>
        <li>Crash and analytics data is retained for up to 90 days</li>
      </ul>

      <h2>5. Account Deletion</h2>
      <p>
        You can request account deletion from the Settings screen in the mobile app or
        from your profile settings on the web. Account deletion follows a 30-day grace
        period during which you can cancel by logging back in.
      </p>
      <p>After 30 days:</p>
      <ul>
        <li>Your profile information is permanently anonymized</li>
        <li>Your personal data and preferences are deleted</li>
        <li>Content you created for the marketplace is anonymized but remains available to existing buyers</li>
      </ul>

      <h2>6. Data Security</h2>
      <p>
        We implement industry-standard security measures including encrypted connections
        (TLS), secure token storage, and row-level security policies on our database. Audio
        files are served via signed URLs with limited expiration.
      </p>

      <h2>7. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you</li>
        <li>Request correction of inaccurate data</li>
        <li>Request deletion of your account and data</li>
        <li>Export your data</li>
      </ul>

      <h2>8. Children&apos;s Privacy</h2>
      <p>
        MindScript is not directed at children under 13. We do not knowingly collect
        information from children under 13.
      </p>

      <h2>9. Changes to This Policy</h2>
      <p>
        We may update this policy from time to time. We will notify you of significant
        changes via email or in-app notification.
      </p>

      <h2>10. Contact Us</h2>
      <p>
        For questions about this privacy policy or your data, contact us at{' '}
        <a href="mailto:privacy@mindscript.studio">privacy@mindscript.studio</a>.
      </p>
    </article>
  );
}
