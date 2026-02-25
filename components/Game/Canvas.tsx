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
    getAnimationFrame,
    createCoinInGap,
    updateCoins,
    checkCoinCollection,
} from './Physics';
import { resumeAudio, playCoinSound, playDiamondSound, playPipeSound, playFlapSound, playGameOverSound, bgMusic } from './SoundManager';
import { loadStats, saveGameResult, resetStats, GameStats } from './StatsManager';
import { getPseudo, savePseudo, submitScore, initAuth } from './LeaderboardManager';
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

    // Flying coins animation
    interface FlyingCoin {
        x: number;
        y: number;
        startX: number;
        startY: number;
        progress: number;
        type: CoinType;
    }
    const flyingCoinsRef = useRef<FlyingCoin[]>([]);

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

    // Background image ref
    const backgroundRef = useRef<HTMLImageElement | null>(null);

    useEffect(() => {
        const bg = new Image();
        bg.src = '/sprites/background.png';
        backgroundRef.current = bg;
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
        const UPDATE_VERSION = 'v1.1';
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
        const updatedStats = saveGameResult(pipeScore, coinScore, diamondsCollectedRef.current, maxComboRef.current);
        setStats(updatedStats);
        setHighScore(updatedStats.bestTotal);
        bgMusic.stop();
        if (soundEnabled) playGameOverSound();

        // Submit to leaderboard
        const currentPseudo = getPseudo();
        const totalScore = pipeScore + coinScore;
        if (currentPseudo && totalScore > 0) {
            submitScore(currentPseudo, totalScore);
        }
    }, [pipeScore, coinScore, soundEnabled]);

    // Handle input
    const handleFlap = useCallback(() => {
        if (gameState === 'START') {
            startGame();
            if (playerRef.current) {
                playerRef.current = applyFlap(playerRef.current, config);
            }
        } else if (gameState === 'PLAYING' && playerRef.current) {
            playerRef.current = applyFlap(playerRef.current, config);
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

        // Update ground scroll
        groundOffsetRef.current = (groundOffsetRef.current + config.pipeSpeed * (deltaTime / 16.67)) % 48;

        // Update player physics
        playerRef.current = applyGravity(playerRef.current, config, deltaTime);

        // Update pipes
        pipesRef.current = updatePipes(pipesRef.current, config, width, height, deltaTime);

        // Spawn coin in gap when new pipe is added (65% chance)
        const currentLastPipe = pipesRef.current[pipesRef.current.length - 1];
        if (currentLastPipe && currentLastPipe.x >= width - config.pipeSpeed && Math.random() < 0.65) {
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
            const newCombo = coinCombo + coinResult.collected;
            setCoinCombo(newCombo);
            maxComboRef.current = Math.max(maxComboRef.current, newCombo);

            // Track diamonds
            const diamondsInBatch = coinResult.collectedCoins.filter(c => c.type === 'rare').length;
            diamondsCollectedRef.current += diamondsInBatch;
            const multiplier = newCombo >= 3 ? 2 : 1;
            setCoinScore(prev => prev + coinResult.totalValue * multiplier);

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
        if (checkCollision(playerRef.current, pipesRef.current, config, height)) {
            gameOver();
            return;
        }

        // Check score (passing pipe)
        const scoreResult = checkScore(playerRef.current, pipesRef.current);
        pipesRef.current = scoreResult.pipes;
        if (scoreResult.scored) {
            setPipeScore(prev => prev + 1);
            if (soundEnabled) playPipeSound();
        }

        // Render
        render(ctx, width, height, deltaTime);
    }, [config, gameOver]);

    // Render function - Classic Flappy Bird Style
    const render = (ctx: CanvasRenderingContext2D, width: number, height: number, deltaTime?: number) => {
        const groundHeight = 80;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw background image (cover mode - no stretching)
        const bg = backgroundRef.current;
        if (bg && bg.complete) {
            ctx.imageSmoothingEnabled = false;

            // Cover mode: scale to fill canvas while preserving aspect ratio
            const bgRatio = bg.naturalWidth / bg.naturalHeight;
            const canvasRatio = width / height;
            let sx = 0, sy = 0, sw = bg.naturalWidth, sh = bg.naturalHeight;

            if (canvasRatio > bgRatio) {
                // Canvas is wider than image — crop top/bottom
                const visibleHeight = bg.naturalWidth / canvasRatio;
                sy = (bg.naturalHeight - visibleHeight) / 2;
                sh = visibleHeight;
            } else {
                // Canvas is taller than image — crop left/right
                const visibleWidth = bg.naturalHeight * canvasRatio;
                sx = (bg.naturalWidth - visibleWidth) / 2;
                sw = visibleWidth;
            }

            ctx.drawImage(bg, sx, sy, sw, sh, 0, 0, width, height);
        } else {
            // Fallback solid color while loading
            ctx.fillStyle = '#87CEEB';
            ctx.fillRect(0, 0, width, height);
        }

        // Draw pipes
        drawPipes(ctx, width, height, groundHeight);

        // Draw coins
        drawCoins(ctx);

        // Draw scrolling ground (restored!)
        drawGround(ctx, width, height, groundHeight);

        // Draw player
        if (playerRef.current) {
            drawPlayer(ctx, playerRef.current);
        }
    };

    // Draw static clouds
    const drawClouds = (ctx: CanvasRenderingContext2D, width: number) => {
        // Static cloud positions
        const clouds = [
            { x: 40, y: 70, scale: 1.0 },
            { x: 180, y: 45, scale: 0.8 },
            { x: 300, y: 90, scale: 1.2 },
            { x: 120, y: 130, scale: 0.6 },
            { x: 260, y: 55, scale: 0.7 },
        ];

        for (const cloud of clouds) {
            drawCloud(ctx, cloud.x, cloud.y, 28 * cloud.scale);
        }
    };

    // Draw a single fluffy cloud
    const drawCloud = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
        ctx.fillStyle = '#ffffff';

        // Fluffy cloud shape with multiple overlapping circles
        ctx.beginPath();
        ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
        ctx.arc(x + size * 0.35, y - size * 0.2, size * 0.4, 0, Math.PI * 2);
        ctx.arc(x + size * 0.7, y - size * 0.1, size * 0.45, 0, Math.PI * 2);
        ctx.arc(x + size * 1.0, y, size * 0.4, 0, Math.PI * 2);
        ctx.arc(x + size * 0.5, y + size * 0.1, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
    };

    // Draw distant hills for depth
    const drawDistantHills = (ctx: CanvasRenderingContext2D, width: number, groundY: number) => {
        // Far hills - light green
        ctx.fillStyle = '#90C695';
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(0, groundY - 40);
        ctx.quadraticCurveTo(60, groundY - 70, 120, groundY - 35);
        ctx.quadraticCurveTo(180, groundY - 55, 240, groundY - 30);
        ctx.quadraticCurveTo(300, groundY - 60, 360, groundY - 25);
        ctx.quadraticCurveTo(400, groundY - 45, width, groundY - 30);
        ctx.lineTo(width, groundY);
        ctx.closePath();
        ctx.fill();

        // Near hills - darker green
        ctx.fillStyle = '#6B8E6B';
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(0, groundY - 25);
        ctx.quadraticCurveTo(80, groundY - 45, 150, groundY - 20);
        ctx.quadraticCurveTo(220, groundY - 38, 280, groundY - 15);
        ctx.quadraticCurveTo(340, groundY - 35, width, groundY - 18);
        ctx.lineTo(width, groundY);
        ctx.closePath();
        ctx.fill();
    };

    const drawPipes = (ctx: CanvasRenderingContext2D, width: number, height: number, groundHeight: number) => {
        for (const pipe of pipesRef.current) {
            const gapTop = pipe.gapY - config.pipeGap / 2;
            const gapBottom = pipe.gapY + config.pipeGap / 2;
            const pipeWidth = config.pipeWidth;
            const capHeight = 26;
            const capOverhang = 6;

            // Pipe colors - classic green
            const pipeBodyColor = '#73BF2E';
            const pipeBodyDark = '#558B2F';
            const pipeBodyLight = '#8BC34A';
            const pipeCapColor = '#73BF2E';
            const pipeCapDark = '#558B2F';

            // TOP PIPE
            // Main body
            ctx.fillStyle = pipeBodyColor;
            ctx.fillRect(pipe.x, 0, pipeWidth, gapTop - capHeight);

            // Left shadow
            ctx.fillStyle = pipeBodyDark;
            ctx.fillRect(pipe.x, 0, 4, gapTop - capHeight);

            // Right highlight
            ctx.fillStyle = pipeBodyLight;
            ctx.fillRect(pipe.x + pipeWidth - 8, 0, 4, gapTop - capHeight);

            // Top pipe cap
            ctx.fillStyle = pipeCapColor;
            ctx.fillRect(pipe.x - capOverhang, gapTop - capHeight, pipeWidth + capOverhang * 2, capHeight);

            // Cap shadow
            ctx.fillStyle = pipeCapDark;
            ctx.fillRect(pipe.x - capOverhang, gapTop - capHeight, 4, capHeight);

            // Cap highlight
            ctx.fillStyle = pipeBodyLight;
            ctx.fillRect(pipe.x + pipeWidth + capOverhang - 8, gapTop - capHeight, 4, capHeight);

            // Cap border
            ctx.strokeStyle = '#2E7D32';
            ctx.lineWidth = 2;
            ctx.strokeRect(pipe.x - capOverhang, gapTop - capHeight, pipeWidth + capOverhang * 2, capHeight);

            // BOTTOM PIPE
            // Main body
            ctx.fillStyle = pipeBodyColor;
            ctx.fillRect(pipe.x, gapBottom + capHeight, pipeWidth, height - gapBottom - groundHeight - capHeight);

            // Left shadow
            ctx.fillStyle = pipeBodyDark;
            ctx.fillRect(pipe.x, gapBottom + capHeight, 4, height - gapBottom - groundHeight - capHeight);

            // Right highlight
            ctx.fillStyle = pipeBodyLight;
            ctx.fillRect(pipe.x + pipeWidth - 8, gapBottom + capHeight, 4, height - gapBottom - groundHeight - capHeight);

            // Bottom pipe cap
            ctx.fillStyle = pipeCapColor;
            ctx.fillRect(pipe.x - capOverhang, gapBottom, pipeWidth + capOverhang * 2, capHeight);

            // Cap shadow
            ctx.fillStyle = pipeCapDark;
            ctx.fillRect(pipe.x - capOverhang, gapBottom, 4, capHeight);

            // Cap highlight
            ctx.fillStyle = pipeBodyLight;
            ctx.fillRect(pipe.x + pipeWidth + capOverhang - 8, gapBottom, 4, capHeight);

            // Cap border
            ctx.strokeStyle = '#2E7D32';
            ctx.lineWidth = 2;
            ctx.strokeRect(pipe.x - capOverhang, gapBottom, pipeWidth + capOverhang * 2, capHeight);
        }
    };

    const drawGround = (ctx: CanvasRenderingContext2D, width: number, height: number, groundHeight: number) => {
        const y = height - groundHeight;

        // Ground base - dirt brown from background image
        ctx.fillStyle = '#E5B083'; // Light brownish/tan
        ctx.fillRect(0, y, width, groundHeight);

        // Grass strip on top - matching the hills
        ctx.fillStyle = '#6BAE5C'; // Green
        ctx.fillRect(0, y, width, 18);

        // Grass highlight - lighter green
        ctx.fillStyle = '#88D56F';
        ctx.fillRect(0, y, width, 6);

        // Dirt detailed pattern - scrolling
        ctx.fillStyle = '#C48E66'; // Darker brown for details
        const offset = groundOffsetRef.current;
        // Increase loop range to cover the max offset (48px = 2 tiles) plus buffer
        for (let i = -1; i < Math.ceil(width / 24) + 3; i++) {
            const x = i * 24 - offset;

            // Zig-zag / checker pattern for dirt
            ctx.fillRect(x, y + 25, 4, 4);
            ctx.fillRect(x + 12, y + 25, 4, 4);

            ctx.fillRect(x + 6, y + 35, 4, 4);
            ctx.fillRect(x + 18, y + 35, 4, 4);

            ctx.fillRect(x, y + 45, 4, 4);
            ctx.fillRect(x + 12, y + 45, 4, 4);

            ctx.fillRect(x + 6, y + 55, 4, 4);
            ctx.fillRect(x + 18, y + 55, 4, 4);

            // Bottom darker area
            ctx.fillStyle = '#A37250';
            ctx.fillRect(x, y + 65, 24, 15);
            ctx.fillStyle = '#C48E66'; // Reset needed if I change fillStyle inside loop
        }
    };

    // Draw coins with bobbing animation
    const drawCoins = (ctx: CanvasRenderingContext2D) => {
        const coinSprite = coinSpriteRef.current;
        const diamondSprite = diamondSpriteRef.current;
        if (!coinSprite || !coinSprite.complete) return;

        const time = animTimeRef.current;
        ctx.imageSmoothingEnabled = false;

        for (const coin of coinsRef.current) {
            if (coin.collected) continue;

            const isRare = coin.type === 'rare';
            const coinSize = isRare ? 90 : 80;
            const sprite = (isRare && diamondSprite?.complete) ? diamondSprite : coinSprite;

            // Bobbing animation
            const bobOffset = Math.sin(time / 200 + coin.x * 0.01) * 6;

            ctx.save();
            ctx.translate(coin.x, coin.y + bobOffset);

            // Pulse scale
            const scale = 1 + Math.sin(time / 150 + coin.x * 0.02) * 0.1;
            ctx.scale(scale, scale);

            // Draw coin with correct sprite
            ctx.drawImage(sprite, -coinSize / 2, -coinSize / 2, coinSize, coinSize);

            ctx.restore();
        }

        // Draw flying coins (collection animation toward HUD)
        for (const fc of flyingCoinsRef.current) {
            const t = fc.progress;
            // Ease-out curve
            const ease = 1 - Math.pow(1 - t, 3);
            // Target: top-right area (coin HUD position)
            const targetX = ctx.canvas.width - 60;
            const targetY = 40;
            const x = fc.startX + (targetX - fc.startX) * ease;
            const y = fc.startY + (targetY - fc.startY) * ease - Math.sin(t * Math.PI) * 50;
            const fSize = 30 * (1 - t * 0.5);
            const alpha = 1 - t;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(x, y);

            if (fc.type === 'rare') {
                ctx.shadowColor = '#00FFFF';
                ctx.shadowBlur = 10;
            } else {
                ctx.shadowColor = '#FFD700';
                ctx.shadowBlur = 8;
            }

            if (fc.type === 'rare' && diamondSprite?.complete) {
                ctx.drawImage(diamondSprite, -fSize / 2, -fSize / 2, fSize, fSize);
            } else if (coinSprite.complete) {
                ctx.drawImage(coinSprite, -fSize / 2, -fSize / 2, fSize, fSize);
            }
            ctx.restore();
        }
    };

    const drawPlayer = (ctx: CanvasRenderingContext2D, player: Player) => {
        const sprite = spritesRef.current[getAnimationFrame(player.velocity)];
        if (!sprite || !sprite.complete) return;

        ctx.save();

        // Move to player center, rotate, then draw centered
        const centerX = player.x + player.width / 2;
        const centerY = player.y + player.height / 2;

        ctx.translate(centerX, centerY);
        ctx.rotate((player.rotation * Math.PI) / 180);

        // Pixelated rendering
        ctx.imageSmoothingEnabled = false;

        // Draw sprite centered
        const drawSize = player.width;
        ctx.drawImage(sprite, -drawSize / 2, -drawSize / 2, drawSize, drawSize);

        ctx.restore();
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

        render(ctx, width, height);
    }, []);

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
                                <p className="text-xs text-[#543847]/60 mb-3">v1.1</p>

                                <div className="bg-[#C4A86B] rounded-lg p-3 mb-4 text-left space-y-2 text-sm text-[#543847]">
                                    <p className="font-semibold">New features:</p>
                                    <ul className="list-disc list-inside space-y-1 text-[#543847]/80 text-xs">
                                        <li>Coins & diamonds to collect</li>
                                        <li>Combo system (x2 at 3+)</li>
                                        <li>Saved statistics</li>
                                        <li>Achievement to unlock (20 pts)</li>
                                        <li>Animations and visual effects</li>
                                    </ul>
                                </div>

                                <button
                                    onClick={() => {
                                        setShowUpdateNote(false);
                                        localStorage.setItem('moski_update_seen', 'v1.1');
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
