import type { AdminPerformanceStats } from './securityAlertStatsService';
import type { AdminBadge, AdminAchievements, BadgeRarity, BadgeType } from '@/types/badge';

const BADGE_DEFINITIONS: Omit<AdminBadge, 'earnedAt'>[] = [
  // Speed Badges
  {
    id: 'lightning_fast',
    type: 'speed',
    rarity: 'legendary',
    name: '⚡ Relâmpago',
    description: 'Tempo médio de resposta < 2 minutos',
    icon: '⚡',
    color: 'hsl(var(--chart-1))',
    requirement: 'avg_response_time < 2'
  },
  {
    id: 'quick_responder',
    type: 'speed',
    rarity: 'epic',
    name: '🚀 Resposta Rápida',
    description: 'Tempo médio de resposta < 5 minutos',
    icon: '🚀',
    color: 'hsl(var(--chart-2))',
    requirement: 'avg_response_time < 5'
  },
  {
    id: 'fast_hands',
    type: 'speed',
    rarity: 'rare',
    name: '⏱️ Mãos Rápidas',
    description: 'Tempo médio de resposta < 10 minutos',
    icon: '⏱️',
    color: 'hsl(var(--chart-3))',
    requirement: 'avg_response_time < 10'
  },
  
  // Reliability Badges
  {
    id: 'perfect_record',
    type: 'reliability',
    rarity: 'legendary',
    name: '💎 Perfeição',
    description: '100% de taxa de confirmação',
    icon: '💎',
    color: 'hsl(var(--chart-1))',
    requirement: 'confirmation_rate == 100'
  },
  {
    id: 'reliable_guardian',
    type: 'reliability',
    rarity: 'epic',
    name: '🛡️ Guardião Confiável',
    description: 'Taxa de confirmação >= 95%',
    icon: '🛡️',
    color: 'hsl(var(--chart-2))',
    requirement: 'confirmation_rate >= 95'
  },
  {
    id: 'trustworthy',
    type: 'reliability',
    rarity: 'rare',
    name: '✅ Confiável',
    description: 'Taxa de confirmação >= 85%',
    icon: '✅',
    color: 'hsl(var(--chart-3))',
    requirement: 'confirmation_rate >= 85'
  },
  
  // Dedication Badges
  {
    id: 'night_owl',
    type: 'dedication',
    rarity: 'epic',
    name: '🦉 Coruja Noturna',
    description: 'Responde alertas mesmo de madrugada',
    icon: '🦉',
    color: 'hsl(var(--chart-4))',
    requirement: 'alerts_with_action >= 50'
  },
  {
    id: 'action_taker',
    type: 'dedication',
    rarity: 'rare',
    name: '🎯 Executivo',
    description: '80% dos alertas com ação tomada',
    icon: '🎯',
    color: 'hsl(var(--chart-5))',
    requirement: 'action_rate >= 80'
  },
  {
    id: 'first_responder',
    type: 'dedication',
    rarity: 'epic',
    name: '🚨 Primeiro Socorrista',
    description: 'Mais de 100 alertas respondidos',
    icon: '🚨',
    color: 'hsl(var(--primary))',
    requirement: 'total_alerts >= 100'
  },
  
  // Consistency Badges
  {
    id: 'iron_will',
    type: 'consistency',
    rarity: 'legendary',
    name: '🏆 Vontade de Ferro',
    description: 'Top 1 em todos os critérios',
    icon: '🏆',
    color: 'hsl(var(--chart-1))',
    requirement: 'rank == 1'
  },
  {
    id: 'veteran',
    type: 'consistency',
    rarity: 'epic',
    name: '⭐ Veterano',
    description: 'Mais de 200 alertas respondidos',
    icon: '⭐',
    color: 'hsl(var(--chart-2))',
    requirement: 'total_alerts >= 200'
  },
  
  // Hero Badge
  {
    id: 'hero',
    type: 'hero',
    rarity: 'legendary',
    name: '🦸 Herói da Segurança',
    description: 'Performance excepcional em todas as áreas',
    icon: '🦸',
    color: 'hsl(var(--primary))',
    requirement: 'overall_excellence'
  }
];

