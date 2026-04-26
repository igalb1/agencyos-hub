import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldOff, LogOut } from 'lucide-react';

export default function AccessDenied({ message }: { message?: string }) {
  const { signOut } = useAuth();
  return (
    <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-destructive/40 bg-card/50 backdrop-blur">
        <CardContent className="p-8 text-center space-y-6">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-destructive/15 items-center justify-center mx-auto">
            <ShieldOff className="w-8 h-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">הגישה נדחתה</h1>
            <p className="text-muted-foreground">
              {message ?? 'הגישה שלך לסביבת העבודה הוסרה. אם זו טעות, פנה למנהל הסוכנות.'}
            </p>
          </div>
          <Button onClick={signOut} variant="outline" className="gap-2">
            <LogOut className="w-4 h-4" /> חזרה למסך התחברות
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
