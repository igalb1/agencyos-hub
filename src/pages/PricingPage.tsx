import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import PublicLayout from "@/components/public/PublicLayout";
import { PLANS } from "@/lib/plans";

export default function PricingPage() {
  return (
    <PublicLayout>
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Simple pricing for every agency</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start with a free trial. Upgrade when you're ready. Cancel any time.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className={`relative bg-card border rounded-2xl p-6 flex flex-col ${
                p.popular ? "border-primary ring-2 ring-primary/20" : "border-border"
              }`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                  Most popular
                </span>
              )}
              <div className="mb-6">
                <h3 className="text-xl font-bold">{p.name}</h3>
                <p className="text-sm text-muted-foreground">{p.description}</p>
                <div className="mt-3">
                  <span className="text-4xl font-bold">{p.price}</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check size={16} className="text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/auth"
                className={`w-full text-center py-2.5 rounded-lg font-medium transition-opacity ${
                  p.popular
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "border border-border hover:bg-muted"
                }`}
              >
                Start free trial
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-10">
          All plans billed in USD. Payments are securely processed by Paddle, our Merchant of Record.
          See our <Link to="/refund" className="text-primary hover:underline">Refund Policy</Link>.
        </p>
      </section>
    </PublicLayout>
  );
}
