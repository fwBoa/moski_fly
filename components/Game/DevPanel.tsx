'use client';

import { GameConfig, DEFAULT_CONFIG } from './Physics';

interface DevPanelProps {
    config: GameConfig;
    onConfigChange: (config: GameConfig) => void;
}

export default function DevPanel({ config, onConfigChange }: DevPanelProps) {
    const handleChange = (key: keyof GameConfig, value: number) => {
        onConfigChange({ ...config, [key]: value });
    };

    const reset = () => {
        onConfigChange(DEFAULT_CONFIG);
    };

    return (
        <div className="fixed right-4 top-4 w-64 bg-[#DED895] border-4 border-[#543847] rounded-xl p-4 shadow-lg z-50">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-[#543847] font-bold text-sm uppercase tracking-wider">
                    🛠️ Dev Mode
                </h3>
                <button
                    onClick={reset}
                    className="text-xs px-2 py-1 bg-[#5DBE4A] hover:bg-[#4CAF3A] rounded text-white font-bold transition-colors border-b-2 border-[#3D8B32]"
                >
                    Reset
                </button>
            </div>

            <div className="space-y-3">
                <SliderControl
                    label="FLAP_STRENGTH"
                    value={config.flapStrength}
                    min={-20}
                    max={-3}
                    step={0.5}
                    onChange={(v) => handleChange('flapStrength', v)}
                />

                <SliderControl
                    label="GRAVITY"
                    value={config.gravity}
                    min={0.1}
                    max={1.5}
                    step={0.05}
                    onChange={(v) => handleChange('gravity', v)}
                />

                <SliderControl
                    label="TERMINAL_VEL"
                    value={config.terminalVelocity}
                    min={5}
                    max={25}
                    step={1}
                    onChange={(v) => handleChange('terminalVelocity', v)}
                />

                <SliderControl
                    label="PIPE_SPEED"
                    value={config.pipeSpeed}
                    min={1}
                    max={8}
                    step={0.5}
                    onChange={(v) => handleChange('pipeSpeed', v)}
                />

                <SliderControl
                    label="PIPE_GAP"
                    value={config.pipeGap}
                    min={100}
                    max={300}
                    step={10}
                    onChange={(v) => handleChange('pipeGap', v)}
                />

                <SliderControl
                    label="PIPE_SPACING"
                    value={config.pipeSpacing}
                    min={150}
                    max={400}
                    step={10}
                    onChange={(v) => handleChange('pipeSpacing', v)}
                />
            </div>

            <div className="mt-3 pt-3 border-t-2 border-[#C4A86B] text-xs text-[#543847]/70">
                Tune gameplay in real-time
            </div>
        </div>
    );
}

interface SliderControlProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
}

function SliderControl({ label, value, min, max, step, onChange }: SliderControlProps) {
    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-[#543847]">{label}</label>
                <span className="text-xs font-bold text-[#543847] bg-[#C4A86B] px-2 py-0.5 rounded">
                    {value.toFixed(1)}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-3 rounded-lg appearance-none cursor-pointer
          bg-[#C4A86B]
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-5
          [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-[#5DBE4A]
          [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-[#3D8B32]
          [&::-webkit-slider-thumb]:shadow-md
          [&::-moz-range-thumb]:w-5
          [&::-moz-range-thumb]:h-5
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-[#5DBE4A]
          [&::-moz-range-thumb]:border-2
          [&::-moz-range-thumb]:border-[#3D8B32]"
            />
        </div>
    );
}
