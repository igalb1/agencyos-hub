import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'AgencyOS'
const APP_URL = 'https://login.agencyos.solutions'

interface TrialEndingProps {
  name?: string
  daysLeft?: number
  orgName?: string
}

const TrialEndingReminderEmail = ({ name, daysLeft = 3, orgName }: TrialEndingProps) => {
  const greeting = name ? `שלום ${name},` : 'שלום,'
  const orgLine = orgName ? ` של ${orgName}` : ''
  return (
    <Html lang="he" dir="rtl">
      <Head />
      <Preview>{`נותרו ${daysLeft} ימים בתקופת הניסיון שלך ב-${SITE_NAME}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>תקופת הניסיון{orgLine} מסתיימת בקרוב</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            נותרו <strong>{daysLeft} ימים</strong> בתקופת הניסיון החינמית שלך ב-{SITE_NAME}.
            כדי להמשיך ליהנות מכל התכונות ללא הפרעה, שדרג עכשיו לתוכנית בתשלום.
          </Text>
          <Section style={ctaSection}>
            <Button href={`${APP_URL}/settings/billing`} style={button}>
              שדרג עכשיו
            </Button>
          </Section>
          <Text style={text}>
            אם יש לך שאלות, פשוט השב למייל הזה — נשמח לעזור.
          </Text>
          <Text style={footer}>בברכה, צוות {SITE_NAME}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: TrialEndingReminderEmail,
  subject: (data: Record<string, any>) =>
    `נותרו ${data.daysLeft ?? 3} ימים בתקופת הניסיון שלך ב-${SITE_NAME}`,
  displayName: 'Trial ending reminder',
  previewData: { name: 'דנה', daysLeft: 3, orgName: 'Acme Agency' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold', color: '#0F172A', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const ctaSection = { textAlign: 'center' as const, margin: '28px 0' }
const button = {
  backgroundColor: '#00D4FF',
  color: '#0F172A',
  padding: '12px 28px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: 'bold',
  fontSize: '15px',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0' }