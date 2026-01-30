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

export function createPlayer(canvasWidth: number, canvasHeight: number): Player {
  return {
    x: canvasWidth * 0.2,
    y: canvasHeight * 0.4,
    velocity: 0,
    rotation: 0,
    width: 64,
    height: 64,
    hitboxRadius: 24, // Circular hitbox centered on torso
  };
}

export function applyGravity(player: Player, config: GameConfig, deltaTime: number): Player {
  const dt = deltaTime / 16.67; // Normalize to 60fps
  let newVelocity = player.velocity + config.gravity * dt;
  
  // Clamp to terminal velocity
  newVelocity = Math.min(newVelocity, config.terminalVelocity);
  
  // Calculate rotation based on velocity
  const targetRotation = Math.min(Math.max(newVelocity * 3, -30), 90);
  const newRotation = player.rotation + (targetRotation - player.rotation) * 0.1;
  
  return {
    ...player,
    y: player.y + newVelocity * dt,
    velocity: newVelocity,
    rotation: newRotation,
  };
}

export function applyFlap(player: Player, config: GameConfig): Player {
  return {
    ...player,
    velocity: config.flapStrength,
    rotation: -30,
  };
}

export function createPipe(x: number, canvasHeight: number, gapSize: number): Pipe {
  // Random gap position (keep some margin from top/bottom)
  const minGapY = gapSize / 2 + 80;
  const maxGapY = canvasHeight - gapSize / 2 - 120; // Leave room for ground
  const gapY = minGapY + Math.random() * (maxGapY - minGapY);
  
  return {
    x,
    gapY,
    passed: false,
  };
}

export function updatePipes(
  pipes: Pipe[],
  config: GameConfig,
  canvasWidth: number,
  canvasHeight: number,
  deltaTime: number
): Pipe[] {
  const dt = deltaTime / 16.67;
  
  // Move pipes left
  let updatedPipes = pipes.map(pipe => ({
    ...pipe,
    x: pipe.x - config.pipeSpeed * dt,
  }));
  
  // Remove off-screen pipes
  updatedPipes = updatedPipes.filter(pipe => pipe.x > -config.pipeWidth);
  
  // Add new pipe if needed
  const lastPipe = updatedPipes[updatedPipes.length - 1];
  if (!lastPipe || lastPipe.x < canvasWidth - config.pipeSpacing) {
    updatedPipes.push(createPipe(canvasWidth + 50, canvasHeight, config.pipeGap));
  }
  
  return updatedPipes;
}

export function checkCollision(
  player: Player,
  pipes: Pipe[],
  config: GameConfig,
  canvasHeight: number
): boolean {
  const centerX = player.x + player.width / 2;
  const centerY = player.y + player.height / 2;
  
  // Ground collision
  if (centerY + player.hitboxRadius > canvasHeight - 80) {
    return true;
  }
  
  // Ceiling collision
  if (centerY - player.hitboxRadius < 0) {
    return true;
  }
  
  // Pipe collision (circle vs rectangle)
  for (const pipe of pipes) {
    const pipeLeft = pipe.x;
    const pipeRight = pipe.x + config.pipeWidth;
    const gapTop = pipe.gapY - config.pipeGap / 2;
    const gapBottom = pipe.gapY + config.pipeGap / 2;
    
    // Check if player is in pipe's x range
    if (centerX + player.hitboxRadius > pipeLeft && centerX - player.hitboxRadius < pipeRight) {
      // Check if player is NOT in the gap (colliding with pipe)
      if (centerY - player.hitboxRadius < gapTop || centerY + player.hitboxRadius > gapBottom) {
        return true;
      }
    }
  }
  
  return false;
}

export function checkScore(player: Player, pipes: Pipe[]): { pipes: Pipe[]; scored: boolean } {
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

// Animation frame selection based on velocity
export function getAnimationFrame(velocity: number): number {
  if (velocity < -3) return 1; // Wings up (flapping)
  if (velocity > 2) return 0;  // Wings down (gliding)
  return 2;                     // Wings mid
}
