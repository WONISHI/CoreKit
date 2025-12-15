/**
 * 监听元素是否进入视口并进行初始化
 */
class VisibilityObserver {
  constructor(elOrSelector, options = {}) {
    this.io = null
    this.mo = null
    this.initialized = false
    this.el = null
    this.options = options
    
    if (typeof elOrSelector === 'string') {
      this.selector = elOrSelector
      this._waitForElement()
    } else {
      this.el = elOrSelector
      this._startObserve(this.el)
    }
  }

  // 等待元素渲染到 DOM 中
  _waitForElement() {
    const tryFind = () => document.querySelector(this.selector)
    const el = tryFind()
    
    if (el) {
      this.el = el
      this._startObserve(el)
      return
    }

    // 观察 DOM 变化
    this.mo = new MutationObserver((mutations, obs) => {
      const el = tryFind()
      if (el) {
        this.el = el
        this._startObserve(el)
        obs.disconnect()
        this.mo = null
      }
    })

    // 监听 body 变化 (注意：开销较大)
    this.mo.observe(document.body, { childList: true, subtree: true })
  }

  // 开始 IntersectionObserver 监听
  _startObserve(el) {
    if (!el) {
      console.warn('[VisibilityObserver] Element not found.')
      return
    }

    const { root = null, rootMargin = '0px', threshold = 0 } = this.options
    
    // threshold 默认为 0，只要露头就触发，防止元素过高永远无法达到 1
    // 如果 options 强行指定了 1，则保留 1
    const safeThreshold = this.options.threshold !== undefined ? this.options.threshold : 0.1

    this.io = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !this.initialized) {
            this.initialized = true
            this.options.onInit?.(el)
            observer.unobserve(el)
            this.disconnect() // 初始化完成后，彻底断开连接
          }
        })
      },
      { threshold: safeThreshold, root, rootMargin }
    )
    
    this.io.observe(el)
  }

  disconnect() {
    this.io?.disconnect()
    this.mo?.disconnect()
    this.io = null
    this.mo = null
  }
}

/**
 * 监听滚动容器内的子元素，判断哪个元素处于“焦点区域”
 */
export class ScrollObserver {
  constructor(el, options) {
    this.el = null // 容器元素
    this.options = options
    this._rafId = null
    this._handleScroll = this._handleScroll.bind(this) // 绑定上下文

    // 使用 VisibilityObserver 确保容器存在后再初始化滚动监听
    this._visibilityOb = new VisibilityObserver(el, {
      ...options,
      // 当容器进入视口时，开始初始化内部逻辑
      onInit: (targetEl) => {
        this.el = targetEl
        this.options.onInit?.()
        this._init()
      }
    })
  }

  // 获取所有需要监听的子组件
  get listenComponents() {
    if (!this.options.selectors) return []
    // 如果 selector 限定在容器内查找，使用 this.el.querySelectorAll
    return Array.from(this.el.querySelectorAll(this.options.selectors))
  }

  // 计算目标“焦点线”相对于容器顶部的百分比位置 (0 ~ 1)
  get targetRatio() {
    // 默认分为 [45, 10, 45]，中间 10% 为焦点区
    const layers = this.options.layered?.length ? this.options.layered : [45, 10, 45]
    const startIndex = this.options.startIndex !== undefined ? this.options.startIndex : Math.floor(layers.length / 2)
    const centerCoordinate = this.options.centerCoordinate || 'center' // top, bottom, center

    // 计算 startIndex 之前所有层的高度总和
    let offsetPercent = 0
    for (let i = 0; i < startIndex; i++) {
      offsetPercent += layers[i]
    }
    
    const currentLayerPercent = layers[startIndex]

    // 确定焦点线在当前 Layer 中的位置
    let addition = 0
    if (centerCoordinate === 'bottom') {
      addition = currentLayerPercent
    } else if (centerCoordinate === 'center' || centerCoordinate === undefined) {
      addition = currentLayerPercent / 2
    }
    // 'top' 时 addition 为 0

    return (offsetPercent + addition) / 100
  }

  get scrollEl() {
    if (this.options.scrollEl) {
      return typeof this.options.scrollEl === 'string' 
        ? document.querySelector(this.options.scrollEl) 
        : this.options.scrollEl
    }
    return this.el
  }

  /**
   * 核心滚动处理逻辑
   */
  _handleScroll() {
    if (!this.el) return

    // 1. 获取容器的几何信息
    const containerRect = this.el.getBoundingClientRect()
    // 2. 计算“焦点线”在视口中的绝对 Y 坐标
    // 例如：容器顶部坐标 + (容器高度 * 0.5) = 容器中心线坐标
    const targetLineY = containerRect.top + (containerRect.height * this.targetRatio)

    const items = this.listenComponents
    let closestItem = null
    let minDistance = Infinity

    // 3. 遍历子元素，寻找离焦点线最近的元素
    items.forEach((item, index) => {
      const itemRect = item.getBoundingClientRect()
      
      // 获取子元素的参照点（默认取子元素中心）
      // 如果你希望子元素的顶部对齐焦点线，这里算 top
      const itemCenterY = itemRect.top + itemRect.height / 2
      
      const distance = Math.abs(targetLineY - itemCenterY)

      if (distance < minDistance) {
        minDistance = distance
        closestItem = { el: item, index }
      }
    })

    // 4. 触发回调
    if (closestItem && this.options.onScrollCenter) {
      // 只有当最近的元素发生变化时才触发？根据需求，这里是每次滚动都触发最近的
      this.options.onScrollCenter(closestItem)
    }
  }

  // 使用 requestAnimationFrame 优化滚动性能
  _onScrollOrResize() {
    if (this._rafId) cancelAnimationFrame(this._rafId)
    this._rafId = requestAnimationFrame(this._handleScroll)
  }

  _init() {
    if (!this.listenComponents.length) return

    const scrollContainer = this.scrollEl || window
    
    // 初始化时先计算一次
    this._handleScroll()

    // 绑定事件
    const handler = () => this._onScrollOrResize()
    scrollContainer.addEventListener('scroll', handler, { passive: true })
    window.addEventListener('resize', handler)

    // 保存清理函数
    this._cleanupListener = () => {
      scrollContainer.removeEventListener('scroll', handler)
      window.removeEventListener('resize', handler)
      if (this._rafId) cancelAnimationFrame(this._rafId)
    }
  }

  // 销毁实例
  unobserve() {
    this._cleanupListener && this._cleanupListener()
    this._visibilityOb?.disconnect() // 修正原代码的 .distance() 错误
    this.el = null
  }
}