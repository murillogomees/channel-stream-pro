/**
 * Content Randomizer - Utilities for randomizing content on each view
 */

/**
 * Fisher-Yates shuffle algorithm for random array ordering
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get a random subset of items with optional weighting
 */
export function getRandomSubset<T>(
  items: T[],
  count: number,
  weightFn?: (item: T) => number
): T[] {
  if (items.length <= count) {
    return shuffleArray(items);
  }

  if (!weightFn) {
    return shuffleArray(items).slice(0, count);
  }

  // Weighted random selection
  const weighted = items.map(item => ({
    item,
    weight: weightFn(item),
    random: Math.random(),
  }));

  weighted.sort((a, b) => (b.weight * b.random) - (a.weight * a.random));
  
  return weighted.slice(0, count).map(w => w.item);
}

/**
 * Create a unique session key for randomization state
 * Changes on page refresh or tab switch
 */
export function createSessionKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Mix content based on user preferences with randomization
 * Priority: 1. Unfinished content, 2. Based on interests, 3. Random discovery
 */
export function mixContentWithPriority<T extends { id: string }>(
  unfinished: T[],
  recommended: T[],
  all: T[],
  limit: number
): T[] {
  const result: T[] = [];
  const usedIds = new Set<string>();

  // Add unfinished first (priority 1)
  const shuffledUnfinished = shuffleArray(unfinished);
  for (const item of shuffledUnfinished) {
    if (result.length >= limit * 0.3) break; // Max 30% unfinished
    if (!usedIds.has(item.id)) {
      result.push(item);
      usedIds.add(item.id);
    }
  }

  // Add recommended (priority 2)
  const shuffledRecommended = shuffleArray(recommended);
  for (const item of shuffledRecommended) {
    if (result.length >= limit * 0.7) break; // Max 70% total before random
    if (!usedIds.has(item.id)) {
      result.push(item);
      usedIds.add(item.id);
    }
  }

  // Fill with random (priority 3)
  const shuffledAll = shuffleArray(all);
  for (const item of shuffledAll) {
    if (result.length >= limit) break;
    if (!usedIds.has(item.id)) {
      result.push(item);
      usedIds.add(item.id);
    }
  }

  // Final shuffle to mix priorities
  return shuffleArray(result);
}
