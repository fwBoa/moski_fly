// Physics constants and calculations for Moski Fly

export interface GameConfig {
  gravity: number;
  flapStrength: number;
  terminalVelocity: number;
  pipeSpeed: number;
  pipeGap: number;
  pipeWidth: number;
  pipeSpacing: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  gravity: 0.5,
  flapStrength: -9,
  terminalVelocity: 12,
  pipeSpeed: 3,
  pipeGap: 180,
  pipeWidth: 80,
  pipeSpacing: 280,
};

export interface Player {
  x: number;
  y: number;
  velocity: number;
  rotation: number;
  width: number;
  height: number;
  hitboxRadius: number;
}

export interface Pipe {
  x: number;
  gapY: number; // Center of the gap
  passed: boolean;
}

export type CoinType = 'normal' | 'rare';

export interface Coin {
  x: number;
  y: number;
  collected: boolean;
  type: CoinType;
  value: number;
}

export function createPlayer(canvasWidth: number, canvasHeight: number): Player {
  return {
    x: canvasWidth * 0.2,
    y: canvasHeight * 0.4,
    velocity: 0,
    rotation: 0,
    width: 64,
    height: 64,
    hitboxRadius: 18,
  };
}

// --- Pipe Functions ---

export function updatePipes(
  pipes: Pipe[],
  config: GameConfig,
  canvasWidth: number,
  canvasHeight: number,
  deltaTime: number
): Pipe[] {
  const dt = deltaTime / 16.67;
  const groundHeight = 80;
  const playableHeight = canvasHeight - groundHeight;

  // Move existing pipes
  const movedPipes = pipes.map(pipe => ({
    ...pipe,
    x: pipe.x - config.pipeSpeed * dt,
  }));

  // Remove off-screen pipes
  const filtered = movedPipes.filter(pipe => pipe.x > -config.pipeWidth);

  // Add new pipes
  const lastPipe = filtered[filtered.length - 1];
  if (!lastPipe || lastPipe.x < canvasWidth - config.pipeSpacing) {
    const minGapY = 120;
    const maxGapY = playableHeight - 120;
    const gapY = minGapY + Math.random() * (maxGapY - minGapY);

    filtered.push({
      x: canvasWidth,
      gapY,
      passed: false,
    });
  }

  return filtered;
}

export function checkCollision(
  player: Player,
  pipes: Pipe[],
  config: GameConfig,
  canvasHeight: number
): boolean {
  const groundHeight = 80;
  const centerX = player.x + player.width / 2;
  const centerY = player.y + player.height / 2;
  const r = player.hitboxRadius;

  // Ground collision
  if (centerY + r >= canvasHeight - groundHeight) return true;
  // Ceiling collision
  if (centerY - r <= 0) return true;

  // Pipe collision
  for (const pipe of pipes) {
    const halfGap = config.pipeGap / 2;
    const pipeRight = pipe.x + config.pipeWidth;

    if (centerX + r > pipe.x && centerX - r < pipeRight) {
      if (centerY - r < pipe.gapY - halfGap || centerY + r > pipe.gapY + halfGap) {
        return true;
      }
    }
  }

  return false;
}

export function checkScore(
  player: Player,
  pipes: Pipe[]
): { pipes: Pipe[]; scored: boolean } {
  const centerX = player.x + player.width / 2;
  let scored = false;

  const updatedPipes = pipes.map(pipe => {
    if (!pipe.passed && pipe.x + 40 < centerX) {
      scored = true;
      return { ...pipe, passed: true };
    }
    return pipe;
  });

  return { pipes: updatedPipes, scored };
}

export function applyGravity(
  player: Player,
  config: GameConfig,
  deltaTime: number
): Player {
  const dt = deltaTime / 16.67;
  const newVelocity = player.velocity + config.gravity * dt;
  const newY = player.y + newVelocity * dt;
  const targetRotation = newVelocity > 0
    ? Math.min(newVelocity * 3, 90)
    : Math.max(newVelocity * 2, -30);

  return {
    ...player,
    velocity: newVelocity,
    y: newY,
    rotation: targetRotation,
  };
}

export function applyFlap(player: Player, config: GameConfig): Player {
  return {
    ...player,
    velocity: config.flapStrength,
  };
}

export function getAnimationFrame(velocity: number): number {
  if (velocity < -2) return 1;  // Wings up (flapping)
  if (velocity > 2) return 0;  // Wings down (gliding)
  return 2;                     // Wings mid
}

// Create a coin positioned in the pipe gap (10% chance of rare diamond)
export function createCoinInGap(x: number, gapY: number): Coin {
  const isRare = Math.random() < 0.10;
  return {
    x: x + 40,
    y: gapY,
    collected: false,
    type: isRare ? 'rare' : 'normal',
    value: isRare ? 3 : 1,
  };
}

// Update coins positions (move left with game speed)
export function updateCoins(
  coins: Coin[],
  config: GameConfig,
  deltaTime: number
): Coin[] {
  const dt = deltaTime / 16.67;

  return coins
    .map(coin => ({
      ...coin,
      x: coin.x - config.pipeSpeed * dt,
    }))
    .filter(coin => coin.x > -50 && !coin.collected);
}

// Check if player collects any coins - returns total value and collected coin positions
export function checkCoinCollection(
  player: Player,
  coins: Coin[]
): { coins: Coin[]; collected: number; totalValue: number; collectedCoins: { x: number; y: number; type: CoinType }[] } {
  const centerX = player.x + player.width / 2;
  const centerY = player.y + player.height / 2;
  const coinRadius = 20;
  let collected = 0;
  let totalValue = 0;
  const collectedCoins: { x: number; y: number; type: CoinType }[] = [];

  const updatedCoins = coins.map(coin => {
    if (coin.collected) return coin;

    const dx = centerX - coin.x;
    const dy = centerY - coin.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < player.hitboxRadius + coinRadius) {
      collected++;
      totalValue += coin.value;
      collectedCoins.push({ x: coin.x, y: coin.y, type: coin.type });
      return { ...coin, collected: true };
    }
    return coin;
  });

  return { coins: updatedCoins, collected, totalValue, collectedCoins };
}

