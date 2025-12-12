class VisibilityObserver {
  constructor(elOrSelector, options = {}) {
    this.io = null
    this.mo = null
    this.initialized = false
    this.selector = null
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

  // 等待元素出现
  _waitForElement() {
    const tryFind = () => document.querySelector(this.selector)
    const el = tryFind()
    if (el) {
      this.el = el
      this._startObserve(el)
      return
    }
    this.mo = new MutationObserver(() => {
      const el = tryFind()
      if (el) {
        this.el = el
        this._startObserve(el)
        this.mo && this.mo.disconnect()
        this.mo = null
      }
    })
    this.mo.observe(document.body, { childList: true, subtree: true })
  }

  // 开始监听
  _startObserve(el) {
    if (!el) {
      console.warn('[ScrollObserver] element not found, skip observe')
      return
    }
    const root = this.options.root || null
    const rootMargin = this.options.rootMargin || '0px'
    this.io = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          // 必须完全进入可视区域才触发
          if (entry.intersectionRatio === 1 && !this.initialized) {
            this.initialized = true
            this.options.onInit && this.options.onInit(el)
            observer.unobserve(el) // 只触发一次
          }
        })
      },
      { threshold: Math.min(this.options.threshold || 1, 1), root, rootMargin }
    )
    this.io.observe(el)
  }

  // 手动断开
  disconnect() {
    this.io && this.io.disconnect()
    this.mo && this.mo.disconnect()
    this.io = null
    this.mo = null
  }
}

export class ScrollObserver {
  _ob = null
  _unob = null
  constructor(el, options) {
    this.options = options
    this._ob = new VisibilityObserver(el, {
      ...options,
      onInit: (el) => {
        this.el = el
        this.options.onInit && this.options.onInit()
        this._init()
      }
    })
  }

  get layered() {
    const layered = []
    const _layered = !this.options.layered?.length ? [45, 10, 45] : this.options.layered
    _layered.reduce((acc, cur) => {
      const item = Math.min(cur, acc)
      layered.push(item)
      acc += item
      return acc
    }, 100)
    return layered
  }

  get listenComponents() {
    return document.querySelectorAll(this.options.selectors)
  }

  get containerLayered() {
    const _containerOffset = !this.el ? 0 : this.el.offsetHeight
    if (_containerOffset) {
      return this.layered.reduce((acc, item) => {
        acc.push(Number(((_containerOffset * item) / 100).toFixed(2)))
        return acc
      }, [])
    }
    return !this.el ? [] : this.el.offsetHeight
  }

  get startIndex() {
    return this.options.startIndex || Math.floor(this.layered.length / 2)
  }
  get centerCoordinate() {
    return this.options.centerCoordinate || 'top'
  }
  get scrollEl() {
    return this.options?.scrollEl ? document.querySelector(this.options.scrollEl) : this.el
  }
  observeItemsInContainer(scrollEl, container, items, callback) {
    const that = this
    /**
     * 滚动和resize触发函数
     */
    function handler() {
      const containerCenter = that.containerLayered.reduce((acc, cur, index) => {
        if (that.centerCoordinate === 'top' ? index < that.startIndex : index <= that.startIndex) {
          if (index === that.startIndex) {
            acc += that.centerCoordinate === 'bottom' ? cur : cur / 2
          } else {
            acc += cur
          }
        }
        return acc
      }, 0)
      let closest = null
      const closestDistance = []
      items.forEach((el, index) => {
        const itemCenter = that.getCoordinate(el)
        if (itemCenter - containerCenter > 0 && !closest) {
          closest = closestDistance[closestDistance.length - 1]
        } else {
          closestDistance.push({ el, index })
        }
      })
      if (closest) {
        callback(closest)
      }
    }
    handler()
    scrollEl.addEventListener('scroll', handler, { passive: true })
    window.addEventListener('resize', handler)
    return () => {
      scrollEl.removeEventListener('scroll', handler)
      window.removeEventListener('resize', handler)
    }
  }
  getCoordinate(el) {
    const rect = el.getBoundingClientRect()
    const coordinate = this.centerCoordinate
    return coordinate === 'top' ? rect.top : coordinate === 'bottom' ? rect.top + rect.height : rect.top + rect.height / 2
  }
  _init() {
    if (!this.listenComponents?.length) return
    this._unob = this.observeItemsInContainer(this.scrollEl, this.el, this.listenComponents, (node) => {
      this.options.onScrollCenter && this.options.onScrollCenter(node)
    })
    this.unobserve = () => {
      this._unob()
      this._ob.distance()
    }
  }
}
