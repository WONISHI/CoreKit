import type { WatermarkOptions, InternalOptions, WatermarkContentItem } from "../types/watermark";

class Watermark {
    private options: InternalOptions;
    private container: HTMLElement | null = null;
    private watermarkDom: HTMLElement | null = null;
    private observer: MutationObserver | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private _imgCache = new Map<string, HTMLImageElement>();

    constructor() {
        this.options = {
            id: "watermark-layer",
            content: "内部资料",
            fontSize: 16,
            fontWeight: "normal",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontColor: "rgba(0, 0, 0, 0.15)",
            rotate: -20,
            zIndex: 9999,
            monitor: true,
            layout: "repeat",
            gap: [100, 100],
            offset: [20, 20],
        };
    }

    // =================================================================
    // 1. 公开 API
    // =================================================================

    public apply(arg1?: string | WatermarkOptions, arg2?: HTMLElement | string): this {
        if (document.readyState === "loading" && !document.body) {
            document.addEventListener("DOMContentLoaded", () => this.apply(arg1, arg2));
            return this;
        }

        let opts: WatermarkOptions = {};
        if (typeof arg1 === "string") {
            opts.content = arg1;
            if (arg2) opts.el = arg2;
        } else if (typeof arg1 === "object") {
            opts = arg1;
        }

        this._updateOptions(opts);
        this.container = this._resolveContainer(opts.el || this.options.el);

        // 关键：确保容器能撑起 absolute 的水印
        this._ensureContainerPosition();
        this.render();

        if (this.options.monitor) this.startMonitor();
        this.startResizeObserver();
        return this;
    }

    public update(options: Partial<WatermarkOptions>) {
        this._updateOptions(options);
        this.render();
    }

    // 暴露 Base64 方法
    public async getBase64() {
        const { base64 } = await this.getWatermarkData();
        return base64;
    }

    // =================================================================
    // 2. 核心布局引擎 (getWatermarkData)
    // =================================================================

    /** 核心方法：测量与绘制内容流 */
    private async _processLayout(ctx: CanvasRenderingContext2D, ratio: number, isDrawing: boolean = false) {
        const items: WatermarkContentItem[] = typeof this.options.content === "string"
            ? [{ text: this.options.content, rowGap: 0 }]
            : this.options.content;

        let totalW = 0, totalH = 0, currentLineW = 0, currentLineH = 0;
        let cursorX = 0, cursorY = 0;

        for (const item of items) {
            let itemW = 0, itemH = 0;

            if ("text" in item) {
                const fSize = (item.fontSize || this.options.fontSize) * ratio;
                ctx.font = `${item.fontWeight || this.options.fontWeight} ${fSize}px ${item.fontFamily || this.options.fontFamily}`;
                const lines = item.text.split("\n");
                let maxL = 0;
                lines.forEach(l => (maxL = Math.max(maxL, ctx.measureText(l).width)));
                itemW = maxL;
                itemH = lines.length * fSize * 1.2;

                if (isDrawing) {
                    ctx.save();
                    ctx.fillStyle = item.fontColor || this.options.fontColor;
                    ctx.translate(cursorX + itemW / 2, cursorY + itemH / 2);
                    if (item.rotate) ctx.rotate((item.rotate * Math.PI) / 180);
                    lines.forEach((l, i) => {
                        const y = (i - (lines.length - 1) / 2) * (fSize * 1.2);
                        ctx.fillText(l, 0, y);
                    });
                    ctx.restore();
                }
            } else if ("image" in item) {
                const img = await this._loadImage(item.image);
                itemW = (item.width || 50) * ratio;
                itemH = (item.height || 50) * ratio;
                if (isDrawing) {
                    ctx.save();
                    ctx.translate(cursorX + itemW / 2, cursorY + itemH / 2);
                    if (item.rotate) ctx.rotate((item.rotate * Math.PI) / 180);
                    ctx.drawImage(img, -itemW / 2, -itemH / 2, itemW, itemH);
                    ctx.restore();
                }
            }

            const rGap = (item.rowGap ?? 0) * ratio;
            // 换行逻辑判断：rGap > 0 或者是最后一个元素
            if (rGap > 0 || items.indexOf(item) === items.length - 1) {
                currentLineW = Math.max(currentLineW, cursorX + itemW);
                currentLineH = Math.max(currentLineH, itemH);
                totalW = Math.max(totalW, currentLineW);
                const lineFullH = currentLineH;
                totalH += lineFullH;

                if (isDrawing) {
                    cursorX = 0;
                    cursorY = totalH + rGap;
                }
                if (items.indexOf(item) !== items.length - 1) totalH += rGap;
            } else {
                // 水平排列
                currentLineW = cursorX + itemW;
                currentLineH = Math.max(currentLineH, itemH);
                if (isDrawing) cursorX += itemW + (10 * ratio); // 默认微小字符间距
            }
        }
        return { w: totalW, h: totalH };
    }

