'use client';

// Sound utility using Web Audio API - no external files needed
// Generates retro-style sound effects programmatically

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!audioContext) {
        audioContext = new AudioContext();
    }
    return audioContext;
}

// Resume audio context (needed after user interaction)
export function resumeAudio() {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
}

// Coin collection sound - rising sparkle
export function playCoinSound() {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        // Two quick rising tones for a "ding ding!" 
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(987, now);        // B5
        osc1.frequency.setValueAtTime(1319, now + 0.07); // E6

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1319, now + 0.07); // E6
        osc2.frequency.setValueAtTime(1568, now + 0.12); // G6

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.setValueAtTime(0.2, now + 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now + 0.07);
        osc1.stop(now + 0.25);
        osc2.stop(now + 0.25);
    } catch (e) {
        // Silently fail if audio not available
    }
}

// Flap/jump sound - quick upward pop
export function playFlapSound() {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.06);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.08);
    } catch (e) {
        // Silently fail
    }
}

// Rare diamond collection sound - magical sparkle arpeggio
export function playDiamondSound() {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        gain.connect(ctx.destination);

        // Rapid ascending arpeggio
        const notes = [1047, 1319, 1568, 2093]; // C6, E6, G6, C7
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const noteGain = ctx.createGain();
            noteGain.gain.setValueAtTime(0, now + i * 0.06);
            noteGain.gain.linearRampToValueAtTime(0.8, now + i * 0.06 + 0.02);
            noteGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.15);
            osc.connect(noteGain);
            noteGain.connect(gain);
            osc.start(now + i * 0.06);
            osc.stop(now + i * 0.06 + 0.15);
        });
    } catch (e) {
        // Silently fail
    }
}

// Pipe pass sound - short "woosh" blip
export function playPipeSound() {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.linearRampToValueAtTime(660, now + 0.08);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.12);
    } catch (e) {
        // Silently fail
    }
}

// Game over sound - descending sad tone
export function playGameOverSound() {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.linearRampToValueAtTime(220, now + 0.15);
        osc.frequency.linearRampToValueAtTime(110, now + 0.35);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.5);
    } catch (e) {
        // Silently fail
    }
}

// Background music - simple looping chiptune melody
class BackgroundMusic {
    private ctx: AudioContext | null = null;
    private gainNode: GainNode | null = null;
    private isPlaying = false;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private _volume = 0.08;

    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;

        try {
            this.ctx = getAudioContext();
            this.gainNode = this.ctx.createGain();
            this.gainNode.gain.value = this._volume;
            this.gainNode.connect(this.ctx.destination);

            // Simple looping melody pattern
            const melody = [
                // Note freq, duration, type
                { freq: 523, dur: 0.15 }, // C5
                { freq: 659, dur: 0.15 }, // E5
                { freq: 784, dur: 0.15 }, // G5
                { freq: 659, dur: 0.15 }, // E5
                { freq: 523, dur: 0.15 }, // C5
                { freq: 392, dur: 0.15 }, // G4
                { freq: 440, dur: 0.15 }, // A4
                { freq: 523, dur: 0.15 }, // C5
                { freq: 587, dur: 0.15 }, // D5
                { freq: 523, dur: 0.15 }, // C5
                { freq: 440, dur: 0.15 }, // A4
                { freq: 392, dur: 0.15 }, // G4
                { freq: 349, dur: 0.15 }, // F4
                { freq: 392, dur: 0.15 }, // G4
                { freq: 440, dur: 0.15 }, // A4
                { freq: 523, dur: 0.30 }, // C5 (long)
            ];

            let noteIndex = 0;
            const noteSpacing = 180; // ms between notes

            const playNote = () => {
                if (!this.isPlaying || !this.ctx || !this.gainNode) return;

                const note = melody[noteIndex % melody.length];
                const now = this.ctx.currentTime;

                const osc = this.ctx.createOscillator();
                const noteGain = this.ctx.createGain();

                osc.type = 'square';
                osc.frequency.value = note.freq;

                noteGain.gain.setValueAtTime(0.6, now);
                noteGain.gain.exponentialRampToValueAtTime(0.001, now + note.dur);

                osc.connect(noteGain);
                noteGain.connect(this.gainNode);

                osc.start(now);
                osc.stop(now + note.dur + 0.01);

                noteIndex++;
            };

            // Also add a bass line
            let bassIndex = 0;
            const bassNotes = [262, 196, 220, 175]; // C4, G3, A3, F3
            let beatCount = 0;

            const playBeat = () => {
                if (!this.isPlaying || !this.ctx || !this.gainNode) return;

                // Play melody note
                playNote();

                // Play bass every 4 beats
                if (beatCount % 4 === 0) {
                    const now = this.ctx.currentTime;
                    const bassOsc = this.ctx.createOscillator();
                    const bassGain = this.ctx.createGain();

                    bassOsc.type = 'triangle';
                    bassOsc.frequency.value = bassNotes[bassIndex % bassNotes.length];

                    bassGain.gain.setValueAtTime(0.4, now);
                    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

                    bassOsc.connect(bassGain);
                    bassGain.connect(this.gainNode!);

                    bassOsc.start(now);
                    bassOsc.stop(now + 0.5);

                    bassIndex++;
                }

                beatCount++;
            };

            this.intervalId = setInterval(playBeat, noteSpacing);
        } catch (e) {
            // Silently fail
        }
    }

    stop() {
        this.isPlaying = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    get volume() {
        return this._volume;
    }

    set volume(v: number) {
        this._volume = v;
        if (this.gainNode) {
            this.gainNode.gain.value = v;
        }
    }
}

export const bgMusic = new BackgroundMusic();
