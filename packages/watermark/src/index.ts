import type { WatermarkOptions, WatermarkContent, WatermarkGroup, WatermarkText, WatermarkImage } from '../types/watermark';

class Watermark {
  private options: any = {
    id: 'watermark-layer',
    content: '内部资料',
    fontSize: 16,
    fontWeight: 'normal',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontColor: 'rgba(0, 0, 0, 0.15)',
    rotate: -20,
    zIndex: 9999,
    monitor: true,
    layout: 'repeat',
    gap: [100, 100],
    offset: [20, 20],
  };
  private container: HTMLElement | null = null;
  private watermarkDom: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private _imgCache = new Map<string, HTMLImageElement>();

  // =================================================================
  // 核心逻辑: 获取水印 Base64
  // =================================================================

  public async getWatermarkData(): Promise<{
    base64: string;
    size: [number, number];
  }> {
    const ratio = window.devicePixelRatio || 1;

    // 1. 标准化配置：将用户输入的 string 或简单对象转为严格的 Tree 结构
    const rootContent = this._normalizeContent(this.options.content);

    // 2. 预加载所有图片资源
    await this._preloadImages(rootContent);

    // 3. 测量阶段：递归计算整个布局树的宽高
    // 创建一个临时 ctx 用于测量文本
    const tempCtx = document.createElement('canvas').getContext('2d')!;
    const layoutTree = this._measureLayout(tempCtx, rootContent, ratio);

    // 4. 画布准备
    const { rotate, gap, layout } = this.options;
    const [gx, gy] = (Array.isArray(gap) ? gap : [gap, gap]).map((n: number) => n * ratio);

    // ❌ 错误代码：Group 类型没有 width/height 属性，应该是 _renderWidth
    // const contentW = layoutTree.width;
    // const contentH = layoutTree.height;

    // ✅ 修正代码：使用测量计算出的内部属性 _renderWidth / _renderHeight
    const contentW = layoutTree._renderWidth;
    const contentH = layoutTree._renderHeight;
    const angle = (rotate * Math.PI) / 180;

    const canvasW = Math.abs(Math.cos(angle) * contentW) + Math.abs(Math.sin(angle) * contentH) + (layout === 'repeat' ? gx : 0);
    const canvasH = Math.abs(Math.sin(angle) * contentW) + Math.abs(Math.cos(angle) * contentH) + (layout === 'repeat' ? gy : 0);

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d')!;

    // 5. 绘制阶段
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.rotate(angle);
    // 将原点移动到内容的左上角，开始绘制
    ctx.translate(-contentW / 2, -contentH / 2);

    this._drawLayout(ctx, layoutTree);

    return {
      base64: canvas.toDataURL(),
      size: [canvasW / ratio, canvasH / ratio],
    };
  }

  // =================================================================
  // 辅助逻辑 1: 标准化输入 (处理 \n 和 混合布局)
  // =================================================================

  /** 将用户输入归一化为标准的 WatermarkContent 树 */
  private _normalizeContent(content: string | WatermarkContent): WatermarkContent {
    // 情况 1: 纯字符串 -> 转为 Text 节点 (并在内部处理 \n)
    if (typeof content === 'string') {
      return this._normalizeText(content);
    }

    // 情况 2: 已是对象
    if (content.type === 'text') {
      return this._normalizeText(content.text, content);
    } else if (content.type === 'group') {
      // 递归处理子元素
      return {
        ...content,
        items: content.items.map((item) => this._normalizeContent(item)),
      };
    }

    return content; // Image 类型直接返回
  }

  /** 处理文本中的换行符，将其转换为 Vertical Group */
  private _normalizeText(text: string, style?: Partial<WatermarkText>): WatermarkContent {
    // 替换 <br/> 为 \n
    const rawText = text.replace(/<br\/?>/g, '\n');
    console.log('text', text, style, rawText);
    if (!rawText.includes('\n')) {
      return { type: 'text', text: rawText, ...style };
    }

    // 如果包含换行，拆分为 Group (layout: column)
    const lines = rawText.split('\n');
    return {
      type: 'group',
      layout: 'column',
      gap: 4, // 默认行间距
      items: lines.map((line) => ({
        type: 'text',
        text: line,
        ...style, // 继承父级样式
      })),
    };
  }

  // =================================================================
  // 辅助逻辑 2: 递归预加载图片
  // =================================================================

