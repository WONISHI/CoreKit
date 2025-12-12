/**
 * @typedef {Object} WatermarkOptions
 * @property {string|HTMLElement} [el=document.body] - 水印挂载的父容器
 * @property {string} [id='watermark-layer'] - 水印元素的ID
 * @property {string} [text='侵权必究'] - 水印文字
 * @property {number} [fontSize=16] - 字体大小
 * @property {number} [gap=100] - 水印间距
 * @property {string} [fontFamily='sans-serif'] - 字体
 * @property {string} [fontColor='rgba(0, 0, 0, 0.15)'] - 字体颜色
 * @property {number} [rotate=-20] - 旋转角度
 * @property {number} [zIndex=9999] - 层级
 * @property {boolean} [monitor=true] - 是否开启防篡改监控
 */

class Watermark {
    constructor() {
        this.options = {
            id: 'watermark-layer',
            text: '侵权必究',
            fontSize: 16,
            gap: 100,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontColor: 'rgba(0, 0, 0, 0.15)',
            rotate: -20,
            zIndex: 9999,
            monitor: true
        };
        this.container = null;
        this.watermarkDom = null;
        this.observer = null;
        this.resizeObserver = null;
    }

    /**
     * 初始化
     * @param {WatermarkOptions} options 
     */
    apply(options = {}) {
        // 1. 合并配置
        this.options = { ...this.options, ...options };
        
        // 2. 确定挂载容器
        if (options.el) {
            this.container = typeof options.el === 'string' ? document.querySelector(options.el) : options.el;
        } else {
            this.container = document.body;
        }

        if (!this.container) {
            console.error('Watermark: Mount element not found.');
            return;
        }

        // 3. 强制容器定位（如果不是 body），确保绝对定位生效
        const computedStyle = window.getComputedStyle(this.container);
        if (this.container !== document.body && computedStyle.position === 'static') {
            this.container.style.position = 'relative';
        }

        // 4. 渲染水印
        this.render();

        // 5. 启动监控
        if (this.options.monitor) {
            this.startMonitor();
        }

        // 6. 启动尺寸监听 (替代 window resize)
        this.startResizeObserver();

        return this;
    }

    /**
     * 生成水印背景图 (Canvas)
     */
    createBase64() {
        const { text, fontSize, fontFamily, fontColor, rotate, gap } = this.options;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const ratio = window.devicePixelRatio || 1;

        // 计算文字宽度
        ctx.font = `${fontSize * ratio}px ${fontFamily}`;
        const textWidth = ctx.measureText(text).width;
        
        // 计算画布大小 (利用三角函数避免旋转裁剪，简化算法取较大值)
        // 简单策略：画布尺寸 = 文本宽 + 间距，旋转不会出界太大即可
        const canvasSize = Math.max(textWidth, 100) + gap * ratio;
        
        canvas.width = canvasSize;
        canvas.height = canvasSize;

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((Math.PI / 180) * rotate);
        
        ctx.font = `${fontSize * ratio}px ${fontFamily}`;
        ctx.fillStyle = fontColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 0, 0);

        return {
            base64: canvas.toDataURL(),
            size: canvasSize / ratio // 样式使用的逻辑像素大小
        };
    }

    /**
     * 渲染/更新水印元素
     */
    render() {
        const { base64, size } = this.createBase64();
        const { id, zIndex } = this.options;

        // 暂停观察器，防止自己修改触发回调
        this.stopMonitor();

        // 如果已存在，直接移除旧的（简单粗暴，确保样式最新）
        const existing = this.container.querySelector(`#${id}`);
        if (existing) {
            this.container.removeChild(existing);
        }

        this.watermarkDom = document.createElement('div');
        this.watermarkDom.id = id;
        
        const style = {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none', // 关键：点击穿透
            zIndex: zIndex,
            backgroundImage: `url(${base64})`,
            backgroundSize: `${size}px ${size}px`,
            backgroundRepeat: 'repeat',
            inset: '0'
        };

        Object.assign(this.watermarkDom.style, style);
        this.container.appendChild(this.watermarkDom);

        // 恢复观察器
        if (this.options.monitor) {
            this.startMonitor();
        }
    }

    /**
     * MutationObserver 防篡改监控
     */
    startMonitor() {
        if (this.observer) return;

        this.observer = new MutationObserver((mutations) => {
            let needRender = false;
            mutations.forEach((mutation) => {
                // 1. 监测水印节点被删除
                if (mutation.type === 'childList') {
                    mutation.removedNodes.forEach((node) => {
                        if (node === this.watermarkDom) {
                            needRender = true;
                        }
                    });
                }
                // 2. 监测水印节点属性被修改 (如 display: none, opacity: 0)
                if (mutation.type === 'attributes' && mutation.target === this.watermarkDom) {
                    needRender = true;
                }
            });

            if (needRender) {
                // 防抖处理，避免频繁触发
                if (this._debounceRender) clearTimeout(this._debounceRender);
                this._debounceRender = setTimeout(() => {
                    console.warn('Watermark tampered, restoring...');
                    this.render();
                }, 100); // 100ms 延迟
            }
        });

        this.observer.observe(this.container, {
            childList: true,
            attributes: true,
            subtree: true,
            attributeFilter: ['style', 'class', 'hidden'] // 只监听可能隐藏水印的属性
        });
    }

    stopMonitor() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }

    /**
     * 使用 ResizeObserver 监听容器大小变化
     */
    startResizeObserver() {
        if (this.resizeObserver) return;
        
        // 当容器大小变化时，实际上如果是 background-repeat，通常不需要重绘
        // 但如果水印依赖容器的具体宽高计算（当前逻辑不需要），或者防止某些布局错乱，可以保留
        // 这里主要用于处理容器从隐藏变为显示等边界情况
        this.resizeObserver = new ResizeObserver(() => {
             // 检查水印是否还在（处理某些极端DOM操作情况）
             if (!this.container.querySelector(`#${this.options.id}`)) {
                 this.render();
             }
        });
        
        this.resizeObserver.observe(this.container);
    }

    /**
     * 导出图片
     */
    downloadImage(fileName = 'watermark.png') {
        const { base64 } = this.createBase64();
        const link = document.createElement('a');
        link.href = base64;
        link.download = fileName;
        link.click();
    }

    /**
     * 销毁水印实例
     */
    destroy() {
        this.stopMonitor();
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.watermarkDom && this.container.contains(this.watermarkDom)) {
            this.container.removeChild(this.watermarkDom);
        }
        this.watermarkDom = null;
    }
}

let instance = null;

const watermarkInstance = {
    apply: (options) => {
        if (!instance) {
            instance = new Watermark();
        }
        return instance.apply(options);
    },
    remove: () => {
        if (instance) instance.destroy();
    },
    // 如果你需要暴露实例
    getInstance: () => {
        if (!instance) instance = new Watermark();
        return instance;
    }
};

export default watermarkInstance;