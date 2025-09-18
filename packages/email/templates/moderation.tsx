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

interface ModerationActionProps {
  contentTitle: string
  action: 'approved' | 'rejected' | 'flagged'
  reason?: string
  appealUrl?: string
  moderatorNotes?: string
}

export const ModerationEmail = ({
  contentTitle = 'Your Content',
  action = 'approved',
  reason = '',
  appealUrl = '',
  moderatorNotes = '',
}: ModerationActionProps) => {
  const previewText = `Content moderation update: ${contentTitle}`

  const actionConfig = {
    approved: {
      emoji: '✅',
      title: 'Content Approved!',
      color: '#10b981',
      buttonText: 'View Your Content',
      buttonColor: '#10b981',
    },
    rejected: {
      emoji: '❌',
      title: 'Content Requires Changes',
      color: '#dc2626',
      buttonText: 'Submit Appeal',
      buttonColor: '#dc2626',
    },
    flagged: {
      emoji: '⚠️',
      title: 'Content Under Review',
      color: '#f59e0b',
      buttonText: 'View Details',
      buttonColor: '#f59e0b',
    },
  }

  const config = actionConfig[action]

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

          <Section style={iconSection}>
            <Text style={emoji}>{config.emoji}</Text>
          </Section>

          <Heading style={h1}>{config.title}</Heading>

          <Section style={{ ...statusCard, borderColor: config.color }}>
            <Text style={contentName}>{contentTitle}</Text>
            <Text style={statusText}>
              Status: <span style={{ color: config.color, fontWeight: '600' }}>
                {action.charAt(0).toUpperCase() + action.slice(1)}
              </span>
            </Text>
          </Section>

          {action === 'approved' && (
            <>
              <Text style={text}>
                Great news! Your content has been reviewed and approved for the MindScript marketplace.
                It's now live and available for users to discover and purchase.
              </Text>

              <Text style={text}>
                Your content meets all our quality standards and community guidelines.
                Thank you for contributing to the MindScript community!
              </Text>
            </>
          )}

          {action === 'rejected' && (
            <>
              <Text style={text}>
                After careful review, we've determined that your content needs some adjustments
                before it can be published on the MindScript marketplace.
              </Text>

              {reason && (
                <Section style={reasonSection}>
                  <Text style={reasonTitle}>Reason for rejection:</Text>
                  <Text style={reasonText}>{reason}</Text>
                </Section>
              )}

              {moderatorNotes && (
                <Section style={notesSection}>
                  <Text style={notesTitle}>Reviewer notes:</Text>
                  <Text style={notesText}>{moderatorNotes}</Text>
                </Section>
              )}

              <Text style={text}>
                Please address these issues and resubmit your content for review.
                If you believe this decision was made in error, you can submit an appeal.
              </Text>
            </>
          )}

          {action === 'flagged' && (
            <>
              <Text style={text}>
                Your content has been flagged for additional review. This typically happens when
                our automated systems detect content that may need human verification.
              </Text>

              {reason && (
                <Section style={reasonSection}>
                  <Text style={reasonTitle}>Flagged for:</Text>
                  <Text style={reasonText}>{reason}</Text>
                </Section>
              )}

              <Text style={text}>
                Our moderation team will review your content within 24-48 hours.
                You'll receive another notification once the review is complete.
              </Text>
            </>
          )}

          {appealUrl && (
            <Section style={buttonContainer}>
              <Button
                style={{ ...button, backgroundColor: config.buttonColor }}
                href={appealUrl}
              >
                {config.buttonText}
              </Button>
            </Section>
          )}

          <Hr style={hr} />

          <Section style={guidelinesSection}>
            <Text style={guidelinesTitle}>Content Guidelines Reminder:</Text>
            <Text style={guideline}>• Original content only (no copyrighted material)</Text>
            <Text style={guideline}>• Appropriate for all audiences</Text>
            <Text style={guideline}>• High audio quality (no distortion or noise)</Text>
            <Text style={guideline}>• Accurate descriptions and metadata</Text>
            <Text style={guideline}>• Respectful and inclusive content</Text>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            Questions about this decision? Contact our moderation team at{' '}
            <Link href="mailto:moderation@mindscript.app" style={link}>
              moderation@mindscript.app
            </Link>
          </Text>

          <Text style={footer}>
            MindScript · Maintaining quality and safety for our community
          </Text>

          <Text style={unsubscribe}>
            <Link href="https://mindscript.app/preferences" style={link}>
              Manage notification preferences
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default ModerationEmail

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

const iconSection = {
  textAlign: 'center' as const,
  margin: '24px 0',
}

const emoji = {
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

const statusCard = {
  backgroundColor: '#f9fafb',
  border: '2px solid',
  borderRadius: '8px',
  padding: '20px',
  margin: '32px 0',
}

const contentName = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: '600',
  marginBottom: '8px',
}

const statusText = {
  color: '#6b7280',
  fontSize: '14px',
}

const text = {
  color: '#525252',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
}

const reasonSection = {
  backgroundColor: '#fef2f2',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 0',
}

const reasonTitle = {
  color: '#991b1b',
  fontSize: '14px',
  fontWeight: '600',
  marginBottom: '8px',
}

const reasonText = {
  color: '#7f1d1d',
  fontSize: '14px',
  lineHeight: '20px',
}

const notesSection = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 0',
}

const notesTitle = {
  color: '#374151',
  fontSize: '14px',
  fontWeight: '600',
  marginBottom: '8px',
}

const notesText = {
  color: '#4b5563',
  fontSize: '14px',
  lineHeight: '20px',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
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

const guidelinesSection = {
  backgroundColor: '#f0f9ff',
  borderRadius: '8px',
  padding: '20px',
  margin: '32px 0',
}

const guidelinesTitle = {
  color: '#0369a1',
  fontSize: '14px',
  fontWeight: '600',
  marginBottom: '12px',
}

const guideline = {
  color: '#0c4a6e',
  fontSize: '13px',
  lineHeight: '18px',
  margin: '6px 0',
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