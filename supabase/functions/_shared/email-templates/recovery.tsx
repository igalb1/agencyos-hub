/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="he" dir="rtl">
    <Head />
    <Preview>איפוס סיסמה ל-{siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>איפוס סיסמה</Heading>
        <Text style={text}>
          קיבלנו בקשה לאיפוס הסיסמה שלך ב-{siteName}. לחץ על הכפתור למטה כדי לבחור סיסמה חדשה.
        </Text>
        <Text style={text}>
          <strong>שים לב:</strong> הקישור תקף ל-60 דקות וניתן לשימוש חד-פעמי בלבד. אם הקישור לא עובד, בקש קישור חדש.
        </Text>
        <Button style={button} href={confirmationUrl}>
          איפוס סיסמה
        </Button>
        <Text style={linkText}>
          או העתק והדבק את הקישור הבא בדפדפן:
          <br />
          <span style={urlStyle}>{confirmationUrl}</span>
        </Text>
        <Text style={footer}>
          אם לא ביקשת איפוס סיסמה, אפשר להתעלם מהמייל הזה. הסיסמה שלך לא תשתנה.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: '"DM Sans", Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#0a0a0a',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const linkText = {
  fontSize: '12px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '20px 0 0',
  wordBreak: 'break-all' as const,
}
const urlStyle = {
  color: '#3B82F6',
  fontSize: '11px',
}
const button = {
  backgroundColor: '#000000',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