class AdminBadgeService {
  /**
   * Calcula badges para um admin baseado em suas estatísticas
   */
  calculateBadges(stats: AdminPerformanceStats, rank: number): AdminBadge[] {
    const earnedBadges: AdminBadge[] = [];
    const actionRate = stats.total_alerts > 0 
      ? (stats.alerts_with_action / stats.total_alerts) * 100 
      : 0;

    BADGE_DEFINITIONS.forEach((badge) => {
      let earned = false;

      switch (badge.id) {
        case 'lightning_fast':
          earned = stats.avg_response_time_minutes !== null && stats.avg_response_time_minutes < 2;
          break;
        case 'quick_responder':
          earned = stats.avg_response_time_minutes !== null && stats.avg_response_time_minutes < 5;
          break;
        case 'fast_hands':
          earned = stats.avg_response_time_minutes !== null && stats.avg_response_time_minutes < 10;
          break;
        
        case 'perfect_record':
          earned = stats.confirmation_rate === 100 && stats.total_alerts >= 10;
          break;
        case 'reliable_guardian':
          earned = stats.confirmation_rate >= 95 && stats.total_alerts >= 20;
          break;
        case 'trustworthy':
          earned = stats.confirmation_rate >= 85 && stats.total_alerts >= 10;
          break;
        
        case 'night_owl':
          earned = stats.alerts_with_action >= 50;
          break;
        case 'action_taker':
          earned = actionRate >= 80 && stats.total_alerts >= 20;
          break;
        case 'first_responder':
          earned = stats.total_alerts >= 100;
          break;
        
        case 'iron_will':
          earned = rank === 1 && stats.total_alerts >= 50;
          break;
        case 'veteran':
          earned = stats.total_alerts >= 200;
          break;
        
        case 'hero':
          earned = stats.confirmation_rate >= 90 &&
                   stats.avg_response_time_minutes !== null &&
                   stats.avg_response_time_minutes < 10 &&
                   stats.total_alerts >= 50 &&
                   actionRate >= 70;
          break;
      }

      if (earned) {
        earnedBadges.push({
          ...badge,
          earnedAt: new Date()
        });
      }
    });

    return earnedBadges;
  }

  /**
   * Calcula score total baseado em badges e estatísticas
   */
  calculateScore(stats: AdminPerformanceStats, badges: AdminBadge[]): number {
    let score = 0;

    // Pontos por alertas confirmados
    score += stats.confirmed_alerts * 10;

    // Pontos por ações tomadas
    score += stats.alerts_with_action * 15;

    // Bônus por tempo de resposta rápido
    if (stats.avg_response_time_minutes !== null) {
      if (stats.avg_response_time_minutes < 2) score += 500;
      else if (stats.avg_response_time_minutes < 5) score += 300;
      else if (stats.avg_response_time_minutes < 10) score += 100;
    }

    // Bônus por taxa de confirmação
    if (stats.confirmation_rate === 100) score += 1000;
    else if (stats.confirmation_rate >= 95) score += 500;
    else if (stats.confirmation_rate >= 85) score += 250;

    // Pontos por badges
    badges.forEach((badge) => {
      switch (badge.rarity) {
        case 'legendary': score += 500; break;
        case 'epic': score += 250; break;
        case 'rare': score += 100; break;
        case 'common': score += 50; break;
      }
    });

    return score;
  }

  /**
   * Determina o rank textual baseado no score
   */
  getRank(score: number): string {
    if (score >= 5000) return 'Lendário';
    if (score >= 3000) return 'Épico';
    if (score >= 1500) return 'Raro';
    if (score >= 500) return 'Competente';
    return 'Iniciante';
  }

  /**
   * Calcula o nível baseado no score
   */
  getLevel(score: number): number {
    return Math.floor(score / 500) + 1;
  }

  /**
   * Calcula progresso para o próximo nível (0-100)
   */
  getNextLevelProgress(score: number): number {
    const currentLevelScore = Math.floor(score / 500) * 500;
    const progressInLevel = score - currentLevelScore;
    return Math.min(100, (progressInLevel / 500) * 100);
  }

  /**
   * Gera achievements completos para um admin
   */
  generateAchievements(
    stats: AdminPerformanceStats, 
    rank: number
  ): AdminAchievements {
    const badges = this.calculateBadges(stats, rank);
    const score = this.calculateScore(stats, badges);
    
    return {
      adminId: stats.admin_id,
      badges,
      score,
      rank: this.getRank(score),
      level: this.getLevel(score),
      nextLevelProgress: this.getNextLevelProgress(score)
    };
  }

  /**
   * Retorna a cor CSS baseada na raridade
   */
  getRarityColor(rarity: BadgeRarity): string {
    switch (rarity) {
      case 'legendary': return 'hsl(var(--chart-1))';
      case 'epic': return 'hsl(var(--chart-2))';
      case 'rare': return 'hsl(var(--chart-3))';
      case 'common': return 'hsl(var(--muted-foreground))';
    }
  }
}

// Singleton
let instance: AdminBadgeService | null = null;

export function getAdminBadgeService(): AdminBadgeService {
  if (!instance) {
    instance = new AdminBadgeService();
  }
  return instance;
}

export { AdminBadgeService };
