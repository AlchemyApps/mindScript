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

interface PasswordResetProps {
  resetUrl: string
  userEmail: string
  expiresIn: string
}

export const PasswordResetEmail = ({
  resetUrl = '',
  userEmail = '',
  expiresIn = '1 hour',
}: PasswordResetProps) => {
  const previewText = 'Reset your MindScript password'

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

          <Heading style={h1}>Password Reset Request</Heading>

          <Text style={text}>
            We received a request to reset the password for your MindScript account
            associated with {userEmail}.
          </Text>

          <Text style={text}>
            Click the button below to create a new password. This link will expire
            in {expiresIn}.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={resetUrl}>
              Reset Password
            </Button>
          </Section>

          <Text style={securityText}>
            If you didn't request this password reset, you can safely ignore this
            email. Your password won't be changed until you create a new one.
          </Text>

          <Section style={alternativeSection}>
            <Text style={alternativeText}>
              Button not working? Copy and paste this link into your browser:
            </Text>
            <Link href={resetUrl} style={alternativeLink}>
              {resetUrl}
            </Link>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            For security reasons, this link will expire in {expiresIn}.
            If you need a new link, visit the{' '}
            <Link href="https://mindscript.app/forgot-password" style={link}>
              password reset page
            </Link>
            .
          </Text>

          <Text style={footer}>
            MindScript · Transform your mind through sound
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default PasswordResetEmail

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

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: '#dc2626',
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

const securityText = {
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  color: '#78350f',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '32px 0',
  padding: '16px',
}

const alternativeSection = {
  margin: '32px 0',
}

const alternativeText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  marginBottom: '8px',
}

const alternativeLink = {
  color: '#3b82f6',
  fontSize: '14px',
  lineHeight: '20px',
  textDecoration: 'underline',
  wordBreak: 'break-all' as const,
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