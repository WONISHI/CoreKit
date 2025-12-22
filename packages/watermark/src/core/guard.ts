export class ObserverGuard {
  private observer: MutationObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    private container: HTMLElement,
    private watermarkId: string,
    private onTamper: () => void,
    private onResize: (entry: ResizeObserverEntry) => void,
  ) {}

  start() {
    this.stop();

    // 1. 防篡改监听
    this.observer = new MutationObserver((mutations) => {
      const watermarkDom = this.container.querySelector(`#${this.watermarkId}`);
      const isTampered = mutations.some((m) => {
        // 水印被删除
        const removed = Array.from(m.removedNodes).some((n) => (n as HTMLElement).id === this.watermarkId);
        // 水印属性被修改
        const modified = m.target === watermarkDom;
        return removed || modified;
      });

      if (isTampered) {
        this.onTamper();
      }
    });

    this.observer.observe(this.container, { childList: true, attributes: true, subtree: true });

    // 2. 尺寸变化监听
    this.resizeObserver = new ResizeObserver((entries) => {
      // 如果水印被删了，Resize 不应该负责重建，由 MutationObserver 负责
      // Resize 只负责容器大小变了的时候更新水印尺寸
      if (entries[0]) this.onResize(entries[0]);
    });
    this.resizeObserver.observe(this.container);
  }

  stop() {
    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
    this.observer = null;
    this.resizeObserver = null;
  }
}