  private async _preloadImages(node: WatermarkContent) {
    if (node.type === 'image') {
      await this._loadImage(node.image);
    } else if (node.type === 'group') {
      await Promise.all(node.items.map((item) => this._preloadImages(item)));
    }
  }

  // =================================================================
  // 辅助逻辑 3: 递归测量 (Measure)
  // =================================================================

  /** 返回计算好尺寸和偏移量的布局树 */
  private _measureLayout(ctx: CanvasRenderingContext2D, node: WatermarkContent, ratio: number): MeasuredNode {
    const baseStyle = this.options; // 全局默认样式

    if (node.type === 'text') {
      const fontSize = (node.fontSize || baseStyle.fontSize) * ratio;
      const font = `${node.fontWeight || baseStyle.fontWeight} ${fontSize}px ${node.fontFamily || baseStyle.fontFamily}`;
      ctx.font = font;
      const metrics = ctx.measureText(node.text);

      return {
        ...node,
        _renderWidth: metrics.width,
        _renderHeight: fontSize * 1.2, // 近似行高
        _font: font,
        _color: node.fontColor || baseStyle.fontColor,
      };
    } else if (node.type === 'image') {
      return {
        ...node,
        _renderWidth: (node.width || 50) * ratio,
        _renderHeight: (node.height || 50) * ratio,
      };
    } else if (node.type === 'group') {
      const measuredItems = node.items.map((item) => this._measureLayout(ctx, item, ratio));
      const gap = (node.gap || 0) * ratio;
      let totalW = 0,
        totalH = 0;

      if (node.layout === 'row') {
        // 水平布局: 宽累加，高取最大
        totalW = measuredItems.reduce((acc, item) => acc + item._renderWidth, 0) + (measuredItems.length - 1) * gap;
        totalH = Math.max(...measuredItems.map((i) => i._renderHeight));
      } else {
        // 垂直布局: 宽取最大，高累加
        totalW = Math.max(...measuredItems.map((i) => i._renderWidth));
        totalH = measuredItems.reduce((acc, item) => acc + item._renderHeight, 0) + (measuredItems.length - 1) * gap;
      }

      return {
        ...node,
        items: measuredItems, // 将计算后的子节点存回去
        _renderWidth: totalW,
        _renderHeight: totalH,
        _gap: gap,
      } as MeasuredGroup; // 类型断言
    }

    return { ...(node as any), _renderWidth: 0, _renderHeight: 0 };
  }

  // =================================================================
  // 辅助逻辑 4: 递归绘制 (Draw)
  // =================================================================

  private _drawLayout(ctx: CanvasRenderingContext2D, node: MeasuredNode | MeasuredGroup, x: number = 0, y: number = 0) {
    ctx.save();

    // 1. 处理局部旋转 (以元素中心为支点)
    const centerX = x + node._renderWidth / 2;
    const centerY = y + node._renderHeight / 2;
    if (node.rotate) {
      ctx.translate(centerX, centerY);
      ctx.rotate((node.rotate * Math.PI) / 180);
      ctx.translate(-centerX, -centerY);
    }

    if (node.type === 'text') {
      ctx.font = node._font!;
      ctx.fillStyle = node._color!;
      ctx.textBaseline = 'top'; // 统一基线
      ctx.fillText(node.text, x, y + (node._renderHeight - parseInt(ctx.font)) / 2 + 2); // 微调垂直居中
    } else if (node.type === 'image') {
      const img = this._imgCache.get(node.image);
      if (img) {
        ctx.drawImage(img, x, y, node._renderWidth, node._renderHeight);
      }
    } else if (node.type === 'group') {
      let currentX = x;
      let currentY = y;
      const isRow = node.layout === 'row';

      (node as MeasuredGroup).items.forEach((item) => {
        // 居中对齐逻辑 (在当前行/列中居中)
        let itemX = currentX;
        let itemY = currentY;

        if (isRow) {
          // Row 模式下：Y 轴垂直居中
          itemY = y + (node._renderHeight - item._renderHeight) / 2;
        } else {
          // Column 模式下：X 轴水平居中
          itemX = x + (node._renderWidth - item._renderWidth) / 2;
        }

        this._drawLayout(ctx, item, itemX, itemY);

        // 更新游标
        if (isRow) currentX += item._renderWidth + (node as MeasuredGroup)._gap!;
        else currentY += item._renderHeight + (node as MeasuredGroup)._gap!;
      });
    }

    ctx.restore();
  }

