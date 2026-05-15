import { GameConfig } from './Physics';
export function getDynamicConfig(baseConfig: GameConfig, score: number): GameConfig {
  // Speed increases by 5% every 25 points, up to a maximum of 50% increase (+1.5x)
  const speedMultiplier = Math.min(1.5, 1 + Math.floor(score / 25) * 0.05);
  
  // Gap decreases by 5px every 25 points, down to a minimum of 130px
  const gapReduction = Math.min(baseConfig.pipeGap - 130, Math.floor(score / 25) * 5);
  
  return {
    ...baseConfig,
    pipeSpeed: baseConfig.pipeSpeed * speedMultiplier,
    pipeGap: baseConfig.pipeGap - gapReduction
  };
}
