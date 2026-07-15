import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import {
  Globe, Music2, BriefcaseBusiness, BarChart3,
  Mail, MessageSquare, FileText, Zap, Loader2, RefreshCw, Calendar as CalendarIcon, Search,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { useLinkedInAdsConnect } from '@/hooks/useLinkedInAdsConnect';
import { useLinkedInAdsSync } from '@/hooks/useLinkedInAdsSync';
import { useFacebookAdsConnect } from '@/hooks/useFacebookAdsConnect';
import { useFacebookAdsSync } from '@/hooks/useFacebookAdsSync';
import { useGoogleAdsConnect } from '@/hooks/useGoogleAdsConnect';
import { useGoogleAdsSync } from '@/hooks/useGoogleAdsSync';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { GoogleSheetsCard } from '@/components/integrations/GoogleSheetsCard';
import { useClientSheetSync } from '@/hooks/useClientSheetSync';
import { useOrgData } from '@/hooks/useOrgData';
import React from 'react';

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
  { id: 'facebook', name: 'Facebook Ads', description: { he: 'חיבור לקמפיינים ב-Facebook ו-Instagram', en: 'Connect to Facebook & Instagram campaigns' }, icon: Globe, color: '#1877F2', category: 'ads', hasRealConnect: true },
  { id: 'google_ads', name: 'Google Ads', description: { he: 'סנכרון קמפיינים מחשבון Google Ads', en: 'Sync campaigns from Google Ads' }, icon: Search, color: '#4285F4', category: 'ads', hasRealConnect: true },
  { id: 'tiktok', name: 'TikTok Ads', description: { he: 'ניהול מודעות ב-TikTok', en: 'Manage TikTok ad campaigns' }, icon: Music2, color: '#000000', category: 'ads' },
  { id: 'linkedin', name: 'LinkedIn Ads', description: { he: 'קמפיינים ממוקדים ב-LinkedIn', en: 'Targeted LinkedIn ad campaigns' }, icon: BriefcaseBusiness, color: '#0A66C2', category: 'ads', hasRealConnect: true },
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

export default function IntegrationsPage() {
  const { lang } = useApp();
  const isRtl = lang === 'he';
  const { user } = useAuth();
  const storageScope = user?.id ?? 'anon';
  const collapseKey = (platform: 'li' | 'fb' | 'ga') =>
    `integrations.collapsedAccounts.${platform}.${storageScope}`;

  const readCollapsed = (platform: 'li' | 'fb' | 'ga'): Set<string> => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem(collapseKey(platform));
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? new Set(arr as string[]) : new Set();
    } catch { return new Set(); }
  };
  const persistCollapsed = (platform: 'li' | 'fb' | 'ga', set: Set<string>) => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(collapseKey(platform), JSON.stringify(Array.from(set))); } catch {}
  };

  const linkedInAds = useLinkedInAdsConnect();
  const liSync = useLinkedInAdsSync();
  const facebookAds = useFacebookAdsConnect();
  const fbSync = useFacebookAdsSync();
  const googleAds = useGoogleAdsConnect();
  const gaSync = useGoogleAdsSync();
  const sheetSync = useClientSheetSync();
  const { clients } = useOrgData();

  // Match Google/Facebook account_name → the client we mirrored it into.
  const clientNameByAccount = React.useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach(c => m.set(c.name.trim().toLowerCase(), c.name));
    return m;
  }, [clients]);

  const groupByAccount = <T extends { campaign_name: string }>(
    rows: T[],
    accountKey: (r: T) => string,
  ): Array<{ account: string; clientName: string | null; rows: T[] }> => {
    const groups = new Map<string, T[]>();
    rows.forEach(r => {
      const k = accountKey(r) || (isRtl ? 'ללא חשבון' : 'Unknown account');
      const list = groups.get(k) ?? [];
      list.push(r);
      groups.set(k, list);
    });
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([account, list]) => ({
        account,
        clientName: clientNameByAccount.get(account.trim().toLowerCase()) ?? null,
        rows: list.slice().sort((x, y) => x.campaign_name.localeCompare(y.campaign_name)),
      }));
  };

  // Default: last 30 days
  const today = new Date();
  const thirtyAgo = new Date(today.getTime() - 30 * 86400000);
  const [liDateFrom, setLiDateFrom] = useState<Date>(thirtyAgo);
  const [liDateTo, setLiDateTo] = useState<Date>(today);
  const [liCollapsed, setLiCollapsed] = useState<boolean>(false);
  const [liCollapsedAccounts, setLiCollapsedAccounts] = useState<Set<string>>(() => readCollapsed('li'));
  const [liSearch, setLiSearch] = useState('');
  const [fbDateFrom, setFbDateFrom] = useState<Date>(thirtyAgo);
  const [fbDateTo, setFbDateTo] = useState<Date>(today);
  const [fbCollapsed, setFbCollapsed] = useState<boolean>(false);
  const [fbCollapsedAccounts, setFbCollapsedAccounts] = useState<Set<string>>(() => readCollapsed('fb'));
  const [fbSearch, setFbSearch] = useState('');
  const [gaDateFrom, setGaDateFrom] = useState<Date>(thirtyAgo);
  const [gaDateTo, setGaDateTo] = useState<Date>(today);
  const [gaCollapsed, setGaCollapsed] = useState<boolean>(false);
  const [gaCollapsedAccounts, setGaCollapsedAccounts] = useState<Set<string>>(() => readCollapsed('ga'));
  const [gaSearch, setGaSearch] = useState('');

  // Reload persisted collapse state when the signed-in user changes.
  useEffect(() => {
    setLiCollapsedAccounts(readCollapsed('li'));
    setFbCollapsedAccounts(readCollapsed('fb'));
    setGaCollapsedAccounts(readCollapsed('ga'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageScope]);

  useEffect(() => { persistCollapsed('li', liCollapsedAccounts); }, [liCollapsedAccounts, storageScope]);
  useEffect(() => { persistCollapsed('fb', fbCollapsedAccounts); }, [fbCollapsedAccounts, storageScope]);
  useEffect(() => { persistCollapsed('ga', gaCollapsedAccounts); }, [gaCollapsedAccounts, storageScope]);

  const filterBySearch = <T extends { campaign_name: string }>(rows: T[], q: string): T[] => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(r => (r.campaign_name ?? '').toLowerCase().includes(term));
  };

  const liGroups = groupByAccount(filterBySearch(liSync.campaigns, liSearch), c => c.linkedin_account_id ?? '');
  const fbGroups = groupByAccount(filterBySearch(fbSync.campaigns, fbSearch), c => c.account_name ?? c.facebook_account_id ?? '');
  const gaGroups = groupByAccount(filterBySearch(gaSync.campaigns, gaSearch), c => c.account_name ?? c.google_customer_id ?? '');


  const toggleAccountCollapse = (set: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    set(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const categories = ['ads', 'crm', 'analytics', 'communication'] as const;

  const getConnectedState = (item: Integration) => {
    if (item.id === 'linkedin') return linkedInAds.connection?.is_connected ?? false;
    if (item.id === 'facebook') return facebookAds.connection?.is_connected ?? false;
    if (item.id === 'google_ads') return googleAds.connection?.is_connected ?? false;
    if (item.id === 'sheets') return sheetSync.configs.length > 0;
    return false;
  };

  const connectedCount = integrations.filter(i => getConnectedState(i)).length;

  const handleLiSync = () => {
    liSync.sync(format(liDateFrom, 'yyyy-MM-dd'), format(liDateTo, 'yyyy-MM-dd'));
  };

  const handleFbSync = () => {
    fbSync.sync(format(fbDateFrom, 'yyyy-MM-dd'), format(fbDateTo, 'yyyy-MM-dd'));
  };

  const handleGaSync = () => {
    gaSync.sync(format(gaDateFrom, 'yyyy-MM-dd'), format(gaDateTo, 'yyyy-MM-dd'));
  };

  const formatCurrency = (amount: number, currency: string | null) =>
    amount.toLocaleString(undefined, { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 });

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

      {facebookAds.isReturningFromOAuth && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">
            {isRtl ? 'מחבר את חשבון Facebook Ads שלך...' : 'Connecting your Facebook Ads account...'}
          </p>
        </div>
      )}

      {googleAds.isReturningFromOAuth && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">
            {isRtl ? 'מחבר את חשבון Google Ads שלך...' : 'Connecting your Google Ads account...'}
          </p>
        </div>
      )}


      {/* LinkedIn Ads sync panel */}
      {linkedInAds.connection?.is_connected && (
        <Card className="bg-card/50 backdrop-blur border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <BriefcaseBusiness size={18} style={{ color: '#0A66C2' }} />
                  {isRtl ? 'סנכרון LinkedIn Ads' : 'LinkedIn Ads Sync'}
                  {liCollapsed && liSync.campaigns.length > 0 && (
                    <Badge variant="outline" className="text-xs ml-1">
                      {liSync.campaigns.length} {isRtl ? 'קמפיינים' : 'campaigns'}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-1">
                  {liSync.lastSync ? (
                    <>
                      {isRtl ? 'סנכרון אחרון:' : 'Last sync:'}{' '}
                      {format(new Date(liSync.lastSync.created_at), 'dd/MM/yyyy HH:mm')}
                      {' • '}
                      <span className={liSync.lastSync.status === 'success' ? 'text-primary' : 'text-destructive'}>
                        {liSync.lastSync.status === 'success'
                          ? `${liSync.lastSync.campaigns_synced} ${isRtl ? 'קמפיינים' : 'campaigns'}`
                          : (isRtl ? 'שגיאה' : 'Error')}
                      </span>
                      {' • '}
                      <span className="text-muted-foreground text-xs">
                        {isRtl ? 'סנכרון אוטומטי יומי 03:00 UTC' : 'Auto-sync daily 03:00 UTC'}
                      </span>
                    </>
                  ) : (
                    isRtl ? 'עדיין לא סונכרן • סנכרון אוטומטי יומי 03:00 UTC' : 'Not synced yet • Auto-sync daily 03:00 UTC'
                  )}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLiCollapsed(v => !v)}
                className="gap-1"
                aria-label={liCollapsed ? (isRtl ? 'הרחב' : 'Expand') : (isRtl ? 'מזער' : 'Minimize')}
              >
                {liCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                <span className="text-xs">{liCollapsed ? (isRtl ? 'הרחב' : 'Expand') : (isRtl ? 'מזער' : 'Minimize')}</span>
              </Button>
            </div>
          </CardHeader>
          {!liCollapsed && (
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{isRtl ? 'מתאריך' : 'From'}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('w-[160px] justify-start text-left font-normal gap-2')}>
                      <CalendarIcon size={14} />
                      {format(liDateFrom, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={liDateFrom}
                      onSelect={(d) => d && setLiDateFrom(d)}
                      disabled={(d) => d > new Date() || d > liDateTo}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{isRtl ? 'עד תאריך' : 'To'}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('w-[160px] justify-start text-left font-normal gap-2')}>
                      <CalendarIcon size={14} />
                      {format(liDateTo, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={liDateTo}
                      onSelect={(d) => d && setLiDateTo(d)}
                      disabled={(d) => d > new Date() || d < liDateFrom}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Button onClick={handleLiSync} disabled={liSync.syncing} size="sm" className="gap-2">
                {liSync.syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {isRtl ? 'סנכרן עכשיו' : 'Sync now'}
              </Button>
              <div className="space-y-1 flex-1 min-w-[200px]">
                <label className="text-xs text-muted-foreground">{isRtl ? 'חיפוש קמפיין' : 'Search campaign'}</label>
                <div className="relative">
                  <Search size={14} className={cn('absolute top-1/2 -translate-y-1/2 text-muted-foreground', isRtl ? 'right-2' : 'left-2')} />
                  <Input
                    value={liSearch}
                    onChange={(e) => setLiSearch(e.target.value)}
                    placeholder={isRtl ? 'סנן לפי שם קמפיין…' : 'Filter by campaign name…'}
                    className={cn('h-8 text-sm', isRtl ? 'pr-7' : 'pl-7')}
                  />
                </div>
              </div>
            </div>

            {liSync.lastSync?.status === 'error' && liSync.lastSync.error_message && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                {liSync.lastSync.error_message}
              </div>
            )}

            {liSync.campaigns.length > 0 ? (
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
                    {groupByAccount(filterBySearch(liSync.campaigns, liSearch), c => c.linkedin_account_id ?? '').map(group => {
                      const liKey = `li-${group.account}`;
                      const isCollapsed = liSearch.trim() ? false : liCollapsedAccounts.has(liKey);
                      return (
                      <React.Fragment key={liKey}>
                        <TableRow className="bg-muted/40 hover:bg-muted/40 cursor-pointer" onClick={() => toggleAccountCollapse(setLiCollapsedAccounts, liKey)}>
                          <TableCell colSpan={7} className="py-2 text-xs font-semibold text-muted-foreground">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 p-0"
                                  onClick={(e) => { e.stopPropagation(); toggleAccountCollapse(setLiCollapsedAccounts, liKey); }}
                                  aria-label={isCollapsed ? (isRtl ? 'הרחב חשבון' : 'Expand account') : (isRtl ? 'מזער חשבון' : 'Minimize account')}
                                >
                                  {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                </Button>
                                <span>{isRtl ? 'חשבון' : 'Account'}: {group.account}</span>
                                {group.clientName && (
                                  <span className="mx-2 opacity-60">•</span>
                                )}
                                {group.clientName && (
                                  <span>{isRtl ? 'לקוח' : 'Client'}: {group.clientName}</span>
                                )}
                                <span className="mx-2 opacity-60">•</span>
                                <span>{group.rows.length} {isRtl ? 'קמפיינים' : 'campaigns'}</span>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                        {!isCollapsed && group.rows.map(c => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.campaign_name}</TableCell>
                            <TableCell>
                              <Badge variant={c.status === 'ACTIVE' ? 'default' : 'outline'} className="text-xs">
                                {c.status ?? '—'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{c.impressions.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{c.clicks.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{formatCurrency(c.cost_in_local_currency, c.currency_code)}</TableCell>
                            <TableCell className="text-right">{c.conversions.toFixed(1)}</TableCell>
                            <TableCell className="text-right">{(c.ctr * 100).toFixed(2)}%</TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : !liSync.loading && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {isRtl ? 'אין נתונים מסונכרנים. לחץ "סנכרן עכשיו" כדי להתחיל.' : 'No synced data. Click "Sync now" to start.'}
              </p>
            )}
          </CardContent>
          )}
        </Card>
      )}

      {/* Facebook Ads sync panel */}
      {facebookAds.connection?.is_connected && (
        <Card className="bg-card/50 backdrop-blur border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe size={18} style={{ color: '#1877F2' }} />
                  {isRtl ? 'סנכרון Facebook Ads' : 'Facebook Ads Sync'}
                  {fbCollapsed && fbSync.campaigns.length > 0 && (
                    <Badge variant="outline" className="text-xs ml-1">
                      {fbSync.campaigns.length} {isRtl ? 'קמפיינים' : 'campaigns'}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-1">
                  {fbSync.lastSync ? (
                    <>
                      {isRtl ? 'סנכרון אחרון:' : 'Last sync:'}{' '}
                      {format(new Date(fbSync.lastSync.created_at), 'dd/MM/yyyy HH:mm')}
                      {' • '}
                      <span className={fbSync.lastSync.status === 'success' ? 'text-primary' : 'text-destructive'}>
                        {fbSync.lastSync.status === 'success'
                          ? `${fbSync.lastSync.campaigns_synced} ${isRtl ? 'קמפיינים' : 'campaigns'}`
                          : (isRtl ? 'שגיאה' : 'Error')}
                      </span>
                      {' • '}
                      <span className="text-muted-foreground text-xs">
                        {isRtl ? 'סנכרון אוטומטי יומי 03:30 UTC' : 'Auto-sync daily 03:30 UTC'}
                      </span>
                    </>
                  ) : (
                    isRtl ? 'עדיין לא סונכרן • סנכרון אוטומטי יומי 03:30 UTC' : 'Not synced yet • Auto-sync daily 03:30 UTC'
                  )}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFbCollapsed(v => !v)}
                className="gap-1"
                aria-label={fbCollapsed ? (isRtl ? 'הרחב' : 'Expand') : (isRtl ? 'מזער' : 'Minimize')}
              >
                {fbCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                <span className="text-xs">{fbCollapsed ? (isRtl ? 'הרחב' : 'Expand') : (isRtl ? 'מזער' : 'Minimize')}</span>
              </Button>
            </div>
          </CardHeader>
          {!fbCollapsed && (
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{isRtl ? 'מתאריך' : 'From'}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('w-[160px] justify-start text-left font-normal gap-2')}>
                      <CalendarIcon size={14} />
                      {format(fbDateFrom, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fbDateFrom}
                      onSelect={(d) => d && setFbDateFrom(d)}
                      disabled={(d) => d > new Date() || d > fbDateTo}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{isRtl ? 'עד תאריך' : 'To'}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('w-[160px] justify-start text-left font-normal gap-2')}>
                      <CalendarIcon size={14} />
                      {format(fbDateTo, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fbDateTo}
                      onSelect={(d) => d && setFbDateTo(d)}
                      disabled={(d) => d > new Date() || d < fbDateFrom}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Button onClick={handleFbSync} disabled={fbSync.syncing} size="sm" className="gap-2">
                {fbSync.syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {isRtl ? 'סנכרן עכשיו' : 'Sync now'}
              </Button>
              <div className="space-y-1 flex-1 min-w-[200px]">
                <label className="text-xs text-muted-foreground">{isRtl ? 'חיפוש קמפיין' : 'Search campaign'}</label>
                <div className="relative">
                  <Search size={14} className={cn('absolute top-1/2 -translate-y-1/2 text-muted-foreground', isRtl ? 'right-2' : 'left-2')} />
                  <Input
                    value={fbSearch}
                    onChange={(e) => setFbSearch(e.target.value)}
                    placeholder={isRtl ? 'סנן לפי שם קמפיין…' : 'Filter by campaign name…'}
                    className={cn('h-8 text-sm', isRtl ? 'pr-7' : 'pl-7')}
                  />
                </div>
              </div>
            </div>

            {fbSync.lastSync?.status === 'error' && fbSync.lastSync.error_message && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                {fbSync.lastSync.error_message}
              </div>
            )}

            {fbSync.campaigns.length > 0 ? (
              <div className="rounded-md border border-border/50 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRtl ? 'קמפיין' : 'Campaign'}</TableHead>
                      <TableHead>{isRtl ? 'סטטוס' : 'Status'}</TableHead>
                      <TableHead className="text-right">{isRtl ? 'חשיפות' : 'Impressions'}</TableHead>
                      <TableHead className="text-right">{isRtl ? 'קליקים' : 'Clicks'}</TableHead>
                      <TableHead className="text-right">{isRtl ? 'הוצאה' : 'Spend'}</TableHead>
                      <TableHead className="text-right">{isRtl ? 'המרות' : 'Conv.'}</TableHead>
                      <TableHead className="text-right">CTR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupByAccount(filterBySearch(fbSync.campaigns, fbSearch), c => c.account_name ?? c.facebook_account_id ?? '').map(group => {
                      const fbKey = `fb-${group.account}`;
                      const isCollapsed = fbSearch.trim() ? false : fbCollapsedAccounts.has(fbKey);
                      return (
                      <React.Fragment key={fbKey}>
                        <TableRow className="bg-muted/40 hover:bg-muted/40 cursor-pointer" onClick={() => toggleAccountCollapse(setFbCollapsedAccounts, fbKey)}>
                          <TableCell colSpan={7} className="py-2 text-xs font-semibold text-muted-foreground">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 p-0"
                                  onClick={(e) => { e.stopPropagation(); toggleAccountCollapse(setFbCollapsedAccounts, fbKey); }}
                                  aria-label={isCollapsed ? (isRtl ? 'הרחב חשבון' : 'Expand account') : (isRtl ? 'מזער חשבון' : 'Minimize account')}
                                >
                                  {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                </Button>
                                <span>{isRtl ? 'חשבון' : 'Account'}: {group.account}</span>
                                {group.clientName && (<><span className="mx-2 opacity-60">•</span><span>{isRtl ? 'לקוח' : 'Client'}: {group.clientName}</span></>)}
                                <span className="mx-2 opacity-60">•</span>
                                <span>{group.rows.length} {isRtl ? 'קמפיינים' : 'campaigns'}</span>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                        {!isCollapsed && group.rows.map(c => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.campaign_name}</TableCell>
                            <TableCell>
                              <Badge variant={c.status === 'ACTIVE' ? 'default' : 'outline'} className="text-xs">
                                {c.status ?? '—'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{c.impressions.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{c.clicks.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{formatCurrency(c.spend, c.currency_code)}</TableCell>
                            <TableCell className="text-right">{c.conversions.toFixed(1)}</TableCell>
                            <TableCell className="text-right">{(c.ctr * 100).toFixed(2)}%</TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : !fbSync.loading && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {isRtl ? 'אין נתונים מסונכרנים. לחץ "סנכרן עכשיו" כדי להתחיל.' : 'No synced data. Click "Sync now" to start.'}
              </p>
            )}
          </CardContent>
          )}
        </Card>
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
                  {gaCollapsed && gaSync.campaigns.length > 0 && (
                    <Badge variant="outline" className="text-xs ml-1">
                      {gaSync.campaigns.length} {isRtl ? 'קמפיינים' : 'campaigns'}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-1">
                  {gaSync.lastSync ? (
                    <>
                      {isRtl ? 'סנכרון אחרון:' : 'Last sync:'}{' '}
                      {format(new Date(gaSync.lastSync.created_at), 'dd/MM/yyyy HH:mm')}
                      {' • '}
                      <span className={gaSync.lastSync.status === 'success' ? 'text-primary' : 'text-destructive'}>
                        {gaSync.lastSync.status === 'success'
                          ? `${gaSync.lastSync.campaigns_synced} ${isRtl ? 'קמפיינים' : 'campaigns'}`
                          : (isRtl ? 'שגיאה' : 'Error')}
                      </span>
                      {' • '}
                      <span className="text-muted-foreground text-xs">
                        {isRtl ? 'סנכרון אוטומטי יומי 04:00 UTC' : 'Auto-sync daily 04:00 UTC'}
                      </span>
                    </>
                  ) : (
                    isRtl ? 'עדיין לא סונכרן • סנכרון אוטומטי יומי 04:00 UTC' : 'Not synced yet • Auto-sync daily 04:00 UTC'
                  )}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setGaCollapsed(v => !v)} className="gap-1">
                {gaCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                <span className="text-xs">{gaCollapsed ? (isRtl ? 'הרחב' : 'Expand') : (isRtl ? 'מזער' : 'Minimize')}</span>
              </Button>
            </div>
          </CardHeader>
          {!gaCollapsed && (
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{isRtl ? 'מתאריך' : 'From'}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('w-[160px] justify-start text-left font-normal gap-2')}>
                      <CalendarIcon size={14} />
                      {format(gaDateFrom, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={gaDateFrom}
                      onSelect={(d) => d && setGaDateFrom(d)}
                      disabled={(d) => d > new Date() || d > gaDateTo}
                      initialFocus className={cn('p-3 pointer-events-auto')} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{isRtl ? 'עד תאריך' : 'To'}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('w-[160px] justify-start text-left font-normal gap-2')}>
                      <CalendarIcon size={14} />
                      {format(gaDateTo, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={gaDateTo}
                      onSelect={(d) => d && setGaDateTo(d)}
                      disabled={(d) => d > new Date() || d < gaDateFrom}
                      initialFocus className={cn('p-3 pointer-events-auto')} />
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={handleGaSync} disabled={gaSync.syncing} size="sm" className="gap-2">
                {gaSync.syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {isRtl ? 'סנכרן עכשיו' : 'Sync now'}
              </Button>
              <div className="space-y-1 flex-1 min-w-[200px]">
                <label className="text-xs text-muted-foreground">{isRtl ? 'חיפוש קמפיין' : 'Search campaign'}</label>
                <div className="relative">
                  <Search size={14} className={cn('absolute top-1/2 -translate-y-1/2 text-muted-foreground', isRtl ? 'right-2' : 'left-2')} />
                  <Input
                    value={gaSearch}
                    onChange={(e) => setGaSearch(e.target.value)}
                    placeholder={isRtl ? 'סנן לפי שם קמפיין…' : 'Filter by campaign name…'}
                    className={cn('h-8 text-sm', isRtl ? 'pr-7' : 'pl-7')}
                  />
                </div>
              </div>
            </div>

            {gaSync.lastSync?.status === 'error' && gaSync.lastSync.error_message && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                {gaSync.lastSync.error_message}
              </div>
            )}

            {gaSync.campaigns.length > 0 ? (
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
                    {groupByAccount(filterBySearch(gaSync.campaigns, gaSearch), c => c.account_name ?? c.google_customer_id ?? '').map(group => {
                      const gaKey = `ga-${group.account}`;
                      const isCollapsed = gaSearch.trim() ? false : gaCollapsedAccounts.has(gaKey);
                      return (
                      <React.Fragment key={gaKey}>
                        <TableRow className="bg-muted/40 hover:bg-muted/40 cursor-pointer" onClick={() => toggleAccountCollapse(setGaCollapsedAccounts, gaKey)}>
                          <TableCell colSpan={7} className="py-2 text-xs font-semibold text-muted-foreground">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 p-0"
                                  onClick={(e) => { e.stopPropagation(); toggleAccountCollapse(setGaCollapsedAccounts, gaKey); }}
                                  aria-label={isCollapsed ? (isRtl ? 'הרחב חשבון' : 'Expand account') : (isRtl ? 'מזער חשבון' : 'Minimize account')}
                                >
                                  {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                </Button>
                                <span>{isRtl ? 'חשבון' : 'Account'}: {group.account}</span>
                                {group.clientName && (<><span className="mx-2 opacity-60">•</span><span>{isRtl ? 'לקוח' : 'Client'}: {group.clientName}</span></>)}
                                <span className="mx-2 opacity-60">•</span>
                                <span>{group.rows.length} {isRtl ? 'קמפיינים' : 'campaigns'}</span>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                        {!isCollapsed && group.rows.map(c => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.campaign_name}</TableCell>
                            <TableCell>
                              <Badge variant={c.status === 'ENABLED' ? 'default' : 'outline'} className="text-xs">
                                {c.status ?? '—'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{c.impressions.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{c.clicks.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{formatCurrency(c.cost, c.currency_code)}</TableCell>
                            <TableCell className="text-right">{c.conversions.toFixed(1)}</TableCell>
                            <TableCell className="text-right">{(c.ctr * 100).toFixed(2)}%</TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : !gaSync.loading && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {isRtl ? 'אין נתונים מסונכרנים. לחץ "סנכרן עכשיו" כדי להתחיל.' : 'No synced data. Click "Sync now" to start.'}
              </p>
            )}
          </CardContent>
          )}
        </Card>
      )}

      {categories.map(cat => {
        const items = integrations.filter(i => i.category === cat);
        return (
          <div key={cat} className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              {categoryLabels[cat][lang]}
            </h2>
            {cat === 'analytics' && <GoogleSheetsCard isRtl={isRtl} />}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map(item => {
                const isLinkedIn = item.id === 'linkedin';
                const isFacebook = item.id === 'facebook';
                const isGoogleAds = item.id === 'google_ads';
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
                            ? (isLinkedIn && linkedInAds.connection?.account_name
                                ? linkedInAds.connection.account_name
                                : isFacebook && facebookAds.connection?.account_name
                                  ? facebookAds.connection.account_name
                                  : isGoogleAds && googleAds.connection?.account_name
                                    ? googleAds.connection.account_name
                                    : (isRtl ? 'מחובר' : 'Connected'))
                            : (isRtl ? 'לא מחובר' : 'Not connected')}
                        </Badge>
                        {isLinkedIn ? (
                          connected ? (
                            <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={linkedInAds.disconnect}>
                              {isRtl ? 'נתק' : 'Disconnect'}
                            </Button>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              className="text-xs gap-1"
                              onClick={linkedInAds.connect}
                              disabled={linkedInAds.connecting}
                            >
                              {linkedInAds.connecting && <Loader2 size={12} className="animate-spin" />}
                              {isRtl ? 'התחבר' : 'Connect'}
                            </Button>
                          )
                        ) : isFacebook ? (
                          connected ? (
                            <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={facebookAds.disconnect}>
                              {isRtl ? 'נתק' : 'Disconnect'}
                            </Button>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              className="text-xs gap-1"
                              onClick={facebookAds.connect}
                              disabled={facebookAds.connecting}
                            >
                              {facebookAds.connecting && <Loader2 size={12} className="animate-spin" />}
                              {isRtl ? 'התחבר' : 'Connect'}
                            </Button>
                          )
                        ) : isGoogleAds ? (
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