  public apply(arg1?: string | WatermarkOptions, arg2?: HTMLElement | string): this {
    if (document.readyState === 'loading' && !document.body) {
      document.addEventListener('DOMContentLoaded', () => this.apply(arg1, arg2));
      return this;
    }

    let opts: WatermarkOptions = {};
    if (typeof arg1 === 'string') {
      opts.content = arg1;
      if (arg2) opts.el = arg2;
    } else if (typeof arg1 === 'object') {
      opts = arg1;
    }

    // 把opts设置到this.options上面去
    this._updateOptions(opts);
    // 获取覆盖的元素
    this.container = this._resolveContainer(opts.el || this.options.el);

    // 关键：确保容器能撑起 absolute 的水印
    this._ensureContainerPosition();
    this.render();

    if (this.options.monitor) this.startMonitor();
    this.startResizeObserver();
    return this;
  }

  /** 渲染方法：确保 100% 覆盖容器 */
  public async render() {
    if (!this.container) return;
    this.stopMonitor();

    const { base64, size } = await this.getWatermarkData();
    const { id, zIndex, layout, offset } = this.options;

    let el = this.container.querySelector(`#${id}`) as HTMLElement;

    if (!el) {
      el = document.createElement('div');
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
      center: 'center',
    };

    const isRepeat = layout === 'repeat';

    Object.assign(el.style, {
      backgroundImage: `url(${base64})`,
      backgroundSize: `${size[0]}px ${size[1]}px`,
      backgroundRepeat: isRepeat ? 'repeat' : 'no-repeat',
      backgroundPosition: isRepeat ? '0 0' : posMap[layout] || 'center',
    });

    if (this.options.monitor) this.startMonitor();
  }

  private _loadImage(src: string): Promise<HTMLImageElement> {
    if (this._imgCache.has(src)) return Promise.resolve(this._imgCache.get(src)!);
    return new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this._imgCache.set(src, img);
        res(img);
      };
      img.onerror = rej;
      img.src = src;
    });
  }

  public startMonitor() {
    this.stopMonitor();
    this.observer = new MutationObserver((ms) => {
      let reload = ms.some(
        (m) => (m.type === 'childList' && Array.from(m.removedNodes).includes(this.watermarkDom!)) || m.target === this.watermarkDom,
      );
      if (reload) this.render();
    });
    this.observer.observe(this.container!, {
      childList: true,
      attributes: true,
      subtree: true,
    });
  }

  public stopMonitor() {
    this.observer?.disconnect();
    this.observer = null;
  }

  private startResizeObserver() {
    this.resizeObserver = new ResizeObserver(() => {
      // 检查水印是否还在，不在则重绘
      if (!this.container?.querySelector(`#${this.options.id}`)) this.render();
    });
    this.resizeObserver.observe(this.container!);
  }

  private _updateOptions(opts: Partial<WatermarkOptions>) {
    Object.assign(this.options, opts);
    if (opts.gap !== undefined) this.options.gap = Array.isArray(opts.gap) ? opts.gap : [opts.gap, opts.gap];
    if (opts.offset !== undefined) this.options.offset = Array.isArray(opts.offset) ? opts.offset : [opts.offset, opts.offset];
  }

  private _resolveContainer(el?: string | HTMLElement): HTMLElement {
    const target = typeof el === 'string' ? document.querySelector(el) : el;
    return (target || document.body || document.documentElement) as HTMLElement;
  }

  /** 强制容器成为定位基准 */
  private _ensureContainerPosition() {
    if (!this.container || this.container === document.body || this.container === document.documentElement) return;
    const style = window.getComputedStyle(this.container);
    // 如果是 static，为了覆盖 el，必须改为 relative 或使用 contain
    if (style.position === 'static') {
      this.container.style.position = 'relative';
    }
  }
}

// 内部使用的类型，包含计算后的尺寸
interface MeasuredBase {
  _renderWidth: number;
  _renderHeight: number;
}
type MeasuredNode = (WatermarkText & MeasuredBase & { _font?: string; _color?: string }) | (WatermarkImage & MeasuredBase) | MeasuredGroup;

interface MeasuredGroup extends WatermarkGroup, MeasuredBase {
  items: MeasuredNode[];
  _gap?: number;
}

export default new Watermark();
