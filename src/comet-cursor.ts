import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

type TrailPoint = { x: number; y: number };
type MeasureResult = {
	rect: DOMRect | null;
	coords: { x: number; y: number; height: number } | null;
	hasFocus: boolean;
};

const COMET_CLASS = "comet-cursor-canvas";
const COMET_ENABLED_CLASS = "comet-cursor-enabled";

export const cometCursorPlugin = ViewPlugin.fromClass(class {
	private readonly view: EditorView;
	private readonly canvas: HTMLCanvasElement;
	private readonly ctx: CanvasRenderingContext2D;
	private animationFrameId = 0;
	private measurePending = false;
	private needsResize = true;
	private initialized = false;
	private hasFocus = true;

	private targetX = 0;
	private targetY = 0;
	private currentX = 0;
	private currentY = 0;
	private currentHeight = 0;
	private trail: TrailPoint[] = [];

	private readonly config = {
		color: "#00e5ff",
		width: 2,
		tailLength: 12,
		smoothness: 0.2
	};

	constructor(view: EditorView) {
		this.view = view;
		this.view.dom.addClass(COMET_ENABLED_CLASS);
		if (!this.view.dom.style.position)
			this.view.dom.style.position = "relative";

		this.canvas = document.createElement("canvas");
		this.canvas.className = COMET_CLASS;
		Object.assign(this.canvas.style, {
			position: "absolute",
			top: "0",
			left: "0",
			width: "100%",
			height: "100%",
			pointerEvents: "none",
			zIndex: "100"
		});

		this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
		this.view.dom.appendChild(this.canvas);

		this.scheduleMeasure();

		this.loop = this.loop.bind(this);
		this.animationFrameId = requestAnimationFrame(this.loop);
	}

	update(update: ViewUpdate): void {
		if (update.geometryChanged) this.needsResize = true;
		if (
			update.docChanged ||
			update.selectionSet ||
			update.viewportChanged ||
			update.geometryChanged ||
			update.focusChanged
		) {
			this.scheduleMeasure();
		}
	}

	destroy(): void {
		cancelAnimationFrame(this.animationFrameId);
		this.canvas.remove();
		this.view.dom.removeClass(COMET_ENABLED_CLASS);
	}

	private scheduleMeasure(): void {
		if (this.measurePending) return;
		this.measurePending = true;
		this.view.requestMeasure({
			read: view => {
				const hasFocus = view.hasFocus;
				let rect: DOMRect | null = null;
				let coords: MeasureResult["coords"] = null;

				if (this.needsResize || hasFocus) {
					rect = view.dom.getBoundingClientRect();
				}

				if (hasFocus) {
					const head = view.state.selection.main.head;
					const pos = view.coordsAtPos(head);
					if (pos && rect) {
						coords = {
							x: pos.left - rect.left,
							y: pos.top - rect.top,
							height: pos.bottom - pos.top
						};
					}
				}

				return { rect, coords, hasFocus };
			},
			write: measure => {
				this.measurePending = false;
				this.hasFocus = measure.hasFocus;

				if (measure.rect) {
					this.resizeCanvas(measure.rect);
					this.needsResize = false;
				}

				if (measure.coords) {
					this.targetX = measure.coords.x;
					this.targetY = measure.coords.y;
					this.currentHeight = measure.coords.height;
					if (!this.initialized) {
						this.currentX = this.targetX;
						this.currentY = this.targetY;
						this.initialized = true;
					}
				}
			}
		});
	}

	private resizeCanvas(rect: DOMRect): void {
		const dpr = window.devicePixelRatio || 1;
		const width = Math.max(1, Math.floor(rect.width * dpr));
		const height = Math.max(1, Math.floor(rect.height * dpr));
		if (this.canvas.width === width && this.canvas.height === height) return;

		this.canvas.width = width;
		this.canvas.height = height;
		this.canvas.style.width = `${rect.width}px`;
		this.canvas.style.height = `${rect.height}px`;
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	private lerp(start: number, end: number, amt: number): number {
		return (1 - amt) * start + amt * end;
	}

	private loop(): void {
		const ctx = this.ctx;
		const dpr = window.devicePixelRatio || 1;
		const width = this.canvas.width / dpr;
		const height = this.canvas.height / dpr;

		ctx.clearRect(0, 0, width, height);

		if (!this.hasFocus || !this.initialized) {
			this.trail = [];
			this.animationFrameId = requestAnimationFrame(this.loop);
			return;
		}

		if (Math.abs(this.targetX - this.currentX) < 0.1) this.currentX = this.targetX;
		else this.currentX = this.lerp(this.currentX, this.targetX, this.config.smoothness);

		if (Math.abs(this.targetY - this.currentY) < 0.1) this.currentY = this.targetY;
		else this.currentY = this.lerp(this.currentY, this.targetY, this.config.smoothness);

		const dist = Math.hypot(this.targetX - this.currentX, this.targetY - this.currentY);
		const isMoving = dist > 0.2;

		if (isMoving) {
			this.trail.push({ x: this.currentX, y: this.currentY });
			if (this.trail.length > this.config.tailLength) this.trail.shift();
			this.drawTrail();
		} else {
			this.trail = [];
		}

		this.drawHead(isMoving);

		this.animationFrameId = requestAnimationFrame(this.loop);
	}

	private drawTrail(): void {
		if (this.trail.length < 2) return;
		const ctx = this.ctx;

		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.shadowBlur = 8;
		ctx.shadowColor = this.config.color;

		for (let i = 0; i < this.trail.length - 1; i++) {
			const p1 = this.trail[i];
			const p2 = this.trail[i + 1];
			const alpha = i / this.trail.length;

			ctx.beginPath();
			ctx.moveTo(p1.x, p1.y);
			ctx.lineTo(p2.x, p2.y);
			ctx.lineWidth = this.config.width + alpha * 2;
			ctx.strokeStyle = `rgba(0, 229, 255, ${alpha})`;
			ctx.stroke();
		}
	}

	private drawHead(isMoving: boolean): void {
		const ctx = this.ctx;
		const height = Math.max(8, this.currentHeight || 24);

		ctx.fillStyle = this.config.color;
		ctx.shadowBlur = isMoving ? 10 : 0;
		ctx.shadowColor = this.config.color;
		ctx.fillRect(this.currentX - 1, this.currentY, 2, height);

		ctx.beginPath();
		ctx.arc(this.currentX, this.currentY + height / 2, 2, 0, Math.PI * 2);
		ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
		ctx.fill();
	}
});
