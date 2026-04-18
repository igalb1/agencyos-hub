import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { mockClients, mockSpendByPlatform, mockSpendOverTime, mockTasks, mockBudgetAlerts } from '@/lib/mock-data';
import { DollarSign, TrendingUp, Users, Target, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';
import { motion } from 'framer-motion';

const totalBudget = mockClients.reduce((s, c) => s + c.budget, 0);
const totalSpend = mockClients.reduce((s, c) => s + c.spend, 0);
const totalLeads = mockClients.reduce((s, c) => s + c.leads, 0);
const avgCpl = totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0;

function KpiCard({ title, value, icon: Icon, color }: { title: string; value: string; icon: any; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{title}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center`} style={{ backgroundColor: `${color}20` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </motion.div>
  );
}

export default function Dashboard() {
  const { lang } = useApp();
  const fmt = (n: number) => `₪${n.toLocaleString()}`;

  const kpis = [
    { title: t('totalBudget', lang), value: fmt(totalBudget), icon: DollarSign, color: '#00D4FF' },
    { title: t('totalSpend', lang), value: fmt(totalSpend), icon: TrendingUp, color: '#A78BFA' },
    { title: t('totalLeads', lang), value: totalLeads.toLocaleString(), icon: Users, color: '#22C55E' },
    { title: t('avgCpl', lang), value: fmt(avgCpl), icon: Target, color: '#F59E0B' },
  ];

  const pieData = mockClients.map(c => ({ name: c.name, value: c.leads, color: c.color }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <KpiCard key={i} {...kpi} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Spend by Platform */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">{t('spendByPlatform', lang)}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mockSpendByPlatform} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: 'hsl(220,30%,8%)', border: '1px solid hsl(220,20%,16%)', borderRadius: 8, color: '#fff' }}
                formatter={(v: number) => fmt(v)}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} label={{ position: 'top', fill: 'hsl(215,20%,75%)', fontSize: 11, formatter: (v: number) => fmt(v) }}>
                {mockSpendByPlatform.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Leads by Client */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">{t('leadsByClient', lang)}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={70}
                innerRadius={38}
                strokeWidth={0}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'hsl(220,30%,8%)', border: '1px solid hsl(220,20%,16%)', borderRadius: 8, color: '#fff' }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, color: 'hsl(215,20%,75%)' }}
                formatter={(value, entry: any) => `${value}: ${entry?.payload?.value ?? ''}`}
              />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Spend Over Time */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">{t('spendOverTime', lang)}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={mockSpendOverTime} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#00D4FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: 'hsl(220,30%,8%)', border: '1px solid hsl(220,20%,16%)', borderRadius: 8, color: '#fff' }}
                formatter={(v: number) => fmt(v)}
              />
              <Area
                type="monotone"
                dataKey="spend"
                stroke="#00D4FF"
                fill="url(#spendGradient)"
                strokeWidth={2}
                label={{ position: 'top', fill: 'hsl(215,20%,75%)', fontSize: 10, formatter: (v: number) => fmt(v) }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Budget Alerts */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-warning" />
            {t('budgetAlerts', lang)}
          </h3>
          <div className="space-y-3">
            {mockBudgetAlerts.map(alert => (
              <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/20">
                <div>
                  <p className="text-sm font-medium text-foreground">{alert.campaignName}</p>
                  <p className="text-xs text-muted-foreground">{alert.clientName}</p>
                </div>
                <span className="text-xs font-medium text-warning">
                  {Math.round((alert.spend / alert.budget) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Tasks */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">{t('recentTasks', lang)}</h3>
          <div className="space-y-3">
            {mockTasks.slice(0, 3).map(task => (
              <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <div className={`w-2 h-2 rounded-full shrink-0 ${task.priority === 'High' ? 'bg-destructive' : task.priority === 'Medium' ? 'bg-warning' : 'bg-success'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.clientName} · {task.assignee}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Top Clients */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">{t('topClients', lang)}</h3>
          <div className="space-y-3">
            {mockClients.filter(c => c.status === 'active').slice(0, 4).map(client => (
              <div key={client.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${client.color}20`, color: client.color }}>
                    {client.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{client.name}</p>
                    <p className="text-xs text-muted-foreground">{client.leads} {t('leads', lang)}</p>
                  </div>
                </div>
                <span className="text-sm font-medium text-foreground">₪{client.spend.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
