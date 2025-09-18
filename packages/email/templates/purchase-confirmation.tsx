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
  Row,
  Column,
} from '@react-email/components'
import * as React from 'react'

interface PurchaseConfirmationProps {
  customerName: string
  trackTitle: string
  sellerName: string
  amount: string
  currency: string
  purchaseId: string
  downloadUrl: string
  receiptUrl: string
}

export const PurchaseConfirmationEmail = ({
  customerName = 'Customer',
  trackTitle = 'Meditation Track',
  sellerName = 'Creator',
  amount = '$3.00',
  currency = 'USD',
  purchaseId = '',
  downloadUrl = '',
  receiptUrl = '',
}: PurchaseConfirmationProps) => {
  const previewText = `Purchase confirmation for ${trackTitle}`

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

          <Heading style={h1}>Purchase Confirmed! ✅</Heading>

          <Text style={text}>Hi {customerName},</Text>

          <Text style={text}>
            Thank you for your purchase! Your track is now available for download and streaming.
          </Text>

          <Section style={orderBox}>
            <Text style={orderTitle}>Order Details</Text>

            <Hr style={divider} />

            <Row style={orderRow}>
              <Column style={orderLabel}>Track:</Column>
              <Column style={orderValue}>{trackTitle}</Column>
            </Row>

            <Row style={orderRow}>
              <Column style={orderLabel}>Creator:</Column>
              <Column style={orderValue}>{sellerName}</Column>
            </Row>

            <Row style={orderRow}>
              <Column style={orderLabel}>Amount:</Column>
              <Column style={orderValue}>{amount} {currency}</Column>
            </Row>

            <Row style={orderRow}>
              <Column style={orderLabel}>Order ID:</Column>
              <Column style={orderValue}>{purchaseId}</Column>
            </Row>
          </Section>

          <Section style={buttonContainer}>
            <Button style={primaryButton} href={downloadUrl}>
              Download Track
            </Button>
          </Section>

          <Section style={secondaryButtonContainer}>
            <Button style={secondaryButton} href={receiptUrl}>
              View Receipt
            </Button>
          </Section>

          <Section style={infoSection}>
            <Text style={infoTitle}>What's Next?</Text>
            <Text style={infoText}>
              • Your track is available in your library
            </Text>
            <Text style={infoText}>
              • Download for offline listening
            </Text>
            <Text style={infoText}>
              • Stream unlimited times
            </Text>
            <Text style={infoText}>
              • Share with friends and family
            </Text>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            Need help? Contact us at{' '}
            <Link href="mailto:support@mindscript.app" style={link}>
              support@mindscript.app
            </Link>
          </Text>

          <Text style={footer}>
            MindScript · Transform your mind through sound
          </Text>

          <Text style={unsubscribe}>
            <Link href="https://mindscript.app/unsubscribe" style={link}>
              Manage email preferences
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default PurchaseConfirmationEmail

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

const orderBox = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '24px',
  margin: '32px 0',
}

const orderTitle = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: '600',
  marginBottom: '16px',
}

const divider = {
  borderColor: '#e5e7eb',
  margin: '16px 0',
}

const orderRow = {
  marginBottom: '12px',
}

const orderLabel = {
  color: '#6b7280',
  fontSize: '14px',
  width: '120px',
  display: 'inline-block',
}

const orderValue = {
  color: '#1a1a1a',
  fontSize: '14px',
  fontWeight: '500',
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

const secondaryButtonContainer = {
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

const infoSection = {
  margin: '32px 0',
}

const infoTitle = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '600',
  marginBottom: '12px',
}

const infoText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '8px 0',
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