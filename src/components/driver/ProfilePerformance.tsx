import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ProfilePerformanceProps {
  thisWeek: number;
  lastWeek: number;
}

const ProfilePerformance = ({ thisWeek, lastWeek }: ProfilePerformanceProps) => {
  const diff = thisWeek - lastWeek;
  const pctChange = lastWeek > 0 ? Math.round((diff / lastWeek) * 100) : thisWeek > 0 ? 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Desempenho Semanal</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold">{thisWeek}</p>
            <p className="text-xs text-muted-foreground">entregas esta semana</p>
          </div>
          <div className="text-right">
            <div className={`flex items-center gap-1 text-sm font-semibold ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
              {diff > 0 ? <TrendingUp className="h-4 w-4" /> : diff < 0 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              {diff > 0 ? '+' : ''}{pctChange}%
            </div>
            <p className="text-xs text-muted-foreground">vs semana anterior ({lastWeek})</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfilePerformance;
