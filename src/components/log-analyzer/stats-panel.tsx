import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LogStatistics } from '@/types/log';

interface StatsPanelProps {
  statistics: LogStatistics | null;
}

const LEVEL_CHART_COLORS: Record<string, string> = {
  ERROR: '#ef4444',
  CRITICAL: '#dc2626',
  EMERGENCY: '#dc2626',
  ALERT: '#dc2626',
  WARNING: '#f59e0b',
  WARN: '#f59e0b',
  NOTICE: '#3b82f6',
  INFO: '#3b82f6',
  DEBUG: '#64748b',
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export function StatsPanel({ statistics }: StatsPanelProps) {
  const pieData = useMemo(() => {
    if (!statistics?.level_distribution) return [];
    return Object.entries(statistics.level_distribution).map(([name, value]) => ({
      name,
      value,
      color: LEVEL_CHART_COLORS[name] ?? '#64748b',
    }));
  }, [statistics]);

  const timeData = useMemo(() => {
    if (!statistics?.entries_over_time) return [];
    return statistics.entries_over_time.map((item) => ({
      time: item.time.length > 13 ? item.time.slice(11, 16) : item.time,
      count: item.count,
    }));
  }, [statistics]);

  const sourceData = useMemo(() => {
    if (!statistics?.top_sources) return [];
    return statistics.top_sources.slice(0, 8).map((item) => ({
      name: item.source.length > 20 ? item.source.slice(0, 20) + '...' : item.source,
      count: item.count,
    }));
  }, [statistics]);

  const ipData = useMemo(() => {
    if (!statistics?.top_ips) return [];
    return statistics.top_ips.slice(0, 8).map((item) => ({
      name: item.ip,
      count: item.count,
    }));
  }, [statistics]);

  if (!statistics) {
    return (
      <div className="glass-card flex flex-col items-center gap-4 p-12">
        <Activity className="h-12 w-12 text-accent/30" />
        <h3 className="text-lg font-semibold text-text-primary">No Statistics</h3>
        <p className="text-sm text-text-secondary text-center max-w-md">
          Analyze log content to generate statistics and visualizations.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
    >
      {/* Error Rate Card */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6">
        <h4 className="text-xs font-medium text-text-muted mb-3">Error Rate</h4>
        <div className="flex items-end gap-3">
          <span className={cn(
            'text-4xl font-bold font-mono',
            statistics.error_rate > 10 ? 'text-danger' : statistics.error_rate > 5 ? 'text-warning' : 'text-success',
          )}>
            {statistics.error_rate}%
          </span>
          {statistics.error_rate > 5 ? (
            <TrendingUp className="h-5 w-5 text-danger mb-1" />
          ) : (
            <TrendingDown className="h-5 w-5 text-success mb-1" />
          )}
        </div>
        <p className="mt-2 text-xs text-text-muted">
          {statistics.error_count} errors out of {statistics.total_entries} total entries
        </p>
      </motion.div>

      {/* Level Distribution Pie */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6">
        <h4 className="text-xs font-medium text-text-muted mb-3">Log Level Distribution</h4>
        {pieData.length > 0 ? (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={160}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={65}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#f1f5f9' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-1.5">
              {pieData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-text-secondary">{entry.name}</span>
                  <span className="text-text-muted ml-auto">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-text-muted">No data</p>
        )}
      </motion.div>

      {/* Entries Over Time */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 lg:col-span-2">
        <h4 className="text-xs font-medium text-text-muted mb-3">Entries Over Time</h4>
        {timeData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={timeData}>
              <defs>
                <linearGradient id="logTimeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ color: '#f1f5f9' }}
              />
              <Area type="monotone" dataKey="count" stroke="#00d4ff" fill="url(#logTimeGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-text-muted">No time-series data available</p>
        )}
      </motion.div>

      {/* Top Sources */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6">
        <h4 className="text-xs font-medium text-text-muted mb-3">Top Sources</h4>
        {sourceData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sourceData} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} width={80} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ color: '#f1f5f9' }}
              />
              <Bar dataKey="count" fill="#00d4ff" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-text-muted">No source data</p>
        )}
      </motion.div>

      {/* Top IPs */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6">
        <h4 className="text-xs font-medium text-text-muted mb-3">Top IPs</h4>
        {ipData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ipData} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} width={100} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ color: '#f1f5f9' }}
              />
              <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-text-muted">No IP data (web logs only)</p>
        )}
      </motion.div>
    </motion.div>
  );
}
