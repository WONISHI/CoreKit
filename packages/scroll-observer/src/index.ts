/**
 * 基础配置接口
 */
export interface VisibilityOptions {
  /** 观察器的根元素，默认为视口 (null) */
  root?: HTMLElement | null;
  /** 根元素的边界偏移 */
  rootMargin?: string;
  /** 触发回调的交叉比例阈值 */
  threshold?: number | number[];
  /** 初始化完成后的回调 */
  onInit?: (el: HTMLElement) => void;
}

/**
 * 滚动观察配置接口
 */
export interface ScrollObserverOptions extends VisibilityOptions {
  /** * 子元素的选择器 (必填) 
   * 例如: '.scroll-item' 
   */
  selectors: string;
  
  /** * 容器的分层比例，默认为 [45, 10, 45] 
   * 分别代表：[上方非焦点区, 中间焦点区, 下方非焦点区]
   */
  layered?: number[];
  
  /** * 焦点区所在的层索引，默认为 layered 的中间索引 
   */
  startIndex?: number;
  
  /** * 判定焦点的坐标基准 
   */
  centerCoordinate?: 'top' | 'bottom' | 'center';
  
  /** * 实际滚动的元素选择器或对象
   * 如果不传，默认认为是外层容器 el 在滚动
   */
  scrollEl?: string | HTMLElement | Window;
  
  /** * 滚动并选中中心元素时的回调 
   */
  onScrollCenter?: (item: ScrollEventItem) => void;
}

/**
 * 滚动回调返回的数据结构
 */
export interface ScrollEventItem {
  el: HTMLElement;
  index: number;
}

/**
 * 监听元素是否进入视口并进行初始化
 */
class VisibilityObserver {
  private io: IntersectionObserver | null = null;
  private mo: MutationObserver | null = null;
  private initialized: boolean = false;
  private el: HTMLElement | null = null;
  private selector: string | null = null;
  private options: VisibilityOptions;

  constructor(elOrSelector: string | HTMLElement, options: VisibilityOptions = {}) {
    this.options = options;
    
    if (typeof elOrSelector === 'string') {
      this.selector = elOrSelector;
      this._waitForElement();
    } else {
      this.el = elOrSelector;
      this._startObserve(this.el);
    }
  }

  // 等待元素渲染到 DOM 中
  private _waitForElement(): void {
    if (!this.selector) return;

    const tryFind = (): HTMLElement | null => document.querySelector(this.selector!);
    const el = tryFind();
    
    if (el) {
      this.el = el;
      this._startObserve(el);
      return;
    }

    // 观察 DOM 变化
    this.mo = new MutationObserver((mutations, obs) => {
      const el = tryFind();
      if (el) {
        this.el = el;
        this._startObserve(el);
        obs.disconnect();
        this.mo = null;
      }
    });

    // 监听 body 变化
    this.mo.observe(document.body, { childList: true, subtree: true });
  }

  // 开始 IntersectionObserver 监听
  private _startObserve(el: HTMLElement): void {
    if (!el) {
      console.warn('[VisibilityObserver] Element not found.');
      return;
    }

    const { root = null, rootMargin = '0px' } = this.options;
    
    // threshold 默认为 0.1，只要露头就触发
    const safeThreshold = this.options.threshold !== undefined ? this.options.threshold : 0.1;

    this.io = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !this.initialized) {
            this.initialized = true;
            this.options.onInit?.(el);
            observer.unobserve(el);
            this.disconnect(); // 初始化完成后，彻底断开连接
          }
        });
      },
      { threshold: safeThreshold, root, rootMargin }
    );
    
    this.io.observe(el);
  }

  public disconnect(): void {
    this.io?.disconnect();
    this.mo?.disconnect();
    this.io = null;
    this.mo = null;
  }
}

/**
 * 监听滚动容器内的子元素，判断哪个元素处于“焦点区域”
 */
export class ScrollObserver {
  private el: HTMLElement | null = null; // 容器元素
  private options: ScrollObserverOptions;
  private _rafId: number | null = null;
  private _visibilityOb: VisibilityObserver;
  private _cleanupListener: (() => void) | null = null;

