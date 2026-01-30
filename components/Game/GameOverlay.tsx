'use client';

type GameState = 'START' | 'PLAYING' | 'GAME_OVER';

interface GameOverlayProps {
    gameState: GameState;
    score: number;
    highScore: number;
    onStart: () => void;
}

export default function GameOverlay({ gameState, score, highScore, onStart }: GameOverlayProps) {
    if (gameState === 'PLAYING') return null;

    return (
        <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="bg-[#DED895] rounded-xl p-6 mx-4 text-center border-4 border-[#543847] shadow-lg max-w-xs w-full">
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
                            <p className="mt-4 text-sm text-[#543847]/70">
                                Best: <span className="font-bold text-[#543847]">{highScore}</span>
                            </p>
                        )}
                    </>
                ) : (
                    <>
                        <h2 className="text-3xl font-bold mb-3 text-[#543847]">
                            GAME OVER
                        </h2>

                        <div className="bg-[#C4A86B] rounded-lg p-4 mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[#543847]/70 text-sm">SCORE</span>
                                <span className="text-2xl font-bold text-[#543847]">{score}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[#543847]/70 text-sm">BEST</span>
                                <span className="text-2xl font-bold text-[#543847]">{highScore}</span>
                            </div>

                            {score >= highScore && score > 0 && (
                                <div className="mt-2 text-center">
                                    <span className="inline-block px-2 py-1 bg-[#FFD700] rounded text-[#543847] text-xs font-bold">
                                        🏆 NEW BEST!
                                    </span>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={onStart}
                            className="px-8 py-3 bg-[#5DBE4A] hover:bg-[#4CAF3A] text-white font-bold rounded-lg transition-all border-b-4 border-[#3D8B32] active:border-b-0 active:mt-1"
                        >
                            PLAY AGAIN
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
