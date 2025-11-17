export type BadgeType = 'speed' | 'reliability' | 'consistency' | 'dedication' | 'hero';
export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface AdminBadge {
  id: string;
  type: BadgeType;
  rarity: BadgeRarity;
  name: string;
  description: string;
  icon: string;
  color: string;
  requirement: string;
  earnedAt?: Date;
}

export interface AdminAchievements {
  adminId: string;
  badges: AdminBadge[];
  score: number;
  rank: string;
  level: number;
  nextLevelProgress: number; // 0-100
}
