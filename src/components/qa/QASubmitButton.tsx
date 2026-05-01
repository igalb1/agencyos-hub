import { Button } from '@/components/ui/button';
import { AlertTriangle, Rocket } from 'lucide-react';

interface Props {
  criticalDone: number;
  criticalTotal: number;
  onApprove: () => void;
  approving?: boolean;
}

export default function QASubmitButton({ criticalDone, criticalTotal, onApprove, approving }: Props) {
  const ready = criticalTotal === 0 || criticalDone === criticalTotal;
  const missing = criticalTotal - criticalDone;

  return (
    <div className="space-y-3 rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
      {!ready && (
        <div className="flex items-start gap-2 rounded-lg bg-qa-critical/10 p-3 text-sm text-qa-critical">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>חסרים {missing} פריטים קריטיים להשלמה לפני שניתן לאשר העלאה לאוויר.</span>
        </div>
      )}
      <Button
        size="lg"
        disabled={!ready || approving}
        onClick={onApprove}
        className="w-full gap-2 bg-qa-final text-white hover:bg-qa-final/90"
      >
        <Rocket className="h-4 w-4" />
        {approving ? 'מאשר...' : '🚀 אשר והעלה לאוויר'}
      </Button>
    </div>
  );
}