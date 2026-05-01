import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface Props {
  campaignName: string;
  clientName: string;
}

export default function QASuccessScreen({ campaignName, clientName }: Props) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-qa-final/30 bg-qa-final/5 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-qa-final/20">
        <CheckCircle2 className="h-9 w-9 text-qa-final" />
      </div>
      <h2 className="font-rubik text-2xl font-bold text-foreground">הבדיקה אושרה!</h2>
      <p className="text-sm text-muted-foreground">
        קמפיין <span className="font-semibold text-foreground">{campaignName}</span> של{' '}
        <span className="font-semibold text-foreground">{clientName}</span> מוכן לאוויר.
      </p>
      <div className="flex w-full gap-2">
        <Button variant="outline" className="flex-1" onClick={() => navigate('/qa')}>להיסטוריה</Button>
        <Button className="flex-1" onClick={() => navigate('/qa/new')}>בדיקה נוספת</Button>
      </div>
    </div>
  );
}