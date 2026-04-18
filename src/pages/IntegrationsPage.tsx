import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import {
  Globe, Search, Music2, BriefcaseBusiness, BarChart3,
  Mail, MessageSquare, FileText, Zap, Loader2, RefreshCw, Calendar as CalendarIcon
} from 'lucide-react';
import { useGoogleAdsConnect } from '@/hooks/useGoogleAdsConnect';
import { useGoogleAdsSync } from '@/hooks/useGoogleAdsSync';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface Integration {
  id: string;
  name: string;
  description: { he: string; en: string };
  icon: React.ElementType;
  color: string;
  category: 'ads' | 'crm' | 'analytics' | 'communication';
  hasRealConnect?: boolean;
}

const integrations: Integration[] = [
  { id: 'meta', name: 'Meta Ads', description: { he: 'חיבור לקמפיינים ב-Facebook ו-Instagram', en: 'Connect to Facebook & Instagram campaigns' }, icon: Globe, color: '#1877F2', category: 'ads' },
  { id: 'google', name: 'Google Ads', description: { he: 'ניהול קמפיינים ב-Google Search ו-Display', en: 'Manage Google Search & Display campaigns' }, icon: Search, color: '#4285F4', category: 'ads', hasRealConnect: true },
  { id: 'tiktok', name: 'TikTok Ads', description: { he: 'ניהול מודעות ב-TikTok', en: 'Manage TikTok ad campaigns' }, icon: Music2, color: '#000000', category: 'ads' },
  { id: 'linkedin', name: 'LinkedIn Ads', description: { he: 'קמפיינים ממוקדים ב-LinkedIn', en: 'Targeted LinkedIn ad campaigns' }, icon: BriefcaseBusiness, color: '#0A66C2', category: 'ads' },
  { id: 'hubspot', name: 'HubSpot CRM', description: { he: 'סנכרון לידים ואנשי קשר', en: 'Sync leads and contacts' }, icon: BarChart3, color: '#FF7A59', category: 'crm' },
  { id: 'mailchimp', name: 'Mailchimp', description: { he: 'אוטומציות אימייל ורשימות תפוצה', en: 'Email automations & mailing lists' }, icon: Mail, color: '#FFE01B', category: 'communication' },
  { id: 'slack', name: 'Slack', description: { he: 'התראות והתנהלות צוות', en: 'Team notifications & collaboration' }, icon: MessageSquare, color: '#4A154B', category: 'communication' },
  { id: 'analytics', name: 'Google Analytics', description: { he: 'מעקב תנועה והמרות באתר', en: 'Website traffic & conversion tracking' }, icon: BarChart3, color: '#E37400', category: 'analytics' },
  { id: 'sheets', name: 'Google Sheets', description: { he: 'ייצוא דוחות אוטומטי', en: 'Automated report exports' }, icon: FileText, color: '#0F9D58', category: 'analytics' },
  { id: 'zapier', name: 'Zapier', description: { he: 'אוטומציות בין כלים שונים', en: 'Cross-tool automations' }, icon: Zap, color: '#FF4A00', category: 'analytics' },
];

const categoryLabels = {
  ads: { he: 'פרסום', en: 'Advertising' },
  crm: { he: 'CRM', en: 'CRM' },
  analytics: { he: 'אנליטיקס', en: 'Analytics' },
  communication: { he: 'תקשורת', en: 'Communication' },
};

