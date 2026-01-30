'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useGameLoop } from './useGameLoop';
import {
    DEFAULT_CONFIG,
    GameConfig,
    Player,
    Pipe,
    createPlayer,
    applyGravity,
    applyFlap,
    updatePipes,
    checkCollision,
    checkScore,
    getAnimationFrame,
} from './Physics';
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
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);

    // Game objects (using refs for real-time updates in animation loop)
    const playerRef = useRef<Player | null>(null);
    const pipesRef = useRef<Pipe[]>([]);
    const groundOffsetRef = useRef(0);

    // Load sprites and background
    useEffect(() => {
        const sprites = ['/sprites/v1.png', '/sprites/v2.png', '/sprites/v3.png'];
        sprites.forEach((src, i) => {
            const img = new Image();
            img.src = src;
            spritesRef.current[i] = img;
        });
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
                // Fill the container completely
                let width = container.clientWidth;
                let height = container.clientHeight;

                // Adjust aspect ratio to ensure gameplay area fits but background covers full screen
                // We prioritize filling width on mobile
                const targetRatio = 9 / 16;
                const containerRatio = width / height;

                if (containerRatio > targetRatio) {
                    // Container is wider than target (desktop/tablet landscape)
                    // Limit width to maintain max aspect ratio
                    width = height * targetRatio;
                } else {
                    // Container is taller/narrower (mobile portrait)
                    // Use full width/height provided by container
                    // Game logic will handle physics/rendering within this new size
                    // This removes the fake border/letterboxing
                }

                setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
            }
        };

        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    // Initialize/reset game
    const resetGame = useCallback(() => {
        playerRef.current = createPlayer(canvasSize.width, canvasSize.height);
        pipesRef.current = [];
        groundOffsetRef.current = 0;
        setScore(0);
    }, [canvasSize]);

    // Start game
    const startGame = useCallback(() => {
        resetGame();
        setGameState('PLAYING');
    }, [resetGame]);

    // Game over
    const gameOver = useCallback(() => {
        setGameState('GAME_OVER');
        setHighScore(prev => Math.max(prev, score));
    }, [score]);

    // Handle input
    const handleFlap = useCallback(() => {
        if (gameState === 'START') {
            startGame();
            if (playerRef.current) {
                playerRef.current = applyFlap(playerRef.current, config);
            }
        } else if (gameState === 'PLAYING' && playerRef.current) {
            playerRef.current = applyFlap(playerRef.current, config);
        } else if (gameState === 'GAME_OVER') {
            startGame();
        }
    }, [gameState, startGame, config]);

    // Keyboard input
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                e.preventDefault();
                handleFlap();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleFlap]);

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

        // Check collision
        if (checkCollision(playerRef.current, pipesRef.current, config, height)) {
            gameOver();
            return;
        }

        // Check score
        const scoreResult = checkScore(playerRef.current, pipesRef.current);
        pipesRef.current = scoreResult.pipes;
        if (scoreResult.scored) {
            setScore(prev => prev + 1);
        }

        // Render
        render(ctx, width, height);
    }, [config, gameOver]);

    // Render function - Classic Flappy Bird Style
    const render = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        const groundHeight = 80;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw background image
        const bg = backgroundRef.current;
        if (bg && bg.complete) {
            // Draw the background scaled to fit the canvas, but shifted up slightly to hide its static ground
            // We want the sky/hills part to be visible
            ctx.imageSmoothingEnabled = false;

            // Draw background to cover the whole screen, potentially cropping bottom
            // or just draw it behind everything
            ctx.drawImage(bg, 0, 0, width, height);
        } else {
            // Fallback solid color while loading
            ctx.fillStyle = '#87CEEB';
            ctx.fillRect(0, 0, width, height);
        }

        // Draw pipes
        drawPipes(ctx, width, height, groundHeight);

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
        for (let i = -1; i < Math.ceil(width / 24) + 1; i++) {
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

    // Idle animation/render when not playing
    const idleUpdate = useCallback((deltaTime: number) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const { width, height } = canvas;

        // Slow ground scroll
        groundOffsetRef.current = (groundOffsetRef.current + 0.5) % 48;

        // Floating animation for player
        if (!playerRef.current) {
            playerRef.current = createPlayer(width, height);
        }
        const floatY = Math.sin(Date.now() / 500) * 10;
        playerRef.current.y = height * 0.4 + floatY;
        playerRef.current.rotation = Math.sin(Date.now() / 800) * 5;
        playerRef.current.velocity = Math.sin(Date.now() / 300) * 5;

        render(ctx, width, height);
    }, []);

    useGameLoop({
        onUpdate: gameState === 'PLAYING' ? updateGame : idleUpdate,
        isRunning: true,
    });

    return (
        <div className="relative w-full h-full bg-[#333] flex items-center justify-center overflow-hidden">
            {/* Desktop container wrapper */}
            <div
                ref={containerRef}
                className="relative w-full h-full max-w-[480px] bg-[#4EC0CA] shadow-2xl"
            >
                <div className="absolute inset-0 w-full h-full">
                    <canvas
                        ref={canvasRef}
                        width={canvasSize.width}
                        height={canvasSize.height}
                        onClick={handleFlap}
                        onTouchStart={(e) => {
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
                        score={score}
                        highScore={highScore}
                        onStart={startGame}
                    />

                    {/* Score HUD during gameplay */}
                    {gameState === 'PLAYING' && (
                        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-10 pointer-events-none select-none">
                            <div
                                className="text-6xl font-bold text-white font-mono"
                                style={{
                                    textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000',
                                }}
                            >
                                {score}
                            </div>
                        </div>
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
