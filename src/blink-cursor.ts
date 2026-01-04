import { ViewPlugin, ViewUpdate } from "@codemirror/view";
import { CursorEffectPlugin, CursorEffectConfig } from "src/cursor-effect";

const BLINK_CLASS = "blink-cursor-canvas";
const BLINK_ENABLED_CLASS = "blink-cursor-enabled";

export interface BlinkCursorConfig extends CursorEffectConfig {
    enabled: boolean;
    color: string;
}

let config: BlinkCursorConfig = {
    enabled: false,
    color: "#ff0000",
};

export function updateBlinkConfig(newConfig: Partial<BlinkCursorConfig>): void {
    Object.assign(config, newConfig);
}

interface Ghost {
    x: number;
    y: number;
    height: number;
    opacity: number;
}

class BlinkCursorPlugin extends CursorEffectPlugin {
    private lastActivityTime: number = 0;
    private readonly blinkInterval = 530; // Standard caret blink is ~530ms

    private ghosts: Ghost[] = [];
    private lastX: number = 0;
    private lastY: number = 0;

    getConfig(): CursorEffectConfig {
        return config;
    }

    protected enable(): void {
        super.enable();
        if (this.canvas) {
            this.canvas.className = BLINK_CLASS;
            this.view.dom.classList.add(BLINK_ENABLED_CLASS);
        }
        this.lastActivityTime = Date.now();
        this.lastX = this.currentX;
        this.lastY = this.currentY;
    }

    protected disable(): void {
        super.disable();
        this.view.dom.classList.remove(BLINK_ENABLED_CLASS);
        this.ghosts = [];
    }

    protected onViewUpdate(update: ViewUpdate): void {
        if (update.docChanged || update.selectionSet) {
            this.lastActivityTime = Date.now();
            // Force redraw immediately
            if (this.initialized) {
                this.render(this.ctx);
            }
        }
    }

    protected onScrollChange(dx: number, dy: number): void {
        for (const g of this.ghosts) {
            g.x -= dx;
            g.y -= dy;
        }
        this.lastX -= dx;
        this.lastY -= dy;
    }

    render(ctx: CanvasRenderingContext2D): void {
        // Smooth cursor movement - Lower factor = smoother (more "floaty")
        const lerp = (start: number, end: number, factor: number) => {
            return start + (end - start) * factor;
        };
        this.currentX = lerp(this.currentX, this.targetX, 0.25);
        this.currentY = lerp(this.currentY, this.targetY, 0.25);

        // --- Ghost Spawning Logic ---
        const dx = this.currentX - this.lastX;
        const dy = this.currentY - this.lastY;
        const dist = Math.hypot(dx, dy);

        // Spawn ghosts continuously to fill gaps - 1px for perfect smoothness
        const spawnInterval = 1;

        if (dist > spawnInterval) {
            const steps = Math.ceil(dist / spawnInterval);
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const gx = this.lastX + (dx * t);
                const gy = this.lastY + (dy * t);

                this.ghosts.push({
                    x: gx,
                    y: gy,
                    height: this.currentHeight || 20,
                    opacity: 0.4
                });
            }
            this.lastX = this.currentX;
            this.lastY = this.currentY;
        }

        ctx.fillStyle = config.color;

        // --- Render Ghosts ---
        for (let i = this.ghosts.length - 1; i >= 0; i--) {
            const g = this.ghosts[i];
            g.opacity -= 0.03; // Slightly slower fade

            if (g.opacity <= 0) {
                this.ghosts.splice(i, 1);
                continue;
            }

            ctx.globalAlpha = g.opacity;
            ctx.fillRect(g.x, g.y, 4, g.height);
        }

        // --- Render Main Cursor ---
        const now = Date.now();
        const timeSinceActivity = now - this.lastActivityTime;

        let opacity = 0.6;

        // If idle for more than 500ms, start blinking
        if (timeSinceActivity > 500) {
            const phase = (now % (this.blinkInterval * 2));
            if (phase > this.blinkInterval) {
                opacity = 0;
            }
        }

        if (opacity > 0) {
            ctx.globalAlpha = opacity;
            const height = this.currentHeight || 20;
            ctx.fillRect(this.currentX, this.currentY, 4, height);
            ctx.globalAlpha = 1.0;
        }
    }
}

export const blinkCursorPlugin = ViewPlugin.fromClass(BlinkCursorPlugin);
