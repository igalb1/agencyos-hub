import PublicLayout from "@/components/public/PublicLayout";

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <article className="max-w-3xl mx-auto px-6 py-16 prose prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-primary">
        <h1>Privacy Policy</h1>
        <p><em>Last updated: April 17, 2026</em></p>

        <h2>1. Who we are</h2>
        <p>
          AgencyOS is operated by <strong>Igal Bar</strong>, an individual seller, acting as the data
          controller for personal data collected through the Service. You can contact us at{" "}
          <a href="mailto:support@agencyos.solutions">support@agencyos.solutions</a>.
        </p>

        <h2>2. Information we collect</h2>
        <h3>2.1 Information you provide</h3>
        <ul>
          <li>Account details: name, email address, password (hashed).</li>
          <li>Organization information: agency name, team members, clients you add.</li>
          <li>Support messages and feedback you send us.</li>
        </ul>

        <h3>2.2 Information from connected services</h3>
        <p>When you connect a third-party account (such as Google Ads) we may access:</p>
        <ul>
          <li>Campaign data (names, IDs, status, budgets).</li>
          <li>Performance metrics (impressions, clicks, cost, conversions).</li>
          <li>Account-level performance data.</li>
        </ul>
        <p>We only access the minimum data necessary to provide the features you use.</p>

        <h3>2.3 Automatically collected</h3>
        <ul>
          <li>Device and browser information, IP address, timezone.</li>
          <li>Usage and telemetry data (pages visited, features used, errors).</li>
          <li>Cookies and similar technologies (see Section 9).</li>
        </ul>

        <h2>3. How we use your data</h2>
        <ul>
          <li>To create and operate your account and provide the Service.</li>
          <li>To display dashboards and analytics from connected platforms.</li>
          <li>To improve the Service, fix bugs, and develop new features.</li>
          <li>To communicate with you about your account, security, and updates.</li>
          <li>To comply with legal obligations and prevent fraud or abuse.</li>
        </ul>

        <h2>4. Legal bases (GDPR / UK GDPR)</h2>
        <ul>
          <li><strong>Contract</strong> — to provide the Service you signed up for.</li>
          <li><strong>Legitimate interests</strong> — to secure the Service, prevent fraud, and improve our product.</li>
          <li><strong>Consent</strong> — for optional cookies and marketing communications, where required.</li>
          <li><strong>Legal obligation</strong> — to retain billing records and respond to lawful requests.</li>
        </ul>

        <h2>5. Google user data</h2>
        <p>
          Our use and transfer of information received from Google APIs adheres to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
            Google API Services User Data Policy
          </a>, including the Limited Use requirements. Specifically:
        </p>
        <ul>
          <li>We do not sell Google user data.</li>
          <li>We do not use Google data for advertising purposes outside the platform.</li>
          <li>We do not allow humans to read Google data, except with your consent or for security/legal purposes.</li>
        </ul>

        <h2>6. Data sharing</h2>
        <p>We share personal data only with:</p>
        <ul>
          <li>
            <strong>Paddle.com Market Limited</strong> — our Merchant of Record. Paddle processes payments,
            manages subscriptions, handles invoicing and tax compliance, and provides buyer support. See{" "}
            <a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer">Paddle's Privacy Notice</a>.
          </li>
          <li><strong>Cloud infrastructure providers</strong> — for hosting, database, and storage (e.g. Supabase, Lovable Cloud).</li>
          <li><strong>Email and analytics providers</strong> — to deliver transactional email and improve the product.</li>
          <li><strong>Authorities</strong> — when required by law, court order, or to protect rights and safety.</li>
        </ul>
        <p>We do not sell your personal data.</p>

        <h2>7. International transfers</h2>
        <p>
          Your data may be processed in countries outside your own. Where required, we rely on appropriate
          safeguards such as Standard Contractual Clauses or adequacy decisions to protect your data.
        </p>

        <h2>8. Data retention</h2>
        <p>
          We retain your personal data for as long as your account is active and as needed to provide the
          Service. After account closure, we delete or anonymize personal data within a reasonable period,
          except where we are required to retain it for legal, tax, accounting, or fraud-prevention purposes
          (typically up to 7 years for billing records).
        </p>

        <h2>9. Cookies</h2>
        <p>
          We use essential cookies to keep you signed in and secure the Service. We may also use limited
          analytics cookies to understand product usage. You can manage cookie preferences through your
          browser settings.
        </p>

        <h2>10. Your rights</h2>
        <p>Subject to applicable law (including GDPR and UK GDPR), you have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion of your data ("right to be forgotten").</li>
          <li>Request restriction of processing or object to processing.</li>
          <li>Receive a portable copy of your data.</li>
          <li>Withdraw consent where processing is based on consent.</li>
          <li>Lodge a complaint with your local data-protection authority.</li>
        </ul>
        <p>
          To exercise any of these rights, email{" "}
          <a href="mailto:support@agencyos.solutions">support@agencyos.solutions</a>. We will respond within
          30 days.
        </p>

        <h2>11. Security</h2>
        <p>
          We implement appropriate technical and organizational measures to protect your data, including
          encryption in transit, access controls, and regular security reviews. No system is 100% secure, but
          we work hard to protect your information.
        </p>

        <h2>12. Children</h2>
        <p>
          The Service is not intended for users under 18. We do not knowingly collect personal data from
          minors.
        </p>

        <h2>13. Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Material changes will be communicated via the
          Service or by email.
        </p>

        <h2>14. Contact</h2>
        <p>
          Questions about your data or this Privacy Policy? Contact{" "}
          <a href="mailto:support@agencyos.solutions">support@agencyos.solutions</a>.
        </p>
      </article>
    </PublicLayout>
  );
}
