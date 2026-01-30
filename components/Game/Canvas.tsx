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

    // Load sprites
    useEffect(() => {
        const sprites = ['/sprites/v1.png', '/sprites/v2.png', '/sprites/v3.png'];
        sprites.forEach((src, i) => {
            const img = new Image();
            img.src = src;
            spritesRef.current[i] = img;
        });
    }, []);

    // Handle responsive canvas sizing
    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                const container = containerRef.current;
                const aspectRatio = 9 / 16;

                let width = container.clientWidth;
                let height = container.clientHeight;

                if (width / height > aspectRatio) {
                    width = height * aspectRatio;
                } else {
                    height = width / aspectRatio;
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
        groundOffsetRef.current = (groundOffsetRef.current + config.pipeSpeed * (deltaTime / 16.67)) % 24;

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

        // Sky - bright blue gradient
        const skyGradient = ctx.createLinearGradient(0, 0, 0, height - groundHeight);
        skyGradient.addColorStop(0, '#4EC0CA');
        skyGradient.addColorStop(1, '#71C5CF');
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, width, height - groundHeight);

        // Simple clouds
        ctx.fillStyle = '#ffffff';
        drawCloud(ctx, 50, 80, 40);
        drawCloud(ctx, 180, 120, 30);
        drawCloud(ctx, 300, 70, 35);
        drawCloud(ctx, 120, 200, 25);
        drawCloud(ctx, 280, 180, 32);

        // Draw pipes
        drawPipes(ctx, width, height, groundHeight);

        // Draw ground
        drawGround(ctx, width, height, groundHeight);

        // Draw player
        if (playerRef.current) {
            drawPlayer(ctx, playerRef.current);
        }
    };

    const drawCloud = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
        ctx.beginPath();
        ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
        ctx.arc(x + size * 0.5, y - size * 0.2, size * 0.5, 0, Math.PI * 2);
        ctx.arc(x + size, y, size * 0.6, 0, Math.PI * 2);
        ctx.arc(x + size * 0.5, y + size * 0.2, size * 0.4, 0, Math.PI * 2);
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

        // Ground base - sandy color
        ctx.fillStyle = '#DED895';
        ctx.fillRect(0, y, width, groundHeight);

        // Grass strip on top
        ctx.fillStyle = '#5DBE4A';
        ctx.fillRect(0, y, width, 15);

        // Grass highlight
        ctx.fillStyle = '#7ED321';
        ctx.fillRect(0, y, width, 5);

        // Dirt pattern - scrolling
        ctx.fillStyle = '#C4A86B';
        const offset = groundOffsetRef.current;
        for (let i = -1; i < Math.ceil(width / 24) + 1; i++) {
            const x = i * 24 - offset;
            // Simple dirt stripe pattern
            ctx.fillRect(x, y + 20, 12, 4);
            ctx.fillRect(x + 12, y + 35, 12, 4);
            ctx.fillRect(x, y + 50, 12, 4);
            ctx.fillRect(x + 12, y + 65, 12, 4);
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
        groundOffsetRef.current = (groundOffsetRef.current + 0.5) % 24;

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
        <div className="relative w-full h-full flex items-center justify-center bg-[#4EC0CA]">
            <div
                ref={containerRef}
                className="relative w-full h-full max-w-lg mx-auto flex items-center justify-center"
            >
                <canvas
                    ref={canvasRef}
                    width={canvasSize.width}
                    height={canvasSize.height}
                    onClick={handleFlap}
                    onTouchStart={(e) => {
                        e.preventDefault();
                        handleFlap();
                    }}
                    className="cursor-pointer shadow-2xl"
                    style={{
                        width: canvasSize.width,
                        height: canvasSize.height,
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
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
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
    );
}
