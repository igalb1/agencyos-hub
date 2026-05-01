import { Button } from '@/components/ui/button';
import { AlertTriangle, Rocket, XCircle } from 'lucide-react';

interface Props {
  criticalDone: number;
  criticalTotal: number;
  onApprove: () => void;
  onReject?: () => void;
  approving?: boolean;
  rejecting?: boolean;
}

export default function QASubmitButton({ criticalDone, criticalTotal, onApprove, onReject, approving, rejecting }: Props) {
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
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          size="lg"
          disabled={!ready || approving || rejecting}
          onClick={onApprove}
          className="flex-1 gap-2 bg-qa-final text-white hover:bg-qa-final/90"
        >
          <Rocket className="h-4 w-4" />
          {approving ? 'מאשר...' : '🚀 אשר והעלה לאוויר'}
        </Button>
        {onReject && (
          <Button
            size="lg"
            variant="outline"
            disabled={approving || rejecting}
            onClick={onReject}
            className="gap-2 border-qa-critical/40 text-qa-critical hover:bg-qa-critical/10"
          >
            <XCircle className="h-4 w-4" />
            {rejecting ? 'מסמן...' : 'סמן ככשל'}
          </Button>
        )}
      </div>
    </div>
  );
}