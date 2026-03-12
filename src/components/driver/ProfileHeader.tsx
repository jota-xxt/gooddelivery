import AvatarUpload from '@/components/AvatarUpload';
import { Star, Shield, Award, Crown, Gem, Medal } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface LevelInfo {
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  min: number;
  max: number;
}

const LEVELS: LevelInfo[] = [
  { label: 'Iniciante', icon: <Shield className="h-4 w-4" />, color: 'text-muted-foreground', bgColor: 'bg-muted', min: 0, max: 50 },
  { label: 'Bronze', icon: <Medal className="h-4 w-4" />, color: 'text-amber-700', bgColor: 'bg-amber-100', min: 50, max: 150 },
  { label: 'Prata', icon: <Award className="h-4 w-4" />, color: 'text-slate-500', bgColor: 'bg-slate-100', min: 150, max: 300 },
  { label: 'Ouro', icon: <Crown className="h-4 w-4" />, color: 'text-yellow-600', bgColor: 'bg-yellow-100', min: 300, max: 500 },
  { label: 'Diamante', icon: <Gem className="h-4 w-4" />, color: 'text-sky-500', bgColor: 'bg-sky-100', min: 500, max: Infinity },
];

export function getDriverLevel(totalDeliveries: number): LevelInfo {
  return LEVELS.find(l => totalDeliveries < l.max) ?? LEVELS[LEVELS.length - 1];
}

interface ProfileHeaderProps {
  userId: string;
  avatarUrl: string | null;
  initials: string;
  fullName: string;
  avgRating: number | null;
  ratingCount: number;
  totalDeliveries: number;
  onAvatarUploaded: (url: string) => void;
}

const ProfileHeader = ({
  userId, avatarUrl, initials, fullName,
  avgRating, ratingCount, totalDeliveries, onAvatarUploaded,
}: ProfileHeaderProps) => {
  const level = getDriverLevel(totalDeliveries);
  const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];
  const progressInLevel = nextLevel
    ? ((totalDeliveries - level.min) / (nextLevel.min - level.min)) * 100
    : 100;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-6 pb-8 text-primary-foreground">
      {/* Decorative circles */}
      <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10" />
      <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5" />

      <div className="relative flex flex-col items-center gap-3">
        <AvatarUpload
          userId={userId}
          currentUrl={avatarUrl}
          initials={initials}
          onUploaded={onAvatarUploaded}
        />

        <div className="text-center">
          <h1 className="text-xl font-bold">{fullName}</h1>

          {avgRating !== null && (
            <div className="flex items-center justify-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map(i => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i <= Math.round(avgRating) ? 'text-yellow-300 fill-yellow-300' : 'text-white/30'}`}
                />
              ))}
              <span className="text-sm font-semibold ml-1">{avgRating.toFixed(1)}</span>
              <span className="text-xs opacity-70">({ratingCount})</span>
            </div>
          )}
        </div>

        {/* Level badge */}
        <Badge className={`${level.bgColor} ${level.color} border-0 gap-1 text-xs font-semibold px-3 py-1`}>
          {level.icon}
          {level.label}
        </Badge>

        {/* Progress to next level */}
        {nextLevel && (
          <div className="w-full max-w-[200px] space-y-1">
            <Progress value={progressInLevel} className="h-2 bg-white/20" />
            <p className="text-[10px] text-center opacity-80">
              {totalDeliveries}/{nextLevel.min} para {nextLevel.label}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileHeader;
