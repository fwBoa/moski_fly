import { GameConfig } from './Physics';
export function getDynamicConfig(baseConfig: GameConfig, score: number): GameConfig {
  // Speed increases by 5% every 10 points, up to a maximum of 50% increase (+1.5x)
  const speedMultiplier = Math.min(1.5, 1 + Math.floor(score / 10) * 0.05);
  
  return {
    ...baseConfig,
    pipeSpeed: baseConfig.pipeSpeed * speedMultiplier
  };
}
