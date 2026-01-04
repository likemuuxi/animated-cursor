import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { PluginValue } from "@codemirror/view";

export interface CursorEffectConfig {
    enabled: boolean;
    [key: string]: any;
}

export abstract class CursorEffectPlugin implements PluginValue {
    protected readonly view: EditorView;
    protected canvas: HTMLCanvasElement | null = null;
    protected ctx: CanvasRenderingContext2D | null = null;
    private animationFrameId = 0;
    private measurePending = false;
    private needsResize = true;
    protected initialized = false;
    protected hasFocus = true;

    protected targetX = 0;
    protected targetY = 0;
    protected currentX = 0;
    protected currentY = 0;
    protected currentHeight = 0;

    private lastScrollTop = 0;
    private lastScrollLeft = 0;

    constructor(view: EditorView) {
        this.view = view;
        this.lastScrollTop = this.view.scrollDOM.scrollTop;
        this.lastScrollLeft = this.view.scrollDOM.scrollLeft;

        this.onScroll = this.onScroll.bind(this);
        this.loop = this.loop.bind(this);

        if (this.getConfig().enabled) {
            this.enable();
        }
    }

    abstract getConfig(): CursorEffectConfig;

    update(update: ViewUpdate): void {
        if (this.getConfig().enabled) {
            if (!this.canvas) this.enable();
            if (update.geometryChanged) this.needsResize = true;

            this.onViewUpdate(update);

            if (
                update.docChanged ||
                update.selectionSet ||
                update.viewportChanged ||
                update.geometryChanged ||
                update.focusChanged
            ) {
                this.scheduleMeasure();
            }
        } else {
            if (this.canvas) this.disable();
        }
    }

    destroy(): void {
        this.disable();
    }

    protected enable(): void {
        if (this.canvas) return;

        this.view.dom.classList.add("animated-cursor-effect-enabled");
        if (!this.view.dom.style.position)
            this.view.dom.style.position = "relative";

        this.canvas = document.createElement("canvas");
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

        this.view.scrollDOM.addEventListener("scroll", this.onScroll);

        this.scheduleMeasure();
        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    protected disable(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = 0;
        }
        if (this.canvas) {
            this.view.scrollDOM.removeEventListener("scroll", this.onScroll);
            this.canvas.remove();
            this.canvas = null;
            this.ctx = null;
        }
        this.view.dom.classList.remove("animated-cursor-effect-enabled");
    }

    private onScroll(): void {
        if (!this.initialized) return;

        const scrollTop = this.view.scrollDOM.scrollTop;
        const scrollLeft = this.view.scrollDOM.scrollLeft;

        const dy = scrollTop - this.lastScrollTop;
        const dx = scrollLeft - this.lastScrollLeft;

        this.lastScrollTop = scrollTop;
        this.lastScrollLeft = scrollLeft;

        this.currentX -= dx;
        this.currentY -= dy;
        this.targetX -= dx;
        this.targetY -= dy;

        this.onScrollChange(dx, dy);
    }

    protected onScrollChange(dx: number, dy: number): void {
        // Override in subclass
    }

    protected onViewUpdate(update: ViewUpdate): void {
        // Override in subclass
    }

    private scheduleMeasure(): void {
        if (this.measurePending) return;
        this.measurePending = true;
        this.view.requestMeasure({
            read: view => {
                const hasFocus = view.hasFocus;
                let rect: DOMRect | null = null;
                let coords: { x: number; y: number; height: number } | null = null;

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
                        this.lastScrollTop = this.view.scrollDOM.scrollTop;
                        this.lastScrollLeft = this.view.scrollDOM.scrollLeft;
                    }
                }
            }
        });
    }

    private resizeCanvas(rect: DOMRect): void {
        if (!this.canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.floor(rect.width * dpr));
        const height = Math.max(1, Math.floor(rect.height * dpr));
        if (this.canvas.width === width && this.canvas.height === height) return;

        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    private loop(): void {
        if (!this.canvas || !this.ctx) return;
        const dpr = window.devicePixelRatio || 1;
        const width = this.canvas.width / dpr;
        const height = this.canvas.height / dpr;

        this.ctx.clearRect(0, 0, width, height);


        if (this.hasFocus) {
            this.render(this.ctx);
        } else {
            // Still render if we have active ghosts? 
            // Better to just render always if enabled.
            // But if we want to respect focus for "active" cursor, maybe ghost trails should persist?
            // Let's just render. The ghost logic handles its own empty check.
            this.render(this.ctx);
        }

        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    abstract render(ctx: CanvasRenderingContext2D): void;
}
