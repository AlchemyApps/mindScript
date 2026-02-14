import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

interface RenderCompleteProps {
  trackTitle: string
  downloadUrl: string
  shareUrl: string
  duration: string
  customerName: string
}

export const RenderCompleteEmail = ({
  trackTitle = 'Your Track',
  downloadUrl = '',
  shareUrl = '',
  duration = '10:00',
  customerName = 'Creator',
}: RenderCompleteProps) => {
  const previewText = `Your track "${trackTitle}" is ready!`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoContainer}>
            <Img
              src="https://mindscript.app/logo.png"
              width="120"
              height="40"
              alt="MindScript"
              style={logo}
            />
          </Section>

          <Section style={successIcon}>
            <Text style={successEmoji}>🎧</Text>
          </Section>

          <Heading style={h1}>Your Track is Ready!</Heading>

          <Text style={text}>Hi {customerName},</Text>

          <Text style={text}>
            Great news! Your audio track has been successfully rendered and is ready for you.
          </Text>

          <Section style={trackCard}>
            <Img
              src="https://mindscript.app/waveform-placeholder.png"
              width="100%"
              height="80"
              alt="Audio Waveform"
              style={waveform}
            />

            <Text style={trackTitleStyle}>{trackTitle}</Text>
            <Text style={trackDurationStyle}>Duration: {duration}</Text>
          </Section>

          <Section style={buttonContainer}>
            <Button style={primaryButton} href={downloadUrl}>
              Download Track
            </Button>
          </Section>

          <Section style={secondaryActions}>
            <Button style={secondaryButton} href={shareUrl}>
              Share with Friends
            </Button>
          </Section>

          <Section style={tipsSection}>
            <Text style={tipsTitle}>Pro Tips:</Text>
            <Text style={tip}>
              🎵 Listen with headphones for the best experience
            </Text>
            <Text style={tip}>
              🌙 Use during meditation or before sleep
            </Text>
            <Text style={tip}>
              📱 Save to your device for offline listening
            </Text>
            <Text style={tip}>
              💫 Create a playlist with multiple tracks
            </Text>
          </Section>

          <Hr style={hr} />

          <Section style={ctaSection}>
            <Text style={ctaText}>
              Ready to create another transformative audio experience?
            </Text>
            <Button style={ctaButton} href="https://mindscript.app/create">
              Create New Track
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            Questions? Reply to this email or visit our{' '}
            <Link href="https://mindscript.app/help" style={link}>
              Help Center
            </Link>
          </Text>

          <Text style={footer}>
            MindScript · Transform your mind through sound
          </Text>

          <Text style={unsubscribe}>
            <Link href="https://mindscript.app/unsubscribe" style={link}>
              Manage notifications
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default RenderCompleteEmail

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  marginBottom: '64px',
  borderRadius: '8px',
  maxWidth: '600px',
}

const logoContainer = {
  textAlign: 'center' as const,
  marginBottom: '24px',
}

const logo = {
  margin: '0 auto',
}

const successIcon = {
  textAlign: 'center' as const,
  margin: '24px 0',
}

const successEmoji = {
  fontSize: '48px',
  lineHeight: '1',
}

const h1 = {
  color: '#1a1a1a',
  fontSize: '28px',
  fontWeight: '600',
  lineHeight: '36px',
  margin: '16px 0 30px',
  textAlign: 'center' as const,
}

const text = {
  color: '#525252',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
}

const trackCard = {
  backgroundColor: '#f9fafb',
  borderRadius: '12px',
  padding: '20px',
  margin: '32px 0',
  textAlign: 'center' as const,
}

const waveform = {
  borderRadius: '8px',
  marginBottom: '16px',
}

const trackTitleStyle = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: '600',
  margin: '8px 0',
}

const trackDurationStyle = {
  color: '#6b7280',
  fontSize: '14px',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const primaryButton = {
  backgroundColor: '#3b82f6',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  lineHeight: '100%',
  padding: '12px 32px',
  textAlign: 'center' as const,
  textDecoration: 'none',
}

const secondaryActions = {
  textAlign: 'center' as const,
  margin: '16px 0',
}

const secondaryButton = {
  backgroundColor: '#ffffff',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  color: '#374151',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '500',
  lineHeight: '100%',
  padding: '10px 24px',
  textAlign: 'center' as const,
  textDecoration: 'none',
}

const tipsSection = {
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  padding: '20px',
  margin: '32px 0',
}

const tipsTitle = {
  color: '#92400e',
  fontSize: '16px',
  fontWeight: '600',
  marginBottom: '12px',
}

const tip = {
  color: '#78350f',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '8px 0',
}

const ctaSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const ctaText = {
  color: '#525252',
  fontSize: '16px',
  lineHeight: '24px',
  marginBottom: '16px',
}

const ctaButton = {
  backgroundColor: '#10b981',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '600',
  lineHeight: '100%',
  padding: '10px 24px',
  textAlign: 'center' as const,
  textDecoration: 'none',
}

const hr = {
  borderColor: '#e5e7eb',
  margin: '32px 0',
}

const footer = {
  color: '#9ca3af',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '8px 0',
  textAlign: 'center' as const,
}

const link = {
  color: '#3b82f6',
  textDecoration: 'underline',
}

const unsubscribe = {
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '16px',
  marginTop: '32px',
  textAlign: 'center' as const,
}