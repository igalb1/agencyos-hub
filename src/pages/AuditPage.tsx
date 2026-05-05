import { Search } from "lucide-react";
import QAChecklistRunner from "@/components/qa/QAChecklistRunner";

export default function AuditPage() {
  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Search className="text-primary" />
          Audit חשבון פרסום
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          בדיקה תקופתית של חשבון פרסום קיים — Google Ads, Meta, TikTok
        </p>
      </div>
      <QAChecklistRunner mode="audit" storageKey="audit_v1" />
    </div>
  );
}