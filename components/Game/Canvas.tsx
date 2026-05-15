'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useGameLoop } from './useGameLoop';
import {
    DEFAULT_CONFIG,
    GameConfig,
    Player,
    Pipe,
    Coin,
    CoinType,
    createPlayer,
    applyGravity,
    applyFlap,
    updatePipes,
    checkCollision,
    checkScore,
    createCoinInGap,
    updateCoins,
    checkCoinCollection,
} from './Physics';
import { resumeAudio, playCoinSound, playDiamondSound, playPipeSound, playFlapSound, playGameOverSound, bgMusic } from './SoundManager';
import { loadStats, saveGameResult, resetStats, GameStats } from './StatsManager';
import { getPseudo, savePseudo, submitScore, initAuth } from './LeaderboardManager';
import { FlyingCoin, BgTransition, drawBackground, drawPipes, drawGround, drawCoins, drawPlayer } from './Renderer';
import { getDynamicConfig } from './difficulty';
import DevPanel from './DevPanel';
import GameOverlay from './GameOverlay';

type GameState = 'START' | 'PLAYING' | 'GAME_OVER';

interface CanvasProps {
    devMode?: boolean;
}

export default function Canvas({ devMode = false }: CanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const spritesRef = useRef<HTMLImageElement[]>([]);
    const [canvasSize, setCanvasSize] = useState({ width: 400, height: 711 });

    // Game state
    const [gameState, setGameState] = useState<GameState>('START');
    const [pipeScore, setPipeScore] = useState(0);
    const [coinScore, setCoinScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [coinFlash, setCoinFlash] = useState(false);
    const [coinCombo, setCoinCombo] = useState(0);
    const [showCombo, setShowCombo] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [stats, setStats] = useState<GameStats | null>(null);
    const [showUpdateNote, setShowUpdateNote] = useState(false);
    const [pseudo, setPseudo] = useState<string | null>(null);
    const [showLeaderboard, setShowLeaderboard] = useState(false);

    // Per-game tracking refs
    const diamondsCollectedRef = useRef(0);
    const maxComboRef = useRef(0);
    const coinComboRef = useRef(0);
    const pipeScoreRef = useRef(0);
    const coinScoreRef = useRef(0);

    // Flying coins animation
    const flyingCoinsRef = useRef<FlyingCoin[]>([]);
    
    // Background transition
    const bgTransitionRef = useRef<BgTransition>({ oldTier: 0, currentTier: 0, progress: 0 });

    // Game objects (using refs for real-time updates in animation loop)
    const playerRef = useRef<Player | null>(null);
    const pipesRef = useRef<Pipe[]>([]);
    const coinsRef = useRef<Coin[]>([]);
    const groundOffsetRef = useRef(0);
    const coinSpriteRef = useRef<HTMLImageElement | null>(null);
    const diamondSpriteRef = useRef<HTMLImageElement | null>(null);

    // Load sprites and background
    useEffect(() => {
        const sprites = ['/sprites/v1.png', '/sprites/v2.png', '/sprites/v3.png'];
        sprites.forEach((src, i) => {
            const img = new Image();
            img.src = src;
            spritesRef.current[i] = img;
        });
        // Load coin sprite
        const coinImg = new Image();
        coinImg.src = '/sprites/coin.png';
        coinSpriteRef.current = coinImg;
        // Load diamond sprite
        const diamondImg = new Image();
        diamondImg.src = '/sprites/diamond.png';
        diamondSpriteRef.current = diamondImg;
    }, []);

    // Background images (one per score tier)
    const backgroundsRef = useRef<HTMLImageElement[]>([]);

    useEffect(() => {
        const bgPaths = [
            '/sprites/background.png',         // 0-99: day
            '/sprites/background_sunset.png',   // 100-199: sunset
            '/sprites/background_night.png',    // 200-299: night
            '/sprites/background_cosmic.png',   // 300-399: cosmic
            '/sprites/background_aurora.png',   // 400+: aurora
        ];
        backgroundsRef.current = bgPaths.map(src => {
            const img = new Image();
            img.src = src;
            return img;
        });
    }, []);

    // Handle responsive canvas sizing
    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                const container = containerRef.current;
                // Use exact container dimensions
                const width = container.clientWidth;
                const height = container.clientHeight;

                if (width > 0 && height > 0) {
                    setCanvasSize({ width, height });
                }
            }
        };

        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    // Load stats and pseudo from localStorage on mount
    useEffect(() => {
        const saved = loadStats();
        setStats(saved);
        setHighScore(saved.bestTotal);

        // Load pseudo
        const savedPseudo = getPseudo();
        if (savedPseudo) setPseudo(savedPseudo);

        // Init Firebase Anonymous Auth
        initAuth();

        // Show update note once per version
        const UPDATE_VERSION = 'v1.2';
        const seenVersion = localStorage.getItem('moski_update_seen');
        if (seenVersion !== UPDATE_VERSION) {
            setShowUpdateNote(true);
        }
    }, []);

    // Initialize/reset game
    const resetGame = useCallback(() => {
        playerRef.current = createPlayer(canvasSize.width, canvasSize.height);
        pipesRef.current = [];
        coinsRef.current = [];
        flyingCoinsRef.current = [];
        groundOffsetRef.current = 0;
        diamondsCollectedRef.current = 0;
        maxComboRef.current = 0;
        coinComboRef.current = 0;
        pipeScoreRef.current = 0;
        coinScoreRef.current = 0;
        bgTransitionRef.current = { oldTier: 0, currentTier: 0, progress: 0 };
        setPipeScore(0);
        setCoinScore(0);
        setCoinCombo(0);
        setShowCombo(false);
    }, [canvasSize]);

    // Start game
    const startGame = useCallback(() => {
        resumeAudio();
        resetGame();
        setGameState('PLAYING');
        if (soundEnabled) {
            bgMusic.start();
        }
    }, [resetGame, soundEnabled]);

    // Game over
    const gameOver = useCallback(() => {
        setGameState('GAME_OVER');
        const finalPipeScore = pipeScoreRef.current;
        const finalCoinScore = coinScoreRef.current;
        const updatedStats = saveGameResult(finalPipeScore, finalCoinScore, diamondsCollectedRef.current, maxComboRef.current);
        setStats(updatedStats);
        setHighScore(updatedStats.bestTotal);
        setPipeScore(finalPipeScore);
        setCoinScore(finalCoinScore);
        bgMusic.stop();
        if (soundEnabled) playGameOverSound();

        // Submit to leaderboard
        const currentPseudo = getPseudo();
        const totalScore = finalPipeScore + finalCoinScore;
        if (currentPseudo && totalScore > 0) {
            submitScore(currentPseudo, totalScore);
        }
    }, [soundEnabled]);

    // Handle input
    const handleFlap = useCallback(() => {
        if (gameState === 'START') {
            startGame();
        } else if (gameState === 'PLAYING' && playerRef.current) {
            const currentConfig = getDynamicConfig(config, pipeScoreRef.current);
            playerRef.current = applyFlap(playerRef.current, currentConfig);
            if (soundEnabled) playFlapSound();
        } else if (gameState === 'GAME_OVER') {
            startGame();
        }
    }, [gameState, startGame, config]);

    // Keyboard input
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore keyboard when typing in an input or modal is open
            if (!pseudo || showStats || showLeaderboard) return;
            if (e.target instanceof HTMLInputElement) return;

            if (e.code === 'Space' || e.code === 'ArrowUp') {
                e.preventDefault();
                handleFlap();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleFlap, pseudo, showStats, showLeaderboard]);

    // Game loop update
    const updateGame = useCallback((deltaTime: number) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !playerRef.current) return;

        const { width, height } = canvas;

        // Calculate dynamic difficulty based on current score
        const currentConfig = getDynamicConfig(config, pipeScoreRef.current);

        // Update ground scroll
        groundOffsetRef.current = (groundOffsetRef.current + currentConfig.pipeSpeed * (deltaTime / 16.67)) % 48;

        // Update player physics
        playerRef.current = applyGravity(playerRef.current, currentConfig, deltaTime);

        // Update pipes
        pipesRef.current = updatePipes(pipesRef.current, currentConfig, width, height, deltaTime);

        // Spawn coin in gap when new pipe is added (65% chance)
        const currentLastPipe = pipesRef.current[pipesRef.current.length - 1];
        if (currentLastPipe && currentLastPipe.x >= width - currentConfig.pipeSpeed && Math.random() < 0.65) {
            // Check if this pipe already has a coin nearby
            const hasCoinNearby = coinsRef.current.some(c => Math.abs(c.x - currentLastPipe.x) < 50);
            if (!hasCoinNearby) {
                const newCoin = createCoinInGap(currentLastPipe.x, currentLastPipe.gapY);
                coinsRef.current.push(newCoin);
            }
        }

        // Update coins
        coinsRef.current = updateCoins(coinsRef.current, config, deltaTime);

        // Check coin collection
        const coinResult = checkCoinCollection(playerRef.current, coinsRef.current);
        coinsRef.current = coinResult.coins;
        if (coinResult.collected > 0) {
            // Combo system
            const newCombo = coinComboRef.current + coinResult.collected;
            coinComboRef.current = newCombo;
            setCoinCombo(newCombo);
            maxComboRef.current = Math.max(maxComboRef.current, newCombo);

            // Track diamonds
            const diamondsInBatch = coinResult.collectedCoins.filter(c => c.type === 'rare').length;
            diamondsCollectedRef.current += diamondsInBatch;
            const multiplier = newCombo >= 3 ? 2 : 1;
            const coinAdd = coinResult.totalValue * multiplier;
            coinScoreRef.current += coinAdd;
            setCoinScore(prev => prev + coinAdd);

            // Show combo indicator at 3+
            if (newCombo >= 3) {
                setShowCombo(true);
                setTimeout(() => setShowCombo(false), 800);
            }

            // Sound: diamond vs normal
            if (soundEnabled) {
                const hasRare = coinResult.collectedCoins.some(c => c.type === 'rare');
                if (hasRare) playDiamondSound();
                else playCoinSound();
            }

            // Flash effect
            setCoinFlash(true);
            setTimeout(() => setCoinFlash(false), 300);

            // Spawn flying coins toward HUD
            coinResult.collectedCoins.forEach(cc => {
                flyingCoinsRef.current.push({
                    x: cc.x,
                    y: cc.y,
                    startX: cc.x,
                    startY: cc.y,
                    progress: 0,
                    type: cc.type,
                });
            });
        }

        // Update flying coins
        flyingCoinsRef.current = flyingCoinsRef.current
            .map(fc => ({ ...fc, progress: fc.progress + deltaTime * 0.003 }))
            .filter(fc => fc.progress < 1);

        // Check collision
        if (checkCollision(playerRef.current, pipesRef.current, currentConfig, height)) {
            gameOver();
            return;
        }

        // Check score (passing pipe)
        const scoreResult = checkScore(playerRef.current, pipesRef.current);
        pipesRef.current = scoreResult.pipes;
        if (scoreResult.scored) {
            pipeScoreRef.current += 1;
            setPipeScore(prev => prev + 1);
            if (soundEnabled) playPipeSound();
        }

        // Render
        render(ctx, width, height, currentConfig, deltaTime);
    }, [config, gameOver]);

    // Render function - Classic Flappy Bird Style
    const render = (ctx: CanvasRenderingContext2D, width: number, height: number, currentConfig: GameConfig, deltaTime?: number) => {
        const groundHeight = 80;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Select and draw background based on score tier with smooth transition
        const currentTotal = pipeScoreRef.current + coinScoreRef.current;
        const targetTier = Math.floor(currentTotal / 100);

        if (targetTier > bgTransitionRef.current.currentTier && bgTransitionRef.current.progress === 0) {
            bgTransitionRef.current.oldTier = bgTransitionRef.current.currentTier;
            bgTransitionRef.current.currentTier = targetTier;
            bgTransitionRef.current.progress = 0.01; // Start transition
        }

        if (bgTransitionRef.current.progress > 0) {
            // 2 seconds transition (deltaTime is ~16.67ms, so 16.67 * 0.0005 ≈ 0.008 per frame)
            bgTransitionRef.current.progress += (deltaTime || 16.67) * 0.0005;
            if (bgTransitionRef.current.progress >= 1) {
                bgTransitionRef.current.progress = 0;
            }
        }

        drawBackground(ctx, backgroundsRef.current, width, height, bgTransitionRef.current);

        // Draw pipes
        drawPipes(ctx, pipesRef.current, currentConfig, width, height, groundHeight);

        // Draw coins
        drawCoins(ctx, coinsRef.current, flyingCoinsRef.current, coinSpriteRef.current, diamondSpriteRef.current, animTimeRef.current);

        // Draw scrolling ground
        drawGround(ctx, width, height, groundHeight, groundOffsetRef.current);

        // Draw player
        if (playerRef.current) {
            drawPlayer(ctx, playerRef.current, spritesRef.current);
        }
    };

    // Time ref for animations (avoids hydration issues with Date.now())
    const animTimeRef = useRef(0);

    // Idle animation/render when not playing
    const idleUpdate = useCallback((deltaTime: number) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const { width, height } = canvas;

        // Update animation time
        animTimeRef.current += deltaTime;
        const time = animTimeRef.current;

        // Slow ground scroll
        groundOffsetRef.current = (groundOffsetRef.current + 0.5) % 48;

        // Floating animation for player
        if (!playerRef.current) {
            playerRef.current = createPlayer(width, height);
        }
        const floatY = Math.sin(time / 500) * 10;
        playerRef.current.y = height * 0.4 + floatY;
        playerRef.current.rotation = Math.sin(time / 800) * 5;
        playerRef.current.velocity = Math.sin(time / 300) * 5;

        const currentConfig = getDynamicConfig(config, pipeScoreRef.current);
        render(ctx, width, height, currentConfig, deltaTime);
    }, [config]);

    useGameLoop({
        onUpdate: gameState === 'PLAYING' ? updateGame : idleUpdate,
        isRunning: true,
    });

    return (
        <div className="relative w-full h-full bg-[#4EC0CA] flex items-center justify-center overflow-hidden">
            {/* Desktop container wrapper */}
            <div
                ref={containerRef}
                className="relative w-full h-full max-w-[480px] md:max-w-none bg-[#4EC0CA]"
            >
                <div className="absolute inset-0 w-full h-full">
                    <canvas
                        ref={canvasRef}
                        width={canvasSize.width}
                        height={canvasSize.height}
                        onPointerDown={(e) => {
                            e.preventDefault();
                            handleFlap();
                        }}
                        className="block touch-none select-none outline-none"
                        style={{
                            width: '100%',
                            height: '100%',
                            imageRendering: 'pixelated',
                        }}
                    />

                    <GameOverlay
                        gameState={gameState}
                        pipeScore={pipeScore}
                        coinScore={coinScore}
                        highScore={highScore}
                        onStart={startGame}
                        stats={stats}
                        showStats={showStats}
                        onToggleStats={() => setShowStats(s => !s)}
                        onResetStats={() => {
                            const fresh = resetStats();
                            setStats(fresh);
                            setHighScore(0);
                            setShowStats(false);
                        }}
                        pseudo={pseudo}
                        onSetPseudo={(p) => {
                            savePseudo(p);
                            setPseudo(p);
                        }}
                        showLeaderboard={showLeaderboard}
                        onToggleLeaderboard={() => setShowLeaderboard(s => !s)}
                    />

                    {/* Update note modal */}
                    {showUpdateNote && gameState === 'START' && (
                        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/50 backdrop-blur-sm">
                            <div className="bg-[#DED895] rounded-xl p-4 sm:p-5 mx-4 text-center border-4 border-[#543847] shadow-lg max-w-xs w-full"
                                style={{ animation: 'pop-in 0.4s ease-out forwards' }}>
                                <h2 className="text-xl font-bold mb-2 text-[#543847]">What&apos;s new? 🎉</h2>
                                <p className="text-xs text-[#543847]/60 mb-3">v1.2</p>

                                <div className="bg-[#C4A86B] rounded-lg p-3 mb-4 text-left space-y-2 text-sm text-[#543847]">
                                    <p className="font-semibold">New features:</p>
                                    <ul className="list-disc list-inside space-y-1 text-[#543847]/80 text-xs">
                                        <li>🌅 New worlds every 100 pts!</li>
                                        <li>🔥 Combos now work even better</li>
                                        <li>🏆 Leaderboard scores always up to date</li>
                                        <li>🏅 Fresh leaderboard — everyone restarts!</li>
                                        <li>⚡ Dynamic difficulty: the further you go, the harder it gets!</li>
                                    </ul>
                                </div>

                                <button
                                    onClick={() => {
                                        setShowUpdateNote(false);
                                        localStorage.setItem('moski_update_seen', 'v1.2');
                                    }}
                                    className="px-8 py-3 bg-[#5DBE4A] hover:bg-[#4CAF3A] text-white font-bold rounded-lg transition-all border-b-4 border-[#3D8B32] active:border-b-0 active:mt-1 w-full"
                                >
                                    LET&apos;S GO!
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Score HUD during gameplay */}
                    {gameState === 'PLAYING' && (
                        <div className="absolute left-0 right-0 z-10 pointer-events-none select-none px-3 sm:px-4" style={{ top: 'max(1.5rem, env(safe-area-inset-top, 2rem))' }}>
                            <div className="flex justify-between items-start max-w-[480px] mx-auto">
                                {/* Pipe Score (left) */}
                                <div className="flex items-center gap-1 sm:gap-2">
                                    <span className="text-lg sm:text-2xl">🚀</span>
                                    <span
                                        className="text-2xl sm:text-4xl font-bold text-white font-mono"
                                        style={{
                                            textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000',
                                        }}
                                    >
                                        {pipeScore}
                                    </span>
                                </div>
                                {/* Coin Score (right) */}
                                <div
                                    className="flex items-center gap-1 sm:gap-2 transition-transform duration-200"
                                    style={{
                                        transform: coinFlash ? 'scale(1.4)' : 'scale(1)',
                                    }}
                                >
                                    <img src="/sprites/coin.png" alt="coin" className="w-8 sm:w-[55px] h-8 sm:h-[55px]" style={{ imageRendering: 'pixelated' }} />
                                    <span
                                        className={`text-2xl sm:text-4xl font-bold font-mono transition-colors duration-200 ${coinFlash ? 'text-white' : 'text-yellow-300'}`}
                                        style={{
                                            textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000',
                                        }}
                                    >
                                        {coinScore}
                                    </span>
                                </div>
                            </div>
                            {/* Combo indicator */}
                            {showCombo && coinCombo >= 3 && (
                                <div className="flex justify-center mt-2 animate-bounce">
                                    <span
                                        className="text-base sm:text-xl font-bold text-orange-400 font-mono"
                                        style={{
                                            textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
                                        }}
                                    >
                                        🔥 COMBO x{coinCombo}! ×2
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Sound Toggle Button */}
                    {gameState !== 'START' && (
                        <button
                            onClick={() => {
                                const newVal = !soundEnabled;
                                setSoundEnabled(newVal);
                                if (newVal && gameState === 'PLAYING') {
                                    bgMusic.start();
                                } else {
                                    bgMusic.stop();
                                }
                            }}
                            className="absolute bottom-4 right-4 z-50 w-10 h-10 flex items-center justify-center bg-black/40 rounded-full text-xl hover:bg-black/60 transition-colors"
                        >
                            {soundEnabled ? '🔊' : '🔇'}
                        </button>
                    )}
                </div>

                {devMode && (
                    <DevPanel
                        config={config}
                        onConfigChange={setConfig}
                    />
                )}
            </div>
        </div>
    );
}
