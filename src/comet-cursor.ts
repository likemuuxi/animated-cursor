import { ViewPlugin } from "@codemirror/view";
import { CursorEffectPlugin, CursorEffectConfig } from "src/cursor-effect";

const COMET_CLASS = "comet-cursor-canvas";
const COMET_ENABLED_CLASS = "comet-cursor-enabled";

export interface CometCursorConfig extends CursorEffectConfig {
	color: string;
	width: number;
	tailLength: number;
	smoothness: number;
}

let config: CometCursorConfig = {
	enabled: true,
	color: "#00e5ff",
	width: 2,
	tailLength: 12,
	smoothness: 0.2
};

export function updateCometConfig(newConfig: Partial<CometCursorConfig>): void {
	Object.assign(config, newConfig);
}

class CometCursorPlugin extends CursorEffectPlugin {
	private trail: { x: number; y: number }[] = [];

	getConfig(): CursorEffectConfig {
		return config;
	}

	protected enable(): void {
		super.enable();
		if (this.canvas) {
			this.canvas.className = COMET_CLASS;
			this.view.dom.classList.add(COMET_ENABLED_CLASS);
		}
	}

	protected disable(): void {
		super.disable();
		this.view.dom.classList.remove(COMET_ENABLED_CLASS);
	}

	protected onScrollChange(dx: number, dy: number): void {
		for (const point of this.trail) {
			point.x -= dx;
			point.y -= dy;
		}
	}

	private lerp(start: number, end: number, amt: number): number {
		return (1 - amt) * start + amt * end;
	}

	render(ctx: CanvasRenderingContext2D): void {
		if (Math.abs(this.targetX - this.currentX) < 0.1) this.currentX = this.targetX;
		else this.currentX = this.lerp(this.currentX, this.targetX, config.smoothness);

		if (Math.abs(this.targetY - this.currentY) < 0.1) this.currentY = this.targetY;
		else this.currentY = this.lerp(this.currentY, this.targetY, config.smoothness);

		const dist = Math.hypot(this.targetX - this.currentX, this.targetY - this.currentY);
		const isMoving = dist > 0.2;

		if (isMoving) {
			this.trail.push({ x: this.currentX, y: this.currentY });
			if (this.trail.length > config.tailLength) this.trail.shift();
			this.drawTrail(ctx);
		} else {
			this.trail = [];
		}

		this.drawHead(ctx, isMoving);
	}

	private drawTrail(ctx: CanvasRenderingContext2D): void {
		if (this.trail.length < 2) return;

		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.shadowBlur = 8;
		ctx.shadowColor = config.color;

		for (let i = 0; i < this.trail.length - 1; i++) {
			const p1 = this.trail[i];
			const p2 = this.trail[i + 1];
			const alpha = i / this.trail.length;

			ctx.beginPath();
			ctx.moveTo(p1.x, p1.y);
			ctx.lineTo(p2.x, p2.y);
			ctx.lineWidth = config.width + alpha * 2;
			ctx.strokeStyle = this.hexToRgba(config.color, alpha);
			ctx.stroke();
		}
	}

	private drawHead(ctx: CanvasRenderingContext2D, isMoving: boolean): void {
		const height = Math.max(8, this.currentHeight || 24);

		ctx.fillStyle = config.color;
		ctx.shadowBlur = isMoving ? 10 : 0;
		ctx.shadowColor = config.color;
		ctx.fillRect(this.currentX - 1, this.currentY, 2, height);

		ctx.beginPath();
		ctx.arc(this.currentX, this.currentY + height / 2, 2, 0, Math.PI * 2);
		ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
		ctx.fill();
	}

	private hexToRgba(hex: string, alpha: number): string {
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}
}

export const cometCursorPlugin = ViewPlugin.fromClass(CometCursorPlugin);