const microsToCurrency = (m: number) => (m / 1_000_000).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function IntegrationsPage() {
  const { lang } = useApp();
  const isRtl = lang === 'he';
  const googleAds = useGoogleAdsConnect();
  const gadsSync = useGoogleAdsSync();

  // Default: last 30 days
  const today = new Date();
  const thirtyAgo = new Date(today.getTime() - 30 * 86400000);
  const [dateFrom, setDateFrom] = useState<Date>(thirtyAgo);
  const [dateTo, setDateTo] = useState<Date>(today);

  const categories = ['ads', 'crm', 'analytics', 'communication'] as const;

  const getConnectedState = (item: Integration) => {
    if (item.id === 'google') return googleAds.connection?.is_connected ?? false;
    return false;
  };

  const connectedCount = integrations.filter(i => getConnectedState(i)).length;

  const handleSync = () => {
    gadsSync.sync(format(dateFrom, 'yyyy-MM-dd'), format(dateTo, 'yyyy-MM-dd'));
  };

  return (
    <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isRtl ? 'אינטגרציות' : 'Integrations'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isRtl ? 'חבר את הכלים שלך לניהול מרכזי' : 'Connect your tools for centralized management'}
          </p>
        </div>
        <Badge variant="secondary" className="text-sm w-fit">
          {connectedCount}/{integrations.length} {isRtl ? 'מחוברים' : 'Connected'}
        </Badge>
      </div>

      {googleAds.isReturningFromOAuth && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">
            {isRtl ? 'מחבר את חשבון Google Ads שלך...' : 'Connecting your Google Ads account...'}
          </p>
        </div>
      )}

      {/* Google Ads sync panel */}
      {googleAds.connection?.is_connected && (
        <Card className="bg-card/50 backdrop-blur border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Search size={18} style={{ color: '#4285F4' }} />
                  {isRtl ? 'סנכרון Google Ads' : 'Google Ads Sync'}
                </CardTitle>
                <CardDescription className="mt-1">
                  {gadsSync.lastSync ? (
                    <>
                      {isRtl ? 'סנכרון אחרון:' : 'Last sync:'}{' '}
                      {format(new Date(gadsSync.lastSync.created_at), 'dd/MM/yyyy HH:mm')}
                      {' • '}
                      <span className={gadsSync.lastSync.status === 'success' ? 'text-primary' : 'text-destructive'}>
                        {gadsSync.lastSync.status === 'success'
                          ? `${gadsSync.lastSync.campaigns_synced} ${isRtl ? 'קמפיינים' : 'campaigns'}`
                          : (isRtl ? 'שגיאה' : 'Error')}
                      </span>
                    </>
                  ) : (
                    isRtl ? 'עדיין לא סונכרן' : 'Not synced yet'
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              {/* Date from */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{isRtl ? 'מתאריך' : 'From'}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('w-[160px] justify-start text-left font-normal gap-2')}>
                      <CalendarIcon size={14} />
                      {format(dateFrom, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(d) => d && setDateFrom(d)}
                      disabled={(d) => d > new Date() || d > dateTo}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date to */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{isRtl ? 'עד תאריך' : 'To'}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('w-[160px] justify-start text-left font-normal gap-2')}>
                      <CalendarIcon size={14} />
                      {format(dateTo, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(d) => d && setDateTo(d)}
                      disabled={(d) => d > new Date() || d < dateFrom}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Button onClick={handleSync} disabled={gadsSync.syncing} size="sm" className="gap-2">
                {gadsSync.syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {isRtl ? 'סנכרן עכשיו' : 'Sync now'}
              </Button>
            </div>

            {gadsSync.lastSync?.status === 'error' && gadsSync.lastSync.error_message && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                {gadsSync.lastSync.error_message}
              </div>
            )}

            {/* Synced campaigns table */}
            {gadsSync.campaigns.length > 0 ? (
              <div className="rounded-md border border-border/50 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRtl ? 'קמפיין' : 'Campaign'}</TableHead>
                      <TableHead>{isRtl ? 'סטטוס' : 'Status'}</TableHead>
                      <TableHead className="text-right">{isRtl ? 'חשיפות' : 'Impressions'}</TableHead>
                      <TableHead className="text-right">{isRtl ? 'קליקים' : 'Clicks'}</TableHead>
                      <TableHead className="text-right">{isRtl ? 'הוצאה' : 'Cost'}</TableHead>
                      <TableHead className="text-right">{isRtl ? 'המרות' : 'Conv.'}</TableHead>
                      <TableHead className="text-right">CTR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gadsSync.campaigns.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.campaign_name}</TableCell>
                        <TableCell>
                          <Badge variant={c.status === 'ENABLED' ? 'default' : 'outline'} className="text-xs">
                            {c.status ?? '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{c.impressions.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{c.clicks.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{microsToCurrency(c.cost_micros)}</TableCell>
                        <TableCell className="text-right">{c.conversions.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{(c.ctr * 100).toFixed(2)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : !gadsSync.loading && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {isRtl ? 'אין נתונים מסונכרנים. לחץ "סנכרן עכשיו" כדי להתחיל.' : 'No synced data. Click "Sync now" to start.'}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {categories.map(cat => {
        const items = integrations.filter(i => i.category === cat);
        return (
          <div key={cat} className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              {categoryLabels[cat][lang]}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map(item => {
                const isGoogleAds = item.id === 'google';
                const connected = getConnectedState(item);
                return (
                  <Card key={item.id} className="bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${item.color}20` }}
                        >
                          <item.icon size={20} style={{ color: item.color }} />
                        </div>
                        <div>
                          <CardTitle className="text-base">{item.name}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {item.description[lang]}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between">
                        <Badge variant={connected ? 'default' : 'outline'} className="text-xs">
                          {connected
                            ? (isGoogleAds && googleAds.connection?.account_name
                              ? googleAds.connection.account_name
                              : (isRtl ? 'מחובר' : 'Connected'))
                            : (isRtl ? 'לא מחובר' : 'Not connected')}
                        </Badge>
                        {isGoogleAds ? (
                          connected ? (
                            <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={googleAds.disconnect}>
                              {isRtl ? 'נתק' : 'Disconnect'}
                            </Button>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              className="text-xs gap-1"
                              onClick={googleAds.connect}
                              disabled={googleAds.connecting}
                            >
                              {googleAds.connecting && <Loader2 size={12} className="animate-spin" />}
                              {isRtl ? 'התחבר' : 'Connect'}
                            </Button>
                          )
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            {isRtl ? 'בקרוב' : 'Coming soon'}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
