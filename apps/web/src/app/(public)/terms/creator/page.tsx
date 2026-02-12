import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Creator Terms of Service - MindScript',
  description: 'Terms of service for MindScript web platform creators.',
};

export default function CreatorTermsPage() {
  return (
    <article className="prose prose-gray max-w-none">
      <h1>Creator Terms of Service</h1>
      <p className="text-sm text-gray-500">Last updated: February 2026</p>

      <p>
        These terms govern your use of the MindScript web platform as a content creator.
        By creating and publishing content on MindScript, you agree to these terms in
        addition to our general Privacy Policy.
      </p>

      <h2>1. Creator Accounts</h2>
      <ul>
        <li>You must provide accurate information and maintain your account security</li>
        <li>Creator features require completion of a seller agreement</li>
        <li>You must be at least 18 years old to create and sell content</li>
      </ul>

      <h2>2. Content Creation</h2>
      <ul>
        <li>You retain ownership of the original scripts and text you create</li>
        <li>You grant MindScript a license to render, host, and distribute your content through the platform</li>
        <li>Audio rendering uses third-party voice synthesis; you must comply with voice provider terms</li>
        <li>You are responsible for ensuring your content does not infringe on others&apos; rights</li>
      </ul>

      <h2>3. Marketplace</h2>
      <ul>
        <li>You may list tracks on the MindScript marketplace for sale</li>
        <li>Pricing is set within ranges defined by the platform</li>
        <li>MindScript takes a platform fee from each sale (details in seller agreement)</li>
        <li>You must not make misleading claims about your content</li>
      </ul>

      <h2>4. Revenue &amp; Payouts</h2>
      <ul>
        <li>Earnings are tracked in your seller dashboard</li>
        <li>Payouts are processed through Stripe Connect</li>
        <li>You are responsible for your own tax obligations</li>
        <li>Minimum payout thresholds may apply</li>
      </ul>

      <h2>5. Intellectual Property</h2>
      <ul>
        <li>You must have rights to all content you publish</li>
        <li>MindScript may remove content that infringes on intellectual property rights</li>
        <li>The MindScript name, logo, and platform are our intellectual property</li>
      </ul>

      <h2>6. Content Guidelines</h2>
      <p>Content must not:</p>
      <ul>
        <li>Contain harmful, hateful, or discriminatory material</li>
        <li>Make unsubstantiated medical or health claims</li>
        <li>Infringe on copyrights or trademarks</li>
        <li>Contain inappropriate or explicit material</li>
      </ul>

      <h2>7. Account Deletion</h2>
      <ul>
        <li>You can request account deletion at any time</li>
        <li>A 30-day grace period applies to all deletions</li>
        <li>If you have active marketplace listings, they will be removed from sale</li>
        <li>Existing buyers retain access to purchased content (creator name anonymized)</li>
        <li>Pending payouts will be processed before account closure</li>
      </ul>

      <h2>8. Liability</h2>
      <ul>
        <li>You are solely responsible for the content you create and publish</li>
        <li>MindScript is not liable for how listeners use or interpret your content</li>
        <li>You agree to indemnify MindScript against claims arising from your content</li>
      </ul>

      <h2>9. Termination</h2>
      <p>
        MindScript may suspend or terminate creator accounts that violate these terms,
        engage in fraudulent activity, or receive repeated content violations.
      </p>

      <h2>10. Changes to Terms</h2>
      <p>
        We may update these terms from time to time. Material changes will be communicated
        via email. Continued use of creator features after changes constitutes acceptance.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about creator terms? Contact us at{' '}
        <a href="mailto:creators@mindscript.studio">creators@mindscript.studio</a>.
      </p>
    </article>
  );
}
