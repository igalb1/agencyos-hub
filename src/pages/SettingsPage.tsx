import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { User, Palette, Languages, Shield, Save, CreditCard, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import TeamSettingsCard from '@/components/settings/TeamSettingsCard';

export default function SettingsPage() {
  const { lang, setLang, theme, setTheme } = useApp();
  const { user, profile, organization } = useAuth();
  const isRtl = lang === 'he';

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [saving, setSaving] = useState(false);

  const initials = (fullName || user?.email || '?').slice(0, 2).toUpperCase();

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (error) {
      toast({ title: isRtl ? 'שגיאה בשמירה' : 'Save failed', variant: 'destructive' });
    } else {
      toast({ title: isRtl ? 'הפרופיל עודכן בהצלחה' : 'Profile updated successfully' });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-3xl" dir={isRtl ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isRtl ? 'הגדרות' : 'Settings'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isRtl ? 'נהל את הפרופיל וההעדפות שלך' : 'Manage your profile and preferences'}
        </p>
      </div>

      {/* Profile */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <User size={20} className="text-primary" />
            <div>
              <CardTitle className="text-lg">{isRtl ? 'פרופיל' : 'Profile'}</CardTitle>
              <CardDescription>{isRtl ? 'פרטים אישיים' : 'Personal details'}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              {organization && (
                <p className="text-xs text-muted-foreground">{organization.name}</p>
              )}
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>{isRtl ? 'שם מלא' : 'Full Name'}</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={isRtl ? 'הזן שם מלא' : 'Enter full name'}
            />
          </div>
          <div className="space-y-2">
            <Label>{isRtl ? 'אימייל' : 'Email'}</Label>
            <Input value={user?.email ?? ''} disabled className="opacity-60" />
          </div>
          <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
            <Save size={16} />
            {saving ? (isRtl ? 'שומר...' : 'Saving...') : (isRtl ? 'שמור שינויים' : 'Save Changes')}
          </Button>
        </CardContent>
      </Card>

      {/* Team */}
      <TeamSettingsCard />

      {/* Appearance */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Palette size={20} className="text-primary" />
            <div>
              <CardTitle className="text-lg">{isRtl ? 'מראה' : 'Appearance'}</CardTitle>
              <CardDescription>{isRtl ? 'התאם את המראה של האפליקציה' : 'Customize the app appearance'}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{isRtl ? 'מצב כהה' : 'Dark Mode'}</p>
              <p className="text-xs text-muted-foreground">{isRtl ? 'עבור בין ערכת נושא כהה ובהירה' : 'Toggle between dark and light theme'}</p>
            </div>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Languages size={20} className="text-primary" />
            <div>
              <CardTitle className="text-lg">{isRtl ? 'שפה' : 'Language'}</CardTitle>
              <CardDescription>{isRtl ? 'בחר את שפת הממשק' : 'Choose interface language'}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>{isRtl ? 'שפת ממשק' : 'Interface Language'}</Label>
            <Select value={lang} onValueChange={(v) => setLang(v as 'he' | 'en')}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="he">עברית</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield size={20} className="text-primary" />
            <div>
              <CardTitle className="text-lg">{isRtl ? 'חשבון' : 'Account'}</CardTitle>
              <CardDescription>{isRtl ? 'מידע על החשבון והארגון' : 'Account and organization info'}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {organization && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{isRtl ? 'ארגון' : 'Organization'}</span>
                <span className="font-medium">{organization.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{isRtl ? 'תוכנית' : 'Plan'}</span>
                <span className="font-medium capitalize">{organization.plan}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{isRtl ? 'סיום תקופת ניסיון' : 'Trial Ends'}</span>
                <span className="font-medium">{new Date(organization.trial_ends_at).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US')}</span>
              </div>
              <Separator className="my-2" />
              <Button asChild variant="outline" className="w-full gap-2">
                <Link to="/settings/billing">
                  <CreditCard size={16} />
                  {isRtl ? 'חיוב, מנוי וחשבוניות' : 'Billing, subscription & invoices'}
                  <ChevronLeft size={16} className={isRtl ? '' : 'rotate-180'} />
                </Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
