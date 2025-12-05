import { Trophy, Medal, Award } from 'lucide-react';
import { AffiliateLeaderboardEntry } from '@/hooks/useAffiliateAnalytics';

interface Props {
  data: AffiliateLeaderboardEntry[];
}

export function AffiliateLeaderboard({ data }: Props) {
  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 1:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 2:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="w-5 text-center text-sm font-medium text-muted-foreground">{index + 1}</span>;
    }
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum afiliado ativo ainda
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((affiliate, index) => (
        <div 
          key={affiliate.id}
          className={`flex items-center gap-3 p-3 rounded-lg ${
            index < 3 ? 'bg-primary/5' : 'bg-muted/30'
          }`}
        >
          <div className="w-8 flex justify-center">
            {getRankIcon(index)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{affiliate.name}</span>
              <span 
                className="px-1.5 py-0.5 rounded text-xs"
                style={{ 
                  backgroundColor: `${affiliate.tier_color}20`,
                  color: affiliate.tier_color
                }}
              >
                {affiliate.tier_name}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {affiliate.total_referrals} indicações • {affiliate.conversion_rate.toFixed(1)}% conversão
            </div>
          </div>

          <div className="text-right">
            <div className="font-bold text-green-500">
              R$ {affiliate.total_earnings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
