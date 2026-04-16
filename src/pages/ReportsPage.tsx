import { useApp } from '@/contexts/AppContext';
import { mockCampaigns, mockClients, mockAds, mockProjects } from '@/lib/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useMemo, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Download, FileText, TrendingUp, Users, Megaphone, CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type ReportType = 'overview' | 'campaigns' | 'clients' | 'ads';

export default function ReportsPage() {
  const { lang } = useApp();
  const isHe = lang === 'he';
  const [reportType, setReportType] = useState<ReportType>('overview');
  const [filterClient, setFilterClient] = useState<string>('all');

  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const clients = useMemo(() => Array.from(new Set(mockClients.map(c => c.name))), []);

  const filteredCampaigns = useMemo(() => {
    return mockCampaigns.filter(c => {
      if (filterClient !== 'all' && c.clientName !== filterClient) return false;
      if (dateFrom && new Date(c.endDate) < dateFrom) return false;
      if (dateTo && new Date(c.startDate) > dateTo) return false;
      return true;
    });
  }, [filterClient, dateFrom, dateTo]);

  const filteredAds = useMemo(() => {
    const ids = new Set(filteredCampaigns.map(c => c.id));
    return mockAds.filter(a => ids.has(a.campaignId));
  }, [filteredCampaigns]);

  const filteredProjects = useMemo(() =>
    filterClient === 'all' ? mockProjects : mockProjects.filter(p => p.clientName === filterClient),
    [filterClient]);

  const filteredClients = useMemo(() =>
    filterClient === 'all' ? mockClients : mockClients.filter(c => c.name === filterClient),
    [filterClient]);

  // Summary stats
  const summary = useMemo(() => {
    const totalSpend = filteredCampaigns.reduce((s, c) => s + c.spend, 0);
    const totalBudget = filteredCampaigns.reduce((s, c) => s + c.budget, 0);
    const totalLeads = filteredCampaigns.reduce((s, c) => s + c.leads, 0);
    const totalClicks = filteredCampaigns.reduce((s, c) => s + c.clicks, 0);
    const totalImpressions = filteredCampaigns.reduce((s, c) => s + c.impressions, 0);
    const totalConversions = filteredCampaigns.reduce((s, c) => s + c.conversions, 0);
    return { totalSpend, totalBudget, totalLeads, totalClicks, totalImpressions, totalConversions };
  }, [filteredCampaigns]);

  const fmt = (n: number) => n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toFixed(0);

  const exportCSV = useCallback((filename: string, headers: string[], rows: string[][]) => {
    const bom = '\uFEFF';
    const csv = bom + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportPDF = useCallback((title: string, headers: string[], rows: string[][]) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.text(new Date().toLocaleDateString(), 14, 28);
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 34,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [0, 212, 255], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 250] },
    });
    doc.save(`${title.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  }, []);

  const handleExportOverview = () => {
    exportCSV('overview-report.csv',
      ['Metric', 'Value'],
      [
        ['Total Budget', `$${summary.totalBudget}`],
        ['Total Spend', `$${summary.totalSpend}`],
        ['Budget Usage', `${(summary.totalBudget > 0 ? (summary.totalSpend / summary.totalBudget * 100) : 0).toFixed(1)}%`],
        ['Impressions', String(summary.totalImpressions)],
        ['Clicks', String(summary.totalClicks)],
        ['Leads', String(summary.totalLeads)],
        ['Conversions', String(summary.totalConversions)],
        ['CTR', `${(summary.totalImpressions > 0 ? (summary.totalClicks / summary.totalImpressions * 100) : 0).toFixed(2)}%`],
        ['CPL', `$${(summary.totalLeads > 0 ? (summary.totalSpend / summary.totalLeads) : 0).toFixed(2)}`],
      ]
    );
  };

  const handleExportCampaigns = () => {
    exportCSV('campaigns-report.csv',
      ['Campaign', 'Client', 'Project', 'Platform', 'Status', 'Budget', 'Spend', 'Impressions', 'Clicks', 'Leads', 'Conversions', 'CTR', 'CPC', 'CPL'],
      filteredCampaigns.map(c => [
        c.name, c.clientName, c.projectName, c.platform, c.status,
        String(c.budget), String(c.spend), String(c.impressions), String(c.clicks), String(c.leads), String(c.conversions),
        `${(c.impressions > 0 ? (c.clicks / c.impressions * 100) : 0).toFixed(2)}%`,
        `$${(c.clicks > 0 ? (c.spend / c.clicks) : 0).toFixed(2)}`,
        `$${(c.leads > 0 ? (c.spend / c.leads) : 0).toFixed(2)}`,
      ])
    );
  };

  const handleExportClients = () => {
    exportCSV('clients-report.csv',
      ['Client', 'Industry', 'Status', 'Budget', 'Spend', 'Leads'],
      filteredClients.map(c => [c.name, c.industry, c.status, String(c.budget), String(c.spend), String(c.leads)])
    );
  };

  const handleExportAds = () => {
    exportCSV('ads-report.csv',
      ['Ad', 'Campaign', 'Client', 'Platform', 'Status', 'Spend', 'Impressions', 'Clicks', 'Leads', 'Conversions', 'CTR', 'CVR'],
      filteredAds.map(a => [
        a.name, a.campaignName, a.clientName, a.platform, a.status,
        String(a.spend), String(a.impressions), String(a.clicks), String(a.leads), String(a.conversions),
        `${(a.impressions > 0 ? (a.clicks / a.impressions * 100) : 0).toFixed(2)}%`,
        `${(a.clicks > 0 ? (a.conversions / a.clicks * 100) : 0).toFixed(2)}%`,
      ])
    );
  };

  // Shared data getters for both CSV and PDF
  const getOverviewData = () => ({
    headers: ['Metric', 'Value'],
    rows: [
      ['Total Budget', `$${summary.totalBudget}`], ['Total Spend', `$${summary.totalSpend}`],
      ['Budget Usage', `${(summary.totalBudget > 0 ? (summary.totalSpend / summary.totalBudget * 100) : 0).toFixed(1)}%`],
      ['Impressions', String(summary.totalImpressions)], ['Clicks', String(summary.totalClicks)],
      ['Leads', String(summary.totalLeads)], ['Conversions', String(summary.totalConversions)],
      ['CTR', `${(summary.totalImpressions > 0 ? (summary.totalClicks / summary.totalImpressions * 100) : 0).toFixed(2)}%`],
      ['CPL', `$${(summary.totalLeads > 0 ? (summary.totalSpend / summary.totalLeads) : 0).toFixed(2)}`],
    ],
  });

  const getCampaignsData = () => ({
    headers: ['Campaign', 'Client', 'Platform', 'Status', 'Budget', 'Spend', 'Leads', 'CTR', 'CPC', 'CPL'],
    rows: filteredCampaigns.map(c => [
      c.name, c.clientName, c.platform, c.status, String(c.budget), String(c.spend), String(c.leads),
      `${(c.impressions > 0 ? (c.clicks / c.impressions * 100) : 0).toFixed(2)}%`,
      `$${(c.clicks > 0 ? (c.spend / c.clicks) : 0).toFixed(2)}`,
      `$${(c.leads > 0 ? (c.spend / c.leads) : 0).toFixed(2)}`,
    ]),
  });

  const getClientsData = () => ({
    headers: ['Client', 'Industry', 'Status', 'Budget', 'Spend', 'Leads'],
    rows: filteredClients.map(c => [c.name, c.industry, c.status, String(c.budget), String(c.spend), String(c.leads)]),
  });

  const getAdsData = () => ({
    headers: ['Ad', 'Campaign', 'Platform', 'Status', 'Spend', 'Clicks', 'Conv.', 'CTR', 'CVR'],
    rows: filteredAds.map(a => [
      a.name, a.campaignName, a.platform, a.status, String(a.spend), String(a.clicks), String(a.conversions),
      `${(a.impressions > 0 ? (a.clicks / a.impressions * 100) : 0).toFixed(2)}%`,
      `${(a.clicks > 0 ? (a.conversions / a.clicks * 100) : 0).toFixed(1)}%`,
    ]),
  });

  const dataGetters: Record<ReportType, () => { headers: string[]; rows: string[][] }> = {
    overview: getOverviewData, campaigns: getCampaignsData, clients: getClientsData, ads: getAdsData,
  };

  const reportTitles: Record<ReportType, string> = {
    overview: 'Overview Report', campaigns: 'Campaigns Report', clients: 'Clients Report', ads: 'Ads Report',
  };

  const reportCards = [
    { type: 'overview' as const, icon: TrendingUp, title: isHe ? 'סקירה כללית' : 'Overview', desc: isHe ? 'סיכום ביצועים כולל' : 'Overall performance summary' },
    { type: 'campaigns' as const, icon: Megaphone, title: isHe ? 'קמפיינים' : 'Campaigns', desc: isHe ? 'פירוט לפי קמפיין' : 'Campaign-level breakdown' },
    { type: 'clients' as const, icon: Users, title: isHe ? 'לקוחות' : 'Clients', desc: isHe ? 'ביצועים לפי לקוח' : 'Client performance' },
    { type: 'ads' as const, icon: FileText, title: isHe ? 'מודעות' : 'Ads', desc: isHe ? 'ביצועי מודעות' : 'Ad performance' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">{isHe ? 'דוחות' : 'Reports'}</h1>
        <div className="flex flex-wrap gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-start font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {dateFrom ? format(dateFrom, 'dd/MM/yy') : (isHe ? 'מתאריך' : 'From')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-start font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {dateTo ? format(dateTo, 'dd/MM/yy') : (isHe ? 'עד תאריך' : 'To')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }} className="text-xs text-muted-foreground">
              {isHe ? 'נקה' : 'Clear'}
            </Button>
          )}
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isHe ? 'כל הלקוחות' : 'All Clients'}</SelectItem>
              {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {reportCards.map(r => (
          <button
            key={r.type}
            onClick={() => setReportType(r.type)}
            className={cn(
              "p-4 rounded-lg border text-start transition-all",
              reportType === r.type
                ? "bg-primary/10 border-primary/40 shadow-sm"
                : "bg-card/60 border-border/50 hover:border-primary/20"
            )}
          >
            <r.icon size={20} className={cn("mb-2", reportType === r.type ? 'text-primary' : 'text-muted-foreground')} />
            <p className="text-sm font-semibold text-foreground">{r.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
          </button>
        ))}
      </div>

      {/* Export Buttons */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            const { headers, rows } = dataGetters[reportType]();
            exportPDF(reportTitles[reportType], headers, rows);
          }}
        >
          <FileText size={16} />
          PDF
        </Button>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => {
            const { headers, rows } = dataGetters[reportType]();
            exportCSV(`${reportTitles[reportType].replace(/\s+/g, '-').toLowerCase()}.csv`, headers, rows);
          }}
        >
          <Download size={16} />
          CSV
        </Button>
      </div>

      {/* Report Content */}
      {reportType === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: isHe ? 'תקציב כולל' : 'Total Budget', value: `$${fmt(summary.totalBudget)}` },
              { label: isHe ? 'הוצאה כוללת' : 'Total Spend', value: `$${fmt(summary.totalSpend)}` },
              { label: isHe ? 'ניצול תקציב' : 'Budget Usage', value: `${(summary.totalBudget > 0 ? (summary.totalSpend / summary.totalBudget * 100) : 0).toFixed(0)}%` },
              { label: isHe ? 'חשיפות' : 'Impressions', value: fmt(summary.totalImpressions) },
              { label: isHe ? 'קליקים' : 'Clicks', value: fmt(summary.totalClicks) },
              { label: isHe ? 'לידים' : 'Leads', value: fmt(summary.totalLeads) },
              { label: isHe ? 'המרות' : 'Conversions', value: fmt(summary.totalConversions) },
              { label: 'CTR', value: `${(summary.totalImpressions > 0 ? (summary.totalClicks / summary.totalImpressions * 100) : 0).toFixed(2)}%` },
              { label: 'CPL', value: `$${(summary.totalLeads > 0 ? (summary.totalSpend / summary.totalLeads) : 0).toFixed(2)}` },
            ].map(kpi => (
              <Card key={kpi.label} className="bg-card/60 backdrop-blur-sm border-border/50">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-xl font-bold text-foreground mt-1">{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Platform breakdown */}
          <Card className="bg-card/60 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{isHe ? 'פירוט לפי פלטפורמה' : 'Platform Breakdown'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      {[isHe ? 'פלטפורמה' : 'Platform', isHe ? 'הוצאה' : 'Spend', isHe ? 'קליקים' : 'Clicks', isHe ? 'לידים' : 'Leads', 'CTR', 'CPL'].map(h => (
                        <th key={h} className="py-2 px-3 text-start text-xs font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(['Meta', 'Google', 'TikTok', 'LinkedIn'] as const).map(platform => {
                      const pCampaigns = filteredCampaigns.filter(c => c.platform === platform);
                      const spend = pCampaigns.reduce((s, c) => s + c.spend, 0);
                      const clicks = pCampaigns.reduce((s, c) => s + c.clicks, 0);
                      const impressions = pCampaigns.reduce((s, c) => s + c.impressions, 0);
                      const leads = pCampaigns.reduce((s, c) => s + c.leads, 0);
                      if (spend === 0) return null;
                      return (
                        <tr key={platform} className="border-b border-border/30 hover:bg-muted/20">
                          <td className="py-2 px-3 font-medium text-foreground">{platform}</td>
                          <td className="py-2 px-3 text-foreground">${fmt(spend)}</td>
                          <td className="py-2 px-3 text-foreground">{fmt(clicks)}</td>
                          <td className="py-2 px-3 text-foreground">{fmt(leads)}</td>
                          <td className="py-2 px-3 text-foreground">{(impressions > 0 ? (clicks / impressions * 100) : 0).toFixed(2)}%</td>
                          <td className="py-2 px-3 text-foreground">${(leads > 0 ? (spend / leads) : 0).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {reportType === 'campaigns' && (
        <Card className="bg-card/60 backdrop-blur-sm border-border/50">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {[isHe ? 'קמפיין' : 'Campaign', isHe ? 'לקוח' : 'Client', isHe ? 'פלטפורמה' : 'Platform', isHe ? 'סטטוס' : 'Status', isHe ? 'תקציב' : 'Budget', isHe ? 'הוצאה' : 'Spend', isHe ? 'לידים' : 'Leads', 'CTR', 'CPC', 'CPL'].map(h => (
                      <th key={h} className="py-2.5 px-3 text-start text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.map(c => (
                    <tr key={c.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="py-2 px-3 font-medium text-foreground">{c.name}</td>
                      <td className="py-2 px-3 text-muted-foreground">{c.clientName}</td>
                      <td className="py-2 px-3"><Badge variant="outline" className="text-[10px]">{c.platform}</Badge></td>
                      <td className="py-2 px-3">
                        <Badge className={cn("text-[10px]",
                          c.status === 'Live' ? 'bg-emerald-500 text-white' :
                          c.status === 'Paused' ? 'bg-muted text-muted-foreground' : 'bg-amber-500 text-white'
                        )}>{c.status}</Badge>
                      </td>
                      <td className="py-2 px-3 text-foreground">${fmt(c.budget)}</td>
                      <td className="py-2 px-3 text-foreground">${fmt(c.spend)}</td>
                      <td className="py-2 px-3 text-foreground">{c.leads}</td>
                      <td className="py-2 px-3 text-foreground">{(c.impressions > 0 ? (c.clicks / c.impressions * 100) : 0).toFixed(2)}%</td>
                      <td className="py-2 px-3 text-foreground">${(c.clicks > 0 ? (c.spend / c.clicks) : 0).toFixed(2)}</td>
                      <td className="py-2 px-3 text-foreground">${(c.leads > 0 ? (c.spend / c.leads) : 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {reportType === 'clients' && (
        <Card className="bg-card/60 backdrop-blur-sm border-border/50">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {[isHe ? 'לקוח' : 'Client', isHe ? 'תעשייה' : 'Industry', isHe ? 'סטטוס' : 'Status', isHe ? 'תקציב' : 'Budget', isHe ? 'הוצאה' : 'Spend', isHe ? 'ניצול' : 'Usage', isHe ? 'לידים' : 'Leads', isHe ? 'קמפיינים' : 'Campaigns'].map(h => (
                      <th key={h} className="py-2.5 px-3 text-start text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map(c => {
                    const clientCampaigns = mockCampaigns.filter(cm => cm.clientName === c.name);
                    return (
                      <tr key={c.id} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="py-2 px-3 font-medium text-foreground">{c.name}</td>
                        <td className="py-2 px-3 text-muted-foreground">{c.industry}</td>
                        <td className="py-2 px-3">
                          <Badge className={cn("text-[10px]", c.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground')}>
                            {c.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-foreground">${fmt(c.budget)}</td>
                        <td className="py-2 px-3 text-foreground">${fmt(c.spend)}</td>
                        <td className="py-2 px-3 text-foreground">{(c.budget > 0 ? (c.spend / c.budget * 100) : 0).toFixed(0)}%</td>
                        <td className="py-2 px-3 text-foreground">{c.leads}</td>
                        <td className="py-2 px-3 text-foreground">{clientCampaigns.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {reportType === 'ads' && (
        <Card className="bg-card/60 backdrop-blur-sm border-border/50">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {[isHe ? 'מודעה' : 'Ad', isHe ? 'קמפיין' : 'Campaign', isHe ? 'פלטפורמה' : 'Platform', isHe ? 'סטטוס' : 'Status', isHe ? 'הוצאה' : 'Spend', isHe ? 'קליקים' : 'Clicks', isHe ? 'המרות' : 'Conv.', 'CTR', 'CVR', 'CPC'].map(h => (
                      <th key={h} className="py-2.5 px-3 text-start text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAds.map(a => (
                    <tr key={a.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="py-2 px-3 font-medium text-foreground">{a.name}</td>
                      <td className="py-2 px-3 text-muted-foreground">{a.campaignName}</td>
                      <td className="py-2 px-3"><Badge variant="outline" className="text-[10px]">{a.platform}</Badge></td>
                      <td className="py-2 px-3">
                        <Badge className={cn("text-[10px]",
                          a.status === 'Active' ? 'bg-emerald-500 text-white' :
                          a.status === 'Paused' ? 'bg-amber-500 text-white' :
                          a.status === 'Rejected' ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground'
                        )}>{a.status}</Badge>
                      </td>
                      <td className="py-2 px-3 text-foreground">${fmt(a.spend)}</td>
                      <td className="py-2 px-3 text-foreground">{fmt(a.clicks)}</td>
                      <td className="py-2 px-3 text-foreground">{a.conversions}</td>
                      <td className="py-2 px-3 text-foreground">{(a.impressions > 0 ? (a.clicks / a.impressions * 100) : 0).toFixed(2)}%</td>
                      <td className="py-2 px-3 text-foreground">{(a.clicks > 0 ? (a.conversions / a.clicks * 100) : 0).toFixed(1)}%</td>
                      <td className="py-2 px-3 text-foreground">${(a.clicks > 0 ? (a.spend / a.clicks) : 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