    /** 获取水印 Canvas 数据 */
    public async getWatermarkData(): Promise<{ base64: string; size: [number, number] }> {
        const ratio = window.devicePixelRatio || 1;
        const tempCanvas = document.createElement("canvas");
        const contentSize = await this._processLayout(tempCanvas.getContext("2d")!, ratio, false);

        const { rotate, gap, layout } = this.options;
        const isRepeat = layout === "repeat";
        const [gx, gy] = gap as [number, number];
        const angle = (rotate * Math.PI) / 180;

        // 计算旋转后的画布宽高 (Bounding Box)
        const canvasW = (Math.abs(Math.cos(angle) * contentSize.w) + Math.abs(Math.sin(angle) * contentSize.h)) + (isRepeat ? gx * ratio : 0);
        const canvasH = (Math.abs(Math.sin(angle) * contentSize.w) + Math.abs(Math.cos(angle) * contentSize.h)) + (isRepeat ? gy * ratio : 0);

        const canvas = document.createElement("canvas");
        canvas.width = canvasW; canvas.height = canvasH;
        const ctx = canvas.getContext("2d")!;

        ctx.translate(canvasW / 2, canvasH / 2);
        ctx.rotate(angle);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.translate(-contentSize.w / 2, -contentSize.h / 2); // 居中内容起始点
        await this._processLayout(ctx, ratio, true);

        return { base64: canvas.toDataURL(), size: [canvasW / ratio, canvasH / ratio] };
    }

    /** 渲染方法：确保 100% 覆盖容器 */
    public async render() {
        if (!this.container) return;
        this.stopMonitor();

        const { base64, size } = await this.getWatermarkData();
        const { id, zIndex, layout, offset } = this.options;

        let el = this.container.querySelector(`#${id}`) as HTMLElement;
        console.log(this.container)
        if (!el) {
            el = document.createElement("div");
            el.id = id;
            // 关键：确保水印 DOM 铺满 el 且不响应鼠标
            el.style.cssText = `
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        pointer-events: none;
        z-index: ${zIndex};
        display: block;
      `;
            this.container.appendChild(el);
            this.watermarkDom = el;
        }

        const [ox, oy] = offset as [number, number];
        const posMap: any = {
            lt: `${ox}px ${oy}px`,
            rt: `calc(100% - ${ox}px) ${oy}px`,
            lb: `${ox}px calc(100% - ${oy}px)`,
            rb: `calc(100% - ${ox}px) calc(100% - ${oy}px)`,
            center: "center"
        };

        const isRepeat = layout === "repeat";
        Object.assign(el.style, {
            backgroundImage: `url(${base64})`,
            backgroundSize: `${size[0]}px ${size[1]}px`,
            backgroundRepeat: isRepeat ? "repeat" : "no-repeat",
            backgroundPosition: isRepeat ? "0 0" : posMap[layout] || "center"
        });

        if (this.options.monitor) this.startMonitor();
    }

    // =================================================================
    // 3. 辅助功能 (容器检查、图片加载、监控)
    // =================================================================

    private _updateOptions(opts: Partial<WatermarkOptions>) {
        Object.assign(this.options, opts);
        if (opts.gap !== undefined) this.options.gap = Array.isArray(opts.gap) ? opts.gap : [opts.gap, opts.gap];
        if (opts.offset !== undefined) this.options.offset = Array.isArray(opts.offset) ? opts.offset : [opts.offset, opts.offset];
    }

    private _resolveContainer(el?: string | HTMLElement): HTMLElement {
        const target = typeof el === "string" ? document.querySelector(el) : el;
        return (target || document.body || document.documentElement) as HTMLElement;
    }

    /** 强制容器成为定位基准 */
    private _ensureContainerPosition() {
        if (!this.container || this.container === document.body || this.container === document.documentElement) return;
        const style = window.getComputedStyle(this.container);
        // 如果是 static，为了覆盖 el，必须改为 relative 或使用 contain
        if (style.position === "static") {
            this.container.style.position = "relative";
        }
    }

    private _loadImage(src: string): Promise<HTMLImageElement> {
        if (this._imgCache.has(src)) return Promise.resolve(this._imgCache.get(src)!);
        return new Promise((res, rej) => {
            const img = new Image(); img.crossOrigin = "anonymous";
            img.onload = () => { this._imgCache.set(src, img); res(img); };
            img.onerror = rej; img.src = src;
        });
    }

    public startMonitor() {
        this.stopMonitor();
        this.observer = new MutationObserver((ms) => {
            let reload = ms.some(m => (m.type === 'childList' && Array.from(m.removedNodes).includes(this.watermarkDom!)) || (m.target === this.watermarkDom));
            if (reload) this.render();
        });
        this.observer.observe(this.container!, { childList: true, attributes: true, subtree: true });
    }

    public stopMonitor() { this.observer?.disconnect(); this.observer = null; }

    private startResizeObserver() {
        this.resizeObserver = new ResizeObserver(() => {
            // 检查水印是否还在，不在则重绘
            if (!this.container?.querySelector(`#${this.options.id}`)) this.render();
        });
        this.resizeObserver.observe(this.container!);
    }
}

export default new Watermark();