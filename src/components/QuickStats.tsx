import { type LucideIcon } from 'lucide-react';

interface StatItem {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
}

interface QuickStatsProps {
  stats: StatItem[];
}

const QuickStats = ({ stats }: QuickStatsProps) => {
  return (
    <div className={`grid gap-3 ${
      { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' }[Math.min(stats.length, 4)] ?? 'grid-cols-2 sm:grid-cols-4'
    }`}>
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div
            key={i}
            className="bg-card rounded-xl border p-3 flex flex-col items-center gap-1 shadow-sm"
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${stat.color ?? 'bg-primary/10 text-primary'}`}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold leading-tight">{stat.value}</span>
            <span className="text-[10px] text-muted-foreground text-center leading-tight">{stat.label}</span>
          </div>
        );
      })}
    </div>
  );
};

export default QuickStats;
