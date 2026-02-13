'use client';

import { useState, useEffect, useRef } from 'react';
import { GameStats } from './StatsManager';

type GameState = 'START' | 'PLAYING' | 'GAME_OVER';

interface GameOverlayProps {
    gameState: GameState;
    pipeScore: number;
    coinScore: number;
    highScore: number;
    onStart: () => void;
    stats: GameStats | null;
    showStats: boolean;
    onToggleStats: () => void;
    onResetStats: () => void;
}

// Count-up hook: animates a number from 0 to target
function useCountUp(target: number, duration: number = 800, active: boolean = true) {
    const [value, setValue] = useState(0);
    const startTime = useRef<number | null>(null);
    const rafId = useRef<number>(0);

    useEffect(() => {
        if (!active || target === 0) {
            setValue(target);
            return;
        }
        setValue(0);
        startTime.current = null;

        const animate = (time: number) => {
            if (!startTime.current) startTime.current = time;
            const elapsed = time - startTime.current;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * target));
            if (progress < 1) {
                rafId.current = requestAnimationFrame(animate);
            }
        };

        rafId.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafId.current);
    }, [target, duration, active]);

    return value;
}

export default function GameOverlay({
    gameState, pipeScore, coinScore, highScore, onStart,
    stats, showStats, onToggleStats, onResetStats,
}: GameOverlayProps) {
    if (gameState === 'PLAYING') return null;

    const isGameOver = gameState === 'GAME_OVER';
    const totalScore = pipeScore + coinScore;

    // Count-up animations (only on game over)
    const animPipe = useCountUp(pipeScore, 600, isGameOver);
    const animCoin = useCountUp(coinScore, 600, isGameOver);
    const animTotal = useCountUp(totalScore, 900, isGameOver);

    // Check if achievement just unlocked this game
    const justUnlocked20 = isGameOver && totalScore >= 20 && stats && stats.achievement20;

    // CSS animations
    const animStyles = (
        <style>{`
            @keyframes coin-spin {
                0%, 100% { transform: rotateY(0deg); }
                50% { transform: rotateY(180deg); }
            }
            @keyframes diamond-pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.25); }
            }
            @keyframes pop-in {
                0% { transform: scale(0.7); opacity: 0; }
                60% { transform: scale(1.05); }
                100% { transform: scale(1); opacity: 1; }
            }
            @keyframes achievement-glow {
                0%, 100% { box-shadow: 0 0 8px rgba(255,215,0,0.4); }
                50% { box-shadow: 0 0 20px rgba(255,215,0,0.8); }
            }
            .coin-spin { animation: coin-spin 2s ease-in-out infinite; }
            .diamond-pulse { animation: diamond-pulse 1.5s ease-in-out infinite; }
            .pop-in { animation: pop-in 0.4s ease-out forwards; }
            .achievement-glow { animation: achievement-glow 2s ease-in-out infinite; }
        `}</style>
    );

    // Stats Modal
    if (showStats && stats) {
        return (
            <>
                {animStyles}
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/40 backdrop-blur-sm">
                    <div className="bg-[#DED895] rounded-xl p-5 mx-4 text-center border-4 border-[#543847] shadow-lg max-w-xs w-full pop-in">
                        <h2 className="text-2xl font-bold mb-3 text-[#543847]">STATISTIQUES</h2>

                        <div className="bg-[#C4A86B] rounded-lg p-3 mb-3 text-left space-y-2">
                            {/* Games played */}
                            <div className="flex justify-between items-center">
                                <span className="text-[#543847]/70 text-sm">Parties</span>
                                <span className="font-bold text-[#543847]">{stats.totalGames}</span>
                            </div>

                            <div className="border-t border-[#543847]/20 pt-2">
                                <p className="text-xs font-semibold text-[#543847]/50 mb-1">RECORDS</p>
                            </div>

                            {/* Best scores */}
                            <div className="flex justify-between items-center">
                                <span className="text-[#543847]/70 text-sm">Meilleur score</span>
                                <span className="font-bold text-[#543847]">{stats.bestTotal}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[#543847]/70 text-sm">Meilleur parcours</span>
                                <span className="font-bold text-[#543847]">{stats.bestPipes}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[#543847]/70 text-sm flex items-center gap-1">
                                    <img src="/sprites/coin.png" alt="" className="w-8 h-8 coin-spin" style={{ imageRendering: 'pixelated' }} />
                                    Meilleures pièces
                                </span>
                                <span className="font-bold text-yellow-700">{stats.bestCoins}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[#543847]/70 text-sm">Meilleur combo</span>
                                <span className="font-bold text-orange-600">{stats.bestCombo}</span>
                            </div>

                            <div className="border-t border-[#543847]/20 pt-2">
                                <p className="text-xs font-semibold text-[#543847]/50 mb-1">TOTAUX</p>
                            </div>

                            {/* Lifetime totals */}
                            <div className="flex justify-between items-center">
                                <span className="text-[#543847]/70 text-sm flex items-center gap-1">
                                    <img src="/sprites/coin.png" alt="" className="w-8 h-8 coin-spin" style={{ imageRendering: 'pixelated' }} />
                                    Pièces collectées
                                </span>
                                <span className="font-bold text-yellow-700">{stats.totalCoinScore}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[#543847]/70 text-sm flex items-center gap-1">
                                    <img src="/sprites/diamond.png" alt="" className="w-8 h-8 diamond-pulse" style={{ imageRendering: 'pixelated' }} />
                                    Diamants
                                </span>
                                <span className="font-bold text-cyan-600">{stats.totalDiamonds}</span>
                            </div>

                            {/* Achievement */}
                            <div className="border-t border-[#543847]/20 pt-2">
                                <p className="text-xs font-semibold text-[#543847]/50 mb-1">SUCCÈS</p>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[#543847]/70 text-sm">Score de 20 pts</span>
                                <span className={`font-bold text-sm ${stats.achievement20 ? 'text-green-600' : 'text-[#543847]/30'}`}>
                                    {stats.achievement20 ? '✅' : '🔒'}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <button
                                onClick={onToggleStats}
                                className="px-6 py-2 bg-[#5DBE4A] hover:bg-[#4CAF3A] text-white font-bold rounded-lg transition-all border-b-4 border-[#3D8B32] active:border-b-0 active:mt-1"
                            >
                                RETOUR
                            </button>
                            <button
                                onClick={onResetStats}
                                className="px-4 py-1.5 bg-red-500/80 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all"
                            >
                                Réinitialiser les stats
                            </button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            {animStyles}
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/40 backdrop-blur-sm">
                <div className="bg-[#DED895] rounded-xl p-6 mx-4 text-center border-4 border-[#543847] shadow-lg max-w-xs w-full pop-in">
                    {gameState === 'START' ? (
                        <>
                            <h1
                                className="text-4xl font-bold mb-2 text-[#543847]"
                                style={{ fontFamily: 'system-ui, sans-serif' }}
                            >
                                MOSKI FLY
                            </h1>
                            <p className="text-[#543847]/70 mb-4 text-sm">
                                Tap or press Space to fly!
                            </p>

                            <div className="mb-4">
                                <div className="w-20 h-20 mx-auto animate-bounce">
                                    <img
                                        src="/sprites/v2.png"
                                        alt="Moski"
                                        className="w-full h-full object-contain"
                                        style={{ imageRendering: 'pixelated' }}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={onStart}
                                className="px-8 py-3 bg-[#5DBE4A] hover:bg-[#4CAF3A] text-white font-bold rounded-lg transition-all border-b-4 border-[#3D8B32] active:border-b-0 active:mt-1"
                            >
                                START
                            </button>

                            {highScore > 0 && (
                                <p className="mt-3 text-sm text-[#543847]/70">
                                    Best: <span className="font-bold text-[#543847]">{highScore}</span>
                                </p>
                            )}

                            {stats && stats.totalGames > 0 && (
                                <button
                                    onClick={onToggleStats}
                                    className="mt-2 px-4 py-1.5 bg-[#543847]/20 hover:bg-[#543847]/30 text-[#543847] text-sm font-bold rounded-lg transition-all"
                                >
                                    Stats
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            <h2 className="text-3xl font-bold mb-3 text-[#543847]">
                                GAME OVER
                            </h2>

                            <div className="bg-[#C4A86B] rounded-lg p-4 mb-4">
                                {/* Pipe Score */}
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[#543847]/70 text-sm flex items-center gap-1">
                                        PARCOURS
                                    </span>
                                    <span className="text-xl font-bold text-[#543847]">{animPipe}</span>
                                </div>
                                {/* Coin Score */}
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[#543847]/70 text-sm flex items-center gap-1">
                                        <img src="/sprites/coin.png" alt="" className="w-8 h-8 coin-spin" style={{ imageRendering: 'pixelated' }} />
                                        PIÈCES
                                    </span>
                                    <span className="text-xl font-bold text-yellow-600">{animCoin}</span>
                                </div>
                                {/* Total */}
                                <div className="border-t border-[#543847]/30 pt-2 mt-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[#543847] text-sm font-semibold">TOTAL</span>
                                        <span className="text-2xl font-bold text-[#543847]">{animTotal}</span>
                                    </div>
                                </div>
                                {/* Best */}
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-[#543847]/70 text-sm">BEST</span>
                                    <span className="text-lg font-bold text-[#543847]">{highScore}</span>
                                </div>

                                {totalScore >= highScore && totalScore > 0 && (
                                    <div className="mt-2 text-center">
                                        <span className="inline-block px-2 py-1 bg-[#FFD700] rounded text-[#543847] text-xs font-bold animate-pulse">
                                            NEW BEST!
                                        </span>
                                    </div>
                                )}

                                {/* Achievement unlocked */}
                                {justUnlocked20 && (
                                    <div className="mt-3 p-2 bg-[#FFD700]/30 rounded-lg border-2 border-[#FFD700] achievement-glow text-center">
                                        <p className="text-xs font-bold text-[#543847]">
                                            🏅 SUCCÈS DÉBLOQUÉ !
                                        </p>
                                        <p className="text-xs text-[#543847]/70">Score de 20 points</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={onStart}
                                    className="px-8 py-3 bg-[#5DBE4A] hover:bg-[#4CAF3A] text-white font-bold rounded-lg transition-all border-b-4 border-[#3D8B32] active:border-b-0 active:mt-1"
                                >
                                    PLAY AGAIN
                                </button>

                                <button
                                    onClick={onToggleStats}
                                    className="px-4 py-1.5 bg-[#543847]/20 hover:bg-[#543847]/30 text-[#543847] text-sm font-bold rounded-lg transition-all"
                                >
                                    Stats
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
