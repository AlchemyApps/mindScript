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

interface WelcomeEmailProps {
  firstName: string
  verificationUrl?: string
  loginUrl: string
}

export const WelcomeEmail = ({
  firstName = 'there',
  verificationUrl,
  loginUrl = 'https://mindscript.app/login',
}: WelcomeEmailProps) => {
  const previewText = `Welcome to MindScript, ${firstName}!`

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

          <Heading style={h1}>Welcome to MindScript! 🎵</Heading>

          <Text style={text}>Hi {firstName},</Text>

          <Text style={text}>
            We're thrilled to have you join the MindScript community! You're now part of a
            growing platform where creators share transformative audio experiences powered
            by mindfulness, meditation, and healing frequencies.
          </Text>

          <Section style={featureSection}>
            <Text style={featureTitle}>What you can do with MindScript:</Text>
            <Text style={feature}>
              ✨ Create custom meditation tracks with AI voices
            </Text>
            <Text style={feature}>
              🎵 Add background music and healing frequencies
            </Text>
            <Text style={feature}>
              💰 Sell your creations on our marketplace
            </Text>
            <Text style={feature}>
              🎧 Discover tracks from other creators
            </Text>
          </Section>

          {verificationUrl ? (
            <>
              <Text style={text}>
                To get started, please verify your email address:
              </Text>
              <Section style={buttonContainer}>
                <Button style={button} href={verificationUrl}>
                  Verify Email Address
                </Button>
              </Section>
            </>
          ) : (
            <Section style={buttonContainer}>
              <Button style={button} href={loginUrl}>
                Get Started
              </Button>
            </Section>
          )}

          <Hr style={hr} />

          <Text style={footer}>
            Need help? Reply to this email or visit our{' '}
            <Link href="https://mindscript.app/help" style={link}>
              Help Center
            </Link>
          </Text>

          <Text style={footer}>
            MindScript · Transform your mind through sound
          </Text>

          <Text style={unsubscribe}>
            <Link href="https://mindscript.app/unsubscribe" style={link}>
              Unsubscribe
            </Link>{' '}
            from these emails
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default WelcomeEmail

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
  marginBottom: '32px',
}

const logo = {
  margin: '0 auto',
}

const h1 = {
  color: '#1a1a1a',
  fontSize: '28px',
  fontWeight: '600',
  lineHeight: '36px',
  margin: '30px 0',
  textAlign: 'center' as const,
}

const text = {
  color: '#525252',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
}

const featureSection = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '24px',
  margin: '32px 0',
}

const featureTitle = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '600',
  marginBottom: '12px',
}

const feature = {
  color: '#525252',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '8px 0',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: '#3b82f6',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  lineHeight: '100%',
  padding: '12px 24px',
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