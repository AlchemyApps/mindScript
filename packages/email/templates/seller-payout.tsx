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

interface SellerPayoutProps {
  sellerName: string
  payoutAmount: string
  currency: string
  payoutDate: string
  salesCount: number
  payoutId: string
  dashboardUrl: string
}

export const SellerPayoutEmail = ({
  sellerName = 'Creator',
  payoutAmount = '$100.00',
  currency = 'USD',
  payoutDate = 'Today',
  salesCount = 10,
  payoutId = '',
  dashboardUrl = 'https://mindscript.app/seller/dashboard',
}: SellerPayoutProps) => {
  const previewText = `Your payout of ${payoutAmount} is on the way!`

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
            <Text style={successEmoji}>💰</Text>
          </Section>

          <Heading style={h1}>Payout Processed!</Heading>

          <Text style={text}>Hi {sellerName},</Text>

          <Text style={text}>
            Great news! Your earnings payout has been processed and is on its way to your bank account.
          </Text>

          <Section style={payoutCard}>
            <Text style={payoutAmountStyle}>{payoutAmount}</Text>
            <Text style={payoutCurrencyStyle}>{currency}</Text>

            <Hr style={divider} />

            <Row style={detailRow}>
              <Column style={detailLabel}>Payout ID:</Column>
              <Column style={detailValue}>{payoutId}</Column>
            </Row>

            <Row style={detailRow}>
              <Column style={detailLabel}>Processing Date:</Column>
              <Column style={detailValue}>{payoutDate}</Column>
            </Row>

            <Row style={detailRow}>
              <Column style={detailLabel}>Sales Included:</Column>
              <Column style={detailValue}>{salesCount} tracks</Column>
            </Row>

            <Row style={detailRow}>
              <Column style={detailLabel}>Expected Arrival:</Column>
              <Column style={detailValue}>2-5 business days</Column>
            </Row>
          </Section>

          <Section style={buttonContainer}>
            <Button style={button} href={dashboardUrl}>
              View Dashboard
            </Button>
          </Section>

          <Section style={statsSection}>
            <Text style={statsTitle}>Keep up the great work!</Text>
            <Text style={statsText}>
              Your tracks are helping people around the world find peace and transformation.
              Thank you for being part of the MindScript community!
            </Text>
          </Section>

          <Hr style={hr} />

          <Section style={tipsSection}>
            <Text style={tipsTitle}>Grow Your Earnings:</Text>
            <Text style={tip}>
              📈 Upload new tracks regularly to increase visibility
            </Text>
            <Text style={tip}>
              🎯 Target trending topics and seasonal themes
            </Text>
            <Text style={tip}>
              📱 Share your tracks on social media
            </Text>
            <Text style={tip}>
              ⭐ Encourage buyers to leave reviews
            </Text>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            Questions about your payout? Contact us at{' '}
            <Link href="mailto:sellers@mindscript.app" style={link}>
              sellers@mindscript.app
            </Link>
          </Text>

          <Text style={footer}>
            MindScript · Empowering creators worldwide
          </Text>

          <Text style={unsubscribe}>
            <Link href="https://mindscript.app/seller/preferences" style={link}>
              Manage seller notifications
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default SellerPayoutEmail

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

const payoutCard = {
  backgroundColor: '#10b981',
  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  borderRadius: '12px',
  padding: '24px',
  margin: '32px 0',
  color: '#ffffff',
}

const payoutAmountStyle = {
  fontSize: '36px',
  fontWeight: '700',
  lineHeight: '1',
  margin: '0',
  textAlign: 'center' as const,
}

const payoutCurrencyStyle = {
  fontSize: '16px',
  fontWeight: '500',
  margin: '8px 0 20px',
  textAlign: 'center' as const,
  opacity: 0.9,
}

const divider = {
  borderColor: 'rgba(255, 255, 255, 0.3)',
  margin: '20px 0',
}

const detailRow = {
  marginBottom: '12px',
}

const detailLabel = {
  fontSize: '14px',
  opacity: 0.9,
  width: '140px',
  display: 'inline-block',
}

const detailValue = {
  fontSize: '14px',
  fontWeight: '600',
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
  padding: '12px 32px',
  textAlign: 'center' as const,
  textDecoration: 'none',
}

const statsSection = {
  backgroundColor: '#f0f9ff',
  borderRadius: '8px',
  padding: '20px',
  margin: '32px 0',
}

const statsTitle = {
  color: '#0369a1',
  fontSize: '16px',
  fontWeight: '600',
  marginBottom: '8px',
}

const statsText = {
  color: '#0c4a6e',
  fontSize: '14px',
  lineHeight: '20px',
}

const tipsSection = {
  margin: '32px 0',
}

const tipsTitle = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '600',
  marginBottom: '12px',
}

const tip = {
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