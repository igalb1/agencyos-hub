import PublicLayout from "@/components/public/PublicLayout";

export default function RefundPage() {
  return (
    <PublicLayout>
      <article className="max-w-3xl mx-auto px-6 py-16 prose prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-primary">
        <h1>Refund Policy</h1>
        <p><em>Last updated: April 17, 2026</em></p>

        <h2>30-day money-back guarantee</h2>
        <p>
          We want you to be happy with AgencyOS. If you're not satisfied with your purchase, you can request a
          full refund within <strong>30 days</strong> of your initial subscription payment — no questions asked.
        </p>

        <h2>How to request a refund</h2>
        <p>
          AgencyOS is sold through our Merchant of Record, <strong>Paddle.com Market Limited</strong>. To
          request a refund, you have two options:
        </p>
        <ol>
          <li>
            Visit <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">paddle.net</a> and
            sign in with the email address you used at checkout. From there you can view your invoice and
            request a refund directly.
          </li>
          <li>
            Email us at <a href="mailto:support@agencyos.solutions">support@agencyos.solutions</a> with your
            order number or the email used for purchase, and we will assist you.
          </li>
        </ol>

        <h2>Processing time</h2>
        <p>
          Approved refunds are processed by Paddle and typically appear on your original payment method within
          3–10 business days, depending on your bank or card issuer.
        </p>

        <h2>Renewals</h2>
        <p>
          Subscription renewals are not automatically refundable after the 30-day initial guarantee period. You
          can cancel auto-renewal at any time from your{" "}
          <a href="/settings/billing">billing page</a> or via Paddle's buyer portal — your access will continue
          until the end of the current paid period.
        </p>

        <h2>Exceptions</h2>
        <p>
          We may decline refund requests in cases of suspected fraud, abuse of the refund policy (e.g.
          repeated refund requests), or violation of our <a href="/terms">Terms of Service</a>.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about refunds? Reach out at{" "}
          <a href="mailto:support@agencyos.solutions">support@agencyos.solutions</a>.
        </p>
      </article>
    </PublicLayout>
  );
}
