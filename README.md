# Purekit
一个轻量、高性能、零依赖的 TypeScript DOM 工具库。包含 防篡改水印 和 高性能滚动焦点检测 两个核心模块。

## ✨ 特性 (Features)
### 🛡️ Watermark (水印)
零侵入布局：不强制修改父容器 position，智能使用 contain: paint 锁定水印，兼容性与安全性并存。

多重防御：内置 MutationObserver，防止水印节点被手动删除、隐藏或修改样式。

Canvas 渲染：使用 Canvas 生成背景图，性能高，支持旋转、自定义颜色、字体等。

灵活调用：支持字符串简写、指定容器或完整配置对象三种调用方式。

### 👁️ ScrollObserver (滚动监听)
懒初始化：利用 IntersectionObserver，仅当容器进入视口后才启动滚动监听，节省资源。

高性能：滚动事件采用 requestAnimationFrame 节流，拒绝卡顿。

焦点线检测：支持自定义“焦点区域”（如屏幕中间 10%），精准识别当前激活的子元素。

TypeScript：全类型支持，开发体验友好。
