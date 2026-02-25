'use client';

import { useState, useEffect, useRef } from 'react';
import { GameStats } from './StatsManager';
import { LeaderboardEntry, getTop30, getPseudo, checkPseudoAvailable } from './LeaderboardManager';

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
    pseudo: string | null;
    onSetPseudo: (pseudo: string) => void;
    showLeaderboard: boolean;
    onToggleLeaderboard: () => void;
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

        startTime.current = null;
        const animate = (time: number) => {
            if (startTime.current === null) startTime.current = time;
            const elapsed = time - startTime.current;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out quad
            const eased = 1 - (1 - progress) * (1 - progress);
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
    pseudo, onSetPseudo, showLeaderboard, onToggleLeaderboard,
}: GameOverlayProps) {
    if (gameState === 'PLAYING') return null;

    const isGameOver = gameState === 'GAME_OVER';
    const totalScore = pipeScore + coinScore;

    // Count-up animations (only on game over)
    const animPipe = useCountUp(pipeScore, 600, isGameOver);
    const animCoin = useCountUp(coinScore, 600, isGameOver);
    const animTotal = useCountUp(totalScore, 900, isGameOver);

    // Check if achievement just unlocked this game
    const justUnlocked20 = isGameOver && totalScore >= 10 && stats && stats.achievement20;

    // Pseudo input state
    const [pseudoInput, setPseudoInput] = useState('');
    const [pseudoError, setPseudoError] = useState('');
    const [checkingPseudo, setCheckingPseudo] = useState(false);

    // Leaderboard state
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loadingLb, setLoadingLb] = useState(false);

    // Load leaderboard when shown
    useEffect(() => {
        if (showLeaderboard) {
            setLoadingLb(true);
            getTop30().then(entries => {
                setLeaderboard(entries);
                setLoadingLb(false);
            });
        }
    }, [showLeaderboard]);

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

    // ========================================
    // PSEUDO MODAL (first launch, no pseudo)
    // ========================================
    const handlePseudoSubmit = async () => {
        const trimmed = pseudoInput.trim();
        if (trimmed.length < 1) return;

        setPseudoError('');
        setCheckingPseudo(true);

        const available = await checkPseudoAvailable(trimmed);
        setCheckingPseudo(false);

        if (!available) {
            setPseudoError('This name is already taken!');
            return;
        }

        onSetPseudo(trimmed);
    };

    if (!pseudo) {
        return (
            <>
                {animStyles}
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/40 backdrop-blur-sm">
                    <div className="bg-[#DED895] rounded-xl p-4 sm:p-6 mx-4 text-center border-4 border-[#543847] shadow-lg max-w-xs w-full pop-in">
                        <h2 className="text-xl sm:text-2xl font-bold mb-2 text-[#543847]">Choose your name ✏️</h2>
                        <p className="text-[#543847]/70 text-xs mb-4">Shown on the leaderboard</p>

                        <input
                            type="text"
                            value={pseudoInput}
                            onChange={(e) => {
                                setPseudoInput(e.target.value.slice(0, 15));
                                setPseudoError('');
                            }}
                            placeholder="Your name..."
                            maxLength={15}
                            className={`w-full px-4 py-3 rounded-lg bg-white/80 border-2 ${pseudoError ? 'border-red-500' : 'border-[#543847]/30'} text-[#543847] font-bold text-center text-lg outline-none focus:border-[#5DBE4A] transition-colors mb-1`}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handlePseudoSubmit();
                            }}
                        />
                        {pseudoError ? (
                            <p className="text-red-600 text-xs font-bold mb-3">{pseudoError}</p>
                        ) : (
                            <p className="text-[#543847]/50 text-xs mb-4">{pseudoInput.length}/15</p>
                        )}

                        <button
                            onClick={handlePseudoSubmit}
                            disabled={pseudoInput.trim().length < 1 || checkingPseudo}
                            className="px-8 py-3 bg-[#5DBE4A] hover:bg-[#4CAF3A] disabled:bg-gray-400 text-white font-bold rounded-lg transition-all border-b-4 border-[#3D8B32] disabled:border-gray-500 active:border-b-0 active:mt-1 w-full"
                        >
                            {checkingPseudo ? 'Checking...' : "LET'S GO!"}
                        </button>
                    </div>
                </div>
            </>
        );
    }

    // ========================================
    // LEADERBOARD MODAL (top 30)
    // ========================================
    if (showLeaderboard) {
        const currentPseudo = getPseudo();
        return (
            <>
                {animStyles}
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/40 backdrop-blur-sm">
                    <div className="bg-[#DED895] rounded-xl p-4 sm:p-5 mx-4 text-center border-4 border-[#543847] shadow-lg max-w-xs w-full pop-in">
                        <h2 className="text-xl sm:text-2xl font-bold mb-3 text-[#543847]">🏆 TOP 30</h2>

                        <div className="bg-[#C4A86B] rounded-lg p-2 mb-3 max-h-[55vh] overflow-y-auto">
                            {loadingLb ? (
                                <p className="text-[#543847]/70 text-sm py-4">Loading...</p>
                            ) : leaderboard.length === 0 ? (
                                <p className="text-[#543847]/70 text-sm py-4">No scores yet!</p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-[#543847]/60 text-xs">
                                            <th className="text-left py-1 pl-2">#</th>
                                            <th className="text-left py-1">Player</th>
                                            <th className="text-right py-1 pr-2">Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaderboard.map((entry, i) => {
                                            const isMe = currentPseudo && entry.pseudo.toLowerCase() === currentPseudo.toLowerCase();
                                            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
                                            return (
                                                <tr
                                                    key={i}
                                                    className={`border-t border-[#543847]/10 ${isMe ? 'bg-[#FFD700]/30 font-bold' : ''}`}
                                                >
                                                    <td className="text-left py-1.5 pl-2">{medal}</td>
                                                    <td className={`text-left py-1.5 ${isMe ? 'text-[#543847]' : 'text-[#543847]/80'}`}>
                                                        {entry.pseudo}
                                                        {isMe && <span className="ml-1 text-xs">👈</span>}
                                                    </td>
                                                    <td className="text-right py-1.5 pr-2 font-bold text-[#543847]">{entry.score}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <button
                            onClick={onToggleLeaderboard}
                            className="px-6 py-2 bg-[#5DBE4A] hover:bg-[#4CAF3A] text-white font-bold rounded-lg transition-all border-b-4 border-[#3D8B32] active:border-b-0 active:mt-1 w-full"
                        >
                            BACK
                        </button>
                    </div>
                </div>
            </>
        );
    }

    // ========================================
    // STATS MODAL
    // ========================================
    if (showStats && stats) {
        return (
            <>
                {animStyles}
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/40 backdrop-blur-sm">
                    <div className="bg-[#DED895] rounded-xl p-4 sm:p-5 mx-4 text-center border-4 border-[#543847] shadow-lg max-w-xs w-full pop-in">
                        <h2 className="text-xl sm:text-2xl font-bold mb-3 text-[#543847]">STATISTICS</h2>

                        <div className="bg-[#C4A86B] rounded-lg p-2 sm:p-3 mb-3 text-left space-y-2">
                            {/* Games played */}
                            <div className="flex justify-between items-center">
                                <span className="text-[#543847]/70 text-sm">Games</span>
                                <span className="font-bold text-[#543847]">{stats.totalGames}</span>
                            </div>
                            {/* Bests */}
                            <div className="flex justify-between items-center">
                                <span className="text-[#543847]/70 text-sm">🚀 Best run</span>
                                <span className="font-bold text-[#543847]">{stats.bestPipes}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[#543847]/70 text-sm flex items-center gap-1">
                                    <img src="/sprites/coin.png" alt="" className="w-6 h-6 sm:w-8 sm:h-8 coin-spin" style={{ imageRendering: 'pixelated' }} />
                                    Best coins
                                </span>
                                <span className="font-bold text-yellow-700">{stats.bestCoins}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[#543847]/70 text-sm">⭐ Best total</span>
                                <span className="font-bold text-[#543847] text-lg">{stats.bestTotal}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[#543847]/70 text-sm">🔥 Best combo</span>
                                <span className="font-bold text-orange-600">{stats.bestCombo}</span>
                            </div>

                            {/* Lifetime totals */}
                            <div className="flex justify-between items-center">
                                <span className="text-[#543847]/70 text-sm flex items-center gap-1">
                                    <img src="/sprites/coin.png" alt="" className="w-6 h-6 sm:w-8 sm:h-8 coin-spin" style={{ imageRendering: 'pixelated' }} />
                                    Coins collected
                                </span>
                                <span className="font-bold text-yellow-700">{stats.totalCoinScore}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[#543847]/70 text-sm flex items-center gap-1">
                                    <img src="/sprites/diamond.png" alt="" className="w-6 h-6 sm:w-8 sm:h-8 diamond-pulse" style={{ imageRendering: 'pixelated' }} />
                                    Diamonds
                                </span>
                                <span className="font-bold text-cyan-600">{stats.totalDiamonds}</span>
                            </div>

                            {/* Achievement */}
                            {stats.achievement20 && (
                                <div className="mt-2 p-2 bg-[#FFD700]/20 rounded-lg text-center border border-[#FFD700]/40">
                                    <p className="text-xs font-bold text-[#543847] mb-2">🏅 10 pts reached</p>
                                    <a
                                        href="https://partiful.com/e/IKS6tattg5ONtlDHicWh?c=DKdOEiWC"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-block px-4 py-1.5 bg-[#543847] text-white text-xs font-bold rounded-lg hover:bg-[#6b4d5c] transition-all"
                                    >
                                        🎉 WELCOME TO MOSKIFEST
                                    </a>
                                </div>
                            )}
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
                                Reset stats
                            </button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // ========================================
    // START / GAME OVER screens
    // ========================================
    return (
        <>
            {animStyles}
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/40 backdrop-blur-sm">
                <div className="bg-[#DED895] rounded-xl p-4 sm:p-6 mx-4 text-center border-4 border-[#543847] shadow-lg max-w-xs w-full pop-in">
                    {gameState === 'START' ? (
                        <>
                            <h1
                                className="text-3xl sm:text-4xl font-bold mb-2 text-[#543847]"
                                style={{ fontFamily: 'system-ui, sans-serif' }}
                            >
                                MOSKI FLY
                            </h1>
                            <p className="text-[#543847]/70 mb-4 text-sm">
                                Tap or press Space to fly!
                            </p>

                            <div className="mb-4">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto animate-bounce">
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

                            <p className="text-[#543847]/60 text-sm mt-3">
                                Best: <span className="font-bold text-[#543847]">{highScore}</span>
                            </p>

                            {/* Bottom row: Stats + Leaderboard */}
                            <div className="flex gap-2 mt-3 justify-center">
                                <button
                                    onClick={onToggleStats}
                                    className="px-4 py-1.5 bg-[#543847]/20 hover:bg-[#543847]/30 text-[#543847] text-sm font-bold rounded-lg transition-all"
                                >
                                    Stats
                                </button>
                                <button
                                    onClick={onToggleLeaderboard}
                                    className="px-4 py-1.5 bg-[#FFD700]/40 hover:bg-[#FFD700]/60 text-[#543847] text-sm font-bold rounded-lg transition-all"
                                >
                                    🏆 Top 30
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <h2 className="text-2xl sm:text-3xl font-bold mb-3 text-[#543847]">
                                GAME OVER
                            </h2>

                            <div className="bg-[#C4A86B] rounded-lg p-3 sm:p-4 mb-4">
                                {/* Pipe Score */}
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[#543847]/70 text-sm flex items-center gap-1">
                                        🚀 RUN
                                    </span>
                                    <span className="text-xl font-bold text-[#543847]">{animPipe}</span>
                                </div>
                                {/* Coin Score */}
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[#543847]/70 text-sm flex items-center gap-1">
                                        <img src="/sprites/coin.png" alt="" className="w-6 h-6 sm:w-8 sm:h-8 coin-spin" style={{ imageRendering: 'pixelated' }} />
                                        COINS
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
                                            🏅 ACHIEVEMENT UNLOCKED!
                                        </p>
                                        <p className="text-xs text-[#543847]/70 mb-2">10 points reached</p>
                                        <a
                                            href="https://partiful.com/e/IKS6tattg5ONtlDHicWh?c=DKdOEiWC"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-block px-4 py-1.5 bg-[#543847] text-white text-xs font-bold rounded-lg hover:bg-[#6b4d5c] transition-all"
                                        >
                                            🎉 Accéder à Moskifest
                                        </a>
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

                                <div className="flex gap-2 justify-center">
                                    <button
                                        onClick={onToggleStats}
                                        className="px-4 py-1.5 bg-[#543847]/20 hover:bg-[#543847]/30 text-[#543847] text-sm font-bold rounded-lg transition-all"
                                    >
                                        Stats
                                    </button>
                                    <button
                                        onClick={onToggleLeaderboard}
                                        className="px-4 py-1.5 bg-[#FFD700]/40 hover:bg-[#FFD700]/60 text-[#543847] text-sm font-bold rounded-lg transition-all"
                                    >
                                        🏆 Top 30
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
