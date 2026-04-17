import PublicLayout from "@/components/public/PublicLayout";

export default function TermsPage() {
  return (
    <PublicLayout>
      <article className="max-w-3xl mx-auto px-6 py-16 prose prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-primary">
        <h1>Terms of Service</h1>
        <p><em>Last updated: April 17, 2026</em></p>

        <h2>1. Who we are</h2>
        <p>
          AgencyOS ("the Service", "we", "us", "our") is operated by <strong>Igal Bar</strong>, an individual
          seller (the "Seller"). By accessing or using the Service, you ("you", "user", "customer") enter into a
          binding agreement with the Seller.
        </p>

        <h2>2. Acceptance of terms</h2>
        <p>
          By creating an account or using the Service, you confirm that you have read, understood, and agree to
          be bound by these Terms of Service ("Terms"). If you do not agree, you must not use the Service.
        </p>

        <h2>3. Eligibility</h2>
        <p>
          You must be at least 18 years old and able to enter into a legally binding contract. If you use the
          Service on behalf of an organization, you represent that you have authority to bind that organization.
        </p>

        <h2>4. Description of the Service</h2>
        <p>
          AgencyOS is a SaaS platform that helps digital marketing agencies manage clients, campaigns, projects,
          tasks, and reporting, including integrations with third-party services such as Google Ads.
        </p>

        <h2>5. Accounts and security</h2>
        <ul>
          <li>You must provide accurate, current, and complete information when creating an account.</li>
          <li>You are responsible for maintaining the confidentiality of your credentials and for all activity under your account.</li>
          <li>Notify us immediately of any unauthorized use of your account.</li>
        </ul>

        <h2>6. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any unlawful, fraudulent, or harmful purpose.</li>
          <li>Infringe the intellectual property rights of others.</li>
          <li>Interfere with or disrupt the Service, including via malware, scraping, or probing.</li>
          <li>Attempt to gain unauthorized access to the Service or its underlying systems.</li>
          <li>Use the Service to violate the terms of any connected third-party platform (e.g. Google Ads policies).</li>
        </ul>

        <h2>7. Intellectual property</h2>
        <p>
          The Service, including all software, content, branding, and documentation, is owned by the Seller and
          protected by intellectual property laws. We grant you a limited, non-exclusive, non-transferable right
          to use the Service in accordance with your subscription plan.
        </p>

        <h2>8. Payments and Merchant of Record</h2>
        <p>
          Our order process is conducted by our online reseller <strong>Paddle.com Market Limited</strong>.
          Paddle is the Merchant of Record for all our orders. Paddle provides all customer service inquiries
          and handles returns, refunds, billing, taxes, currency conversion, and chargebacks.
        </p>
        <p>
          By purchasing a subscription, you also agree to Paddle's{" "}
          <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer">
            Checkout Buyer Terms
          </a>. Subscriptions renew automatically at the end of each billing period until cancelled. You can cancel
          at any time from your account billing page; access continues until the end of the paid period.
        </p>

        <h2>9. Refunds</h2>
        <p>
          Refunds are governed by our <a href="/refund">Refund Policy</a>. We offer a 30-day money-back
          guarantee on initial subscription purchases.
        </p>

        <h2>10. Third-party services and Google Ads</h2>
        <p>
          When you connect a third-party account (such as Google Ads), you authorize the Service to access that
          data via OAuth solely to provide the analytics and management features of AgencyOS, in accordance with
          our <a href="/privacy">Privacy Policy</a> and the relevant provider's terms.
        </p>

        <h2>11. Service availability</h2>
        <p>
          We aim to keep the Service available but do not guarantee uninterrupted or error-free operation. We
          may modify, suspend, or discontinue features at any time.
        </p>

        <h2>12. Suspension and termination</h2>
        <p>
          We may suspend or terminate your access to the Service if you: (a) materially breach these Terms;
          (b) fail to pay subscription fees; (c) pose a security or fraud risk; or (d) violate applicable laws or
          third-party terms. You may terminate your account at any time from your account settings.
        </p>

        <h2>13. Disclaimers</h2>
        <p>
          The Service is provided "as is" and "as available" without warranties of any kind, whether express or
          implied, including merchantability, fitness for a particular purpose, and non-infringement, to the
          fullest extent permitted by law.
        </p>

        <h2>14. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, the Seller's aggregate liability for any claim arising out of
          or related to the Service is limited to the fees you paid in the 12 months prior to the event giving
          rise to the claim. We are not liable for indirect, incidental, special, consequential, or punitive
          damages, including loss of profits, data, or goodwill.
        </p>

        <h2>15. Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless the Seller from any claims, damages, or expenses arising
          from your use of the Service, your content, or your violation of these Terms or any third-party rights.
        </p>

        <h2>16. Changes to these Terms</h2>
        <p>
          We may update these Terms from time to time. Material changes will be communicated via the Service or
          by email. Continued use of the Service after changes take effect constitutes acceptance of the
          updated Terms.
        </p>

        <h2>17. Governing law</h2>
        <p>
          These Terms are governed by the laws of Israel, without regard to conflict-of-laws principles. Any
          disputes will be resolved in the competent courts of Tel Aviv-Jaffa, unless otherwise required by
          mandatory consumer-protection law in your jurisdiction.
        </p>

        <h2>18. Contact</h2>
        <p>
          For questions about these Terms, contact: <a href="mailto:support@agencyos.solutions">support@agencyos.solutions</a>.
          For billing, refund, or invoice questions, please use Paddle's buyer portal at{" "}
          <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">paddle.net</a>.
        </p>
      </article>
    </PublicLayout>
  );
}
