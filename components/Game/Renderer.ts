// Renderer.ts — All canvas drawing functions extracted from Canvas.tsx

import { Pipe, Coin, Player, GameConfig, CoinType, getAnimationFrame } from './Physics';

// --- Types for flying coin animation ---

export interface FlyingCoin {
    x: number;
    y: number;
    startX: number;
    startY: number;
    progress: number;
    type: CoinType;
}

// --- Drawing functions ---

export function drawPipes(
    ctx: CanvasRenderingContext2D,
    pipes: Pipe[],
    config: GameConfig,
    width: number,
    height: number,
    groundHeight: number
) {
    for (const pipe of pipes) {
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
}

export function drawGround(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    groundHeight: number,
    groundOffset: number
) {
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
    // Increase loop range to cover the max offset (48px = 2 tiles) plus buffer
    for (let i = -1; i < Math.ceil(width / 24) + 3; i++) {
        const x = i * 24 - groundOffset;

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
}

export function drawCoins(
    ctx: CanvasRenderingContext2D,
    coins: Coin[],
    flyingCoins: FlyingCoin[],
    coinSprite: HTMLImageElement | null,
    diamondSprite: HTMLImageElement | null,
    animTime: number
) {
    if (!coinSprite || !coinSprite.complete) return;

    ctx.imageSmoothingEnabled = false;

    for (const coin of coins) {
        if (coin.collected) continue;

        const isRare = coin.type === 'rare';
        const coinSize = isRare ? 90 : 80;
        const sprite = (isRare && diamondSprite?.complete) ? diamondSprite : coinSprite;

        // Bobbing animation
        const bobOffset = Math.sin(animTime / 200 + coin.x * 0.01) * 6;

        ctx.save();
        ctx.translate(coin.x, coin.y + bobOffset);

        // Pulse scale
        const scale = 1 + Math.sin(animTime / 150 + coin.x * 0.02) * 0.1;
        ctx.scale(scale, scale);

        // Draw coin with correct sprite
        ctx.drawImage(sprite, -coinSize / 2, -coinSize / 2, coinSize, coinSize);

        ctx.restore();
    }

    // Draw flying coins (collection animation toward HUD)
    for (const fc of flyingCoins) {
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
}

export function drawPlayer(
    ctx: CanvasRenderingContext2D,
    player: Player,
    sprites: HTMLImageElement[]
) {
    const sprite = sprites[getAnimationFrame(player.velocity)];
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
}

export function drawBackground(
    ctx: CanvasRenderingContext2D,
    backgrounds: HTMLImageElement[],
    width: number,
    height: number,
    scoreTier: number
) {
    const bgIdx = Math.min(scoreTier, backgrounds.length - 1);
    const bg = backgrounds[bgIdx] || backgrounds[0];

    if (bg && bg.complete) {
        ctx.imageSmoothingEnabled = false;

        // Cover mode: scale to fill canvas while preserving aspect ratio
        const bgRatio = bg.naturalWidth / bg.naturalHeight;
        const canvasRatio = width / height;
        let sx = 0, sy = 0, sw = bg.naturalWidth, sh = bg.naturalHeight;

        if (canvasRatio > bgRatio) {
            const visibleHeight = bg.naturalWidth / canvasRatio;
            sy = (bg.naturalHeight - visibleHeight) / 2;
            sh = visibleHeight;
        } else {
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
}
