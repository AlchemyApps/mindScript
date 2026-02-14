import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Listener Terms of Service - MindScript',
  description: 'Terms of service for MindScript mobile app listeners.',
};

export default function ListenerTermsPage() {
  return (
    <article className="prose prose-gray max-w-none">
      <h1>Listener Terms of Service</h1>
      <p className="text-sm text-gray-500">Last updated: February 2026</p>

      <p>
        These terms govern your use of the MindScript mobile application as a listener.
        By using the app, you agree to these terms.
      </p>

      <h2>1. Your Account</h2>
      <ul>
        <li>You must provide accurate information when creating an account</li>
        <li>You are responsible for maintaining the security of your account credentials</li>
        <li>One account per person; sharing accounts is not permitted</li>
      </ul>

      <h2>2. Using MindScript</h2>
      <p>MindScript provides access to audio content for personal listening. You may:</p>
      <ul>
        <li>Stream and download tracks from your library for personal, non-commercial use</li>
        <li>Create and manage playlists</li>
        <li>Customize playback settings (speed, repeat, sleep timer)</li>
      </ul>

      <h2>3. Content &amp; Downloads</h2>
      <ul>
        <li>Downloaded tracks are for personal use on your devices only</li>
        <li>You may not redistribute, share, or publicly perform tracks from MindScript</li>
        <li>Downloaded content may be removed if your account is deleted or if the content is removed from the platform</li>
      </ul>

      <h2>4. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Attempt to circumvent security measures or access restrictions</li>
        <li>Use automated tools to scrape or download content in bulk</li>
        <li>Reverse engineer the app or its audio processing</li>
        <li>Use the service for any illegal purpose</li>
      </ul>

      <h2>5. Account Management</h2>
      <ul>
        <li>You can delete your account at any time from the app&apos;s Settings screen</li>
        <li>Account deletion has a 30-day grace period; log back in to cancel</li>
        <li>We may suspend accounts that violate these terms</li>
      </ul>

      <h2>6. Disclaimers</h2>
      <ul>
        <li>MindScript content is for personal wellness and entertainment purposes only</li>
        <li>Content is not a substitute for professional medical, psychological, or therapeutic advice</li>
        <li>We do not guarantee specific outcomes from listening to any track</li>
      </ul>

      <h2>7. Limitation of Liability</h2>
      <p>
        MindScript is provided &quot;as is&quot; without warranty of any kind. To the maximum
        extent permitted by law, we shall not be liable for any indirect, incidental, or
        consequential damages arising from your use of the service.
      </p>

      <h2>8. Changes to Terms</h2>
      <p>
        We may update these terms from time to time. Continued use of the app after
        changes constitutes acceptance of the updated terms.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about these terms? Contact us at{' '}
        <a href="mailto:support@mindscript.studio">support@mindscript.studio</a>.
      </p>
    </article>
  );
}
