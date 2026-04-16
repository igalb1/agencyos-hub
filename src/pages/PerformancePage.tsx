import { useApp } from '@/contexts/AppContext';
import { mockCampaigns, mockClients, mockAds, mockSpendByPlatform } from '@/lib/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Area, AreaChart
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, MousePointerClick,
  Eye, Target, Users, Zap
} from 'lucide-react';

const COLORS = ['#00D4FF', '#A78BFA', '#22C55E', '#F59E0B', '#EF4444', '#EC4899'];

export default function PerformancePage() {
  const { lang } = useApp();
  const isHe = lang === 'he';
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');

  const clients = useMemo(() => Array.from(new Set(mockClients.map(c => c.name))), []);
  const platforms = ['Meta', 'Google', 'TikTok', 'LinkedIn'];

  const campaigns = useMemo(() => {
    return mockCampaigns.filter(c => {
      if (filterClient !== 'all' && c.clientName !== filterClient) return false;
      if (filterPlatform !== 'all' && c.platform !== filterPlatform) return false;
      return true;
    });
  }, [filterClient, filterPlatform]);

  const ads = useMemo(() => {
    const campaignIds = new Set(campaigns.map(c => c.id));
    return mockAds.filter(a => campaignIds.has(a.campaignId));
  }, [campaigns]);

  // KPIs
  const kpis = useMemo(() => {
    const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
    const totalBudget = campaigns.reduce((s, c) => s + c.budget, 0);
    const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
    const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
    const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
    const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const cvr = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
    const roas = totalSpend > 0 ? ((totalConversions * 120) / totalSpend) : 0; // assume $120 per conversion
    const budgetUsage = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;

    return { totalSpend, totalBudget, totalImpressions, totalClicks, totalConversions, totalLeads, ctr, cpc, cpl, cvr, roas, budgetUsage };
  }, [campaigns]);

  // Chart data: spend by platform
  const spendByPlatform = useMemo(() => {
    const map: Record<string, number> = {};
    campaigns.forEach(c => { map[c.platform] = (map[c.platform] || 0) + c.spend; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [campaigns]);

  // Chart data: leads by client
  const leadsByClient = useMemo(() => {
    const map: Record<string, number> = {};
    campaigns.forEach(c => { map[c.clientName] = (map[c.clientName] || 0) + c.leads; });
    return Object.entries(map).map(([name, leads]) => ({ name, leads })).sort((a, b) => b.leads - a.leads);
  }, [campaigns]);

  // Chart data: performance by campaign
  const campaignPerformance = useMemo(() => {
    return campaigns
      .filter(c => c.spend > 0)
      .map(c => ({
        name: c.name.length > 18 ? c.name.slice(0, 18) + '…' : c.name,
        CTR: Number(((c.clicks / (c.impressions || 1)) * 100).toFixed(2)),
        CVR: Number(((c.conversions / (c.clicks || 1)) * 100).toFixed(2)),
        CPC: Number((c.spend / (c.clicks || 1)).toFixed(2)),
      }));
  }, [campaigns]);

  // Chart data: conversions funnel
  const funnelData = useMemo(() => [
    { name: isHe ? 'חשיפות' : 'Impressions', value: kpis.totalImpressions },
    { name: isHe ? 'קליקים' : 'Clicks', value: kpis.totalClicks },
    { name: isHe ? 'לידים' : 'Leads', value: kpis.totalLeads },
    { name: isHe ? 'המרות' : 'Conversions', value: kpis.totalConversions },
  ], [kpis, isHe]);

  // Top ads
  const topAds = useMemo(() => {
    return [...ads]
      .sort((a, b) => {
        const aRate = a.clicks > 0 ? a.conversions / a.clicks : 0;
        const bRate = b.clicks > 0 ? b.conversions / b.clicks : 0;
        return bRate - aRate;
      })
      .slice(0, 5);
  }, [ads]);

  const KpiCard = ({ label, value, icon: Icon, trend, suffix = '' }: {
    label: string; value: string; icon: typeof DollarSign; trend?: 'up' | 'down' | 'neutral'; suffix?: string;
  }) => (
    <Card className="bg-card/60 backdrop-blur-sm border-border/50">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-bold text-foreground">{value}{suffix}</p>
        </div>
        {trend && (
          <div className={cn("shrink-0", trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground')}>
            {trend === 'up' ? <TrendingUp size={16} /> : trend === 'down' ? <TrendingDown size={16} /> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const fmt = (n: number) => n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toFixed(0);
  const fmtCurrency = (n: number) => '$' + fmt(n);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">
          {isHe ? 'ביצועים' : 'Performance'}
        </h1>
        <div className="flex gap-2">
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isHe ? 'כל הלקוחות' : 'All Clients'}</SelectItem>
              {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPlatform} onValueChange={setFilterPlatform}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isHe ? 'כל הפלטפורמות' : 'All Platforms'}</SelectItem>
              {platforms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label={isHe ? 'הוצאה כוללת' : 'Total Spend'} value={fmtCurrency(kpis.totalSpend)} icon={DollarSign} trend="up" />
        <KpiCard label={isHe ? 'חשיפות' : 'Impressions'} value={fmt(kpis.totalImpressions)} icon={Eye} trend="up" />
        <KpiCard label={isHe ? 'קליקים' : 'Clicks'} value={fmt(kpis.totalClicks)} icon={MousePointerClick} trend="up" />
        <KpiCard label={isHe ? 'המרות' : 'Conversions'} value={fmt(kpis.totalConversions)} icon={Target} trend="up" />
        <KpiCard label="CTR" value={kpis.ctr.toFixed(2)} icon={Zap} suffix="%" trend={kpis.ctr > 2 ? 'up' : 'neutral'} />
        <KpiCard label="CPC" value={'$' + kpis.cpc.toFixed(2)} icon={MousePointerClick} trend={kpis.cpc < 3 ? 'up' : 'down'} />
        <KpiCard label="CPL" value={'$' + kpis.cpl.toFixed(2)} icon={Users} trend={kpis.cpl < 100 ? 'up' : 'down'} />
        <KpiCard label={isHe ? 'ניצול תקציב' : 'Budget Usage'} value={kpis.budgetUsage.toFixed(0)} icon={DollarSign} suffix="%" trend={kpis.budgetUsage < 90 ? 'up' : 'down'} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Spend by Platform */}
        <Card className="bg-card/60 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{isHe ? 'הוצאה לפי פלטפורמה' : 'Spend by Platform'}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={spendByPlatform} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {spendByPlatform.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Leads by Client */}
        <Card className="bg-card/60 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{isHe ? 'לידים לפי לקוח' : 'Leads by Client'}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={leadsByClient} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip />
                <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Campaign CTR vs CVR */}
        <Card className="bg-card/60 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{isHe ? 'CTR ו-CVR לפי קמפיין' : 'CTR & CVR by Campaign'}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={campaignPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} angle={-25} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="CTR" fill="#00D4FF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="CVR" fill="#A78BFA" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Funnel */}
        <Card className="bg-card/60 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{isHe ? 'משפך המרות' : 'Conversion Funnel'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 pt-2">
              {funnelData.map((step, i) => {
                const maxVal = funnelData[0].value;
                const pct = maxVal > 0 ? (step.value / maxVal) * 100 : 0;
                const dropoff = i > 0 && funnelData[i - 1].value > 0
                  ? ((funnelData[i - 1].value - step.value) / funnelData[i - 1].value * 100).toFixed(1)
                  : null;
                return (
                  <div key={step.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{step.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground font-semibold">{fmt(step.value)}</span>
                        {dropoff && (
                          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                            -{dropoff}%
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="h-6 rounded-md bg-muted/50 overflow-hidden">
                      <div
                        className="h-full rounded-md transition-all"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${COLORS[i]}, ${COLORS[i]}aa)`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Ads */}
      <Card className="bg-card/60 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{isHe ? 'מודעות מובילות (לפי CVR)' : 'Top Ads by CVR'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border/50">
            {topAds.map((ad, i) => {
              const cvr = ad.clicks > 0 ? (ad.conversions / ad.clicks * 100) : 0;
              const ctr = ad.impressions > 0 ? (ad.clicks / ad.impressions * 100) : 0;
              return (
                <div key={ad.id} className="flex items-center gap-3 py-3">
                  <span className="text-sm font-bold text-primary w-6 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{ad.name}</p>
                    <p className="text-xs text-muted-foreground">{ad.clientName} · {ad.platform}</p>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <div className="text-center">
                      <p className="font-semibold text-foreground">{cvr.toFixed(1)}%</p>
                      <p>CVR</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-foreground">{ctr.toFixed(1)}%</p>
                      <p>CTR</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-foreground">${(ad.spend / (ad.clicks || 1)).toFixed(2)}</p>
                      <p>CPC</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
