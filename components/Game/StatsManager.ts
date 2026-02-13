'use client';

const STORAGE_KEY = 'moski_stats';

export interface GameStats {
    totalGames: number;
    totalPipeScore: number;
    totalCoinScore: number;
    totalDiamonds: number;
    bestTotal: number;
    bestPipes: number;
    bestCoins: number;
    bestCombo: number;
    achievement20: boolean;
}

const DEFAULT_STATS: GameStats = {
    totalGames: 0,
    totalPipeScore: 0,
    totalCoinScore: 0,
    totalDiamonds: 0,
    bestTotal: 0,
    bestPipes: 0,
    bestCoins: 0,
    bestCombo: 0,
    achievement20: false,
};

export function loadStats(): GameStats {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_STATS };
        const parsed = JSON.parse(raw);
        // Merge with defaults to handle missing fields from older versions
        return { ...DEFAULT_STATS, ...parsed };
    } catch {
        return { ...DEFAULT_STATS };
    }
}

export function saveGameResult(
    pipeScore: number,
    coinScore: number,
    diamonds: number,
    maxCombo: number
): GameStats {
    const stats = loadStats();
    const totalScore = pipeScore + coinScore;

    stats.totalGames += 1;
    stats.totalPipeScore += pipeScore;
    stats.totalCoinScore += coinScore;
    stats.totalDiamonds += diamonds;
    stats.bestTotal = Math.max(stats.bestTotal, totalScore);
    stats.bestPipes = Math.max(stats.bestPipes, pipeScore);
    stats.bestCoins = Math.max(stats.bestCoins, coinScore);
    stats.bestCombo = Math.max(stats.bestCombo, maxCombo);
    if (totalScore >= 20) stats.achievement20 = true;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch {
        // Storage full or unavailable
    }

    return stats;
}

export function resetStats(): GameStats {
    const fresh = { ...DEFAULT_STATS };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
        // Storage unavailable
    }
    return fresh;
}
