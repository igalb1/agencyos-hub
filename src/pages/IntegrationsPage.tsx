import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useState } from 'react';
import {
  Globe, Search, Music2, BriefcaseBusiness, BarChart3,
  Mail, MessageSquare, FileText, Zap, ExternalLink
} from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  description: { he: string; en: string };
  icon: React.ElementType;
  color: string;
  category: 'ads' | 'crm' | 'analytics' | 'communication';
  connected: boolean;
}

const integrations: Integration[] = [
  { id: 'meta', name: 'Meta Ads', description: { he: 'חיבור לקמפיינים ב-Facebook ו-Instagram', en: 'Connect to Facebook & Instagram campaigns' }, icon: Globe, color: '#1877F2', category: 'ads', connected: true },
  { id: 'google', name: 'Google Ads', description: { he: 'ניהול קמפיינים ב-Google Search ו-Display', en: 'Manage Google Search & Display campaigns' }, icon: Search, color: '#4285F4', category: 'ads', connected: true },
  { id: 'tiktok', name: 'TikTok Ads', description: { he: 'ניהול מודעות ב-TikTok', en: 'Manage TikTok ad campaigns' }, icon: Music2, color: '#000000', category: 'ads', connected: false },
  { id: 'linkedin', name: 'LinkedIn Ads', description: { he: 'קמפיינים ממוקדים ב-LinkedIn', en: 'Targeted LinkedIn ad campaigns' }, icon: BriefcaseBusiness, color: '#0A66C2', category: 'ads', connected: true },
  { id: 'hubspot', name: 'HubSpot CRM', description: { he: 'סנכרון לידים ואנשי קשר', en: 'Sync leads and contacts' }, icon: BarChart3, color: '#FF7A59', category: 'crm', connected: false },
  { id: 'mailchimp', name: 'Mailchimp', description: { he: 'אוטומציות אימייל ורשימות תפוצה', en: 'Email automations & mailing lists' }, icon: Mail, color: '#FFE01B', category: 'communication', connected: false },
  { id: 'slack', name: 'Slack', description: { he: 'התראות והתנהלות צוות', en: 'Team notifications & collaboration' }, icon: MessageSquare, color: '#4A154B', category: 'communication', connected: true },
  { id: 'analytics', name: 'Google Analytics', description: { he: 'מעקב תנועה והמרות באתר', en: 'Website traffic & conversion tracking' }, icon: BarChart3, color: '#E37400', category: 'analytics', connected: true },
  { id: 'sheets', name: 'Google Sheets', description: { he: 'ייצוא דוחות אוטומטי', en: 'Automated report exports' }, icon: FileText, color: '#0F9D58', category: 'analytics', connected: false },
  { id: 'zapier', name: 'Zapier', description: { he: 'אוטומציות בין כלים שונים', en: 'Cross-tool automations' }, icon: Zap, color: '#FF4A00', category: 'analytics', connected: false },
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
  const [states, setStates] = useState<Record<string, boolean>>(
    Object.fromEntries(integrations.map(i => [i.id, i.connected]))
  );

  const toggle = (id: string) => setStates(prev => ({ ...prev, [id]: !prev[id] }));

  const categories = ['ads', 'crm', 'analytics', 'communication'] as const;

  const connectedCount = Object.values(states).filter(Boolean).length;

  return (
    <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
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

      {/* Categories */}
      {categories.map(cat => {
        const items = integrations.filter(i => i.category === cat);
        return (
          <div key={cat} className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              {categoryLabels[cat][lang]}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map(item => (
                <Card key={item.id} className="bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
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
                      <Switch
                        checked={states[item.id]}
                        onCheckedChange={() => toggle(item.id)}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <Badge variant={states[item.id] ? 'default' : 'outline'} className="text-xs">
                        {states[item.id]
                          ? (isRtl ? 'מחובר' : 'Connected')
                          : (isRtl ? 'לא מחובר' : 'Disconnected')}
                      </Badge>
                      <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground">
                        <ExternalLink size={12} />
                        {isRtl ? 'הגדרות' : 'Settings'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