  constructor(el: string | HTMLElement, options: ScrollObserverOptions) {
    this.options = options;
    this._handleScroll = this._handleScroll.bind(this); // 绑定上下文

    // 使用 VisibilityObserver 确保容器存在后再初始化滚动监听
    this._visibilityOb = new VisibilityObserver(el, {
      ...options,
      // 当容器进入视口时，开始初始化内部逻辑
      onInit: (targetEl: HTMLElement) => {
        this.el = targetEl;
        this.options.onInit?.(targetEl);
        this._init();
      }
    });
  }

  // 获取所有需要监听的子组件
  private get listenComponents(): HTMLElement[] {
    if (!this.el || !this.options.selectors) return [];
    // 强制转换为 HTMLElement 数组
    return Array.from(this.el.querySelectorAll(this.options.selectors)) as HTMLElement[];
  }

  // 计算目标“焦点线”相对于容器顶部的百分比位置 (0 ~ 1)
  private get targetRatio(): number {
    // 默认分为 [45, 10, 45]，中间 10% 为焦点区
    const layers = this.options.layered?.length ? this.options.layered : [45, 10, 45];
    const startIndex = this.options.startIndex !== undefined ? this.options.startIndex : Math.floor(layers.length / 2);
    const centerCoordinate = this.options.centerCoordinate || 'center';

    // 计算 startIndex 之前所有层的高度总和
    let offsetPercent = 0;
    for (let i = 0; i < startIndex; i++) {
      offsetPercent += layers[i];
    }
    
    const currentLayerPercent = layers[startIndex];

    // 确定焦点线在当前 Layer 中的位置
    let addition = 0;
    if (centerCoordinate === 'bottom') {
      addition = currentLayerPercent;
    } else if (centerCoordinate === 'center') {
      addition = currentLayerPercent / 2;
    }
    // 'top' 时 addition 为 0

    return (offsetPercent + addition) / 100;
  }

  private get scrollEl(): HTMLElement | Window {
    if (this.options.scrollEl) {
      if (typeof this.options.scrollEl === 'string') {
        const el = document.querySelector(this.options.scrollEl);
        return (el as HTMLElement) || window;
      }
      return this.options.scrollEl;
    }
    return this.el || window;
  }

  /**
   * 核心滚动处理逻辑
   */
  private _handleScroll(): void {
    if (!this.el) return;

    // 1. 获取容器的几何信息
    const containerRect = this.el.getBoundingClientRect();
    // 2. 计算“焦点线”在视口中的绝对 Y 坐标
    const targetLineY = containerRect.top + (containerRect.height * this.targetRatio);

    const items = this.listenComponents;
    let closestItem: ScrollEventItem | null = null;
    let minDistance = Infinity;

    // 3. 遍历子元素，寻找离焦点线最近的元素
    items.forEach((item, index) => {
      const itemRect = item.getBoundingClientRect();
      
      // 获取子元素的参照点（默认取子元素中心）
      const itemCenterY = itemRect.top + itemRect.height / 2;
      const distance = Math.abs(targetLineY - itemCenterY);

      if (distance < minDistance) {
        minDistance = distance;
        closestItem = { el: item, index };
      }
    });

    // 4. 触发回调
    if (closestItem && this.options.onScrollCenter) {
      this.options.onScrollCenter(closestItem);
    }
  }

  // 使用 requestAnimationFrame 优化滚动性能
  private _onScrollOrResize(): void {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = requestAnimationFrame(this._handleScroll);
  }

  private _init(): void {
    // 此时 this.el 肯定存在
    if (!this.listenComponents.length) return;

    const scrollContainer = this.scrollEl;
    
    // 初始化时先计算一次
    this._handleScroll();

    // 绑定事件
    const handler = () => this._onScrollOrResize();
    scrollContainer.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler);

    // 保存清理函数
    this._cleanupListener = () => {
      scrollContainer.removeEventListener('scroll', handler);
      window.removeEventListener('resize', handler);
      if (this._rafId) cancelAnimationFrame(this._rafId);
    };
  }

  // 销毁实例
  public unobserve(): void {
    this._cleanupListener && this._cleanupListener();
    this._visibilityOb?.disconnect();
    this.el = null;
  }
}