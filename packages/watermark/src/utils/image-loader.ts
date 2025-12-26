export class ImageLoader {
  private cache = new Map<string, HTMLImageElement>();

  public async load(src: string | Blob | File): Promise<HTMLImageElement> {
    let url: string;

    // 1. 处理 Blob 或 File 对象
    if ((typeof Blob !== 'undefined' && src instanceof Blob) || (typeof File !== 'undefined' && src instanceof File)) {
      url = URL.createObjectURL(src);
    } else {
      url = src as string; // 此时是 string (URL 或 Base64)
    }

    // 2. 检查缓存 (仅针对 URL 字符串，Blob URL 通常是一次性的或者需要手动释放，这里简化处理)
    // 注意：Base64 字符串作为 key 会很长，但作为缓存 key 是有效的。
    if (typeof src === 'string' && this.cache.has(src)) {
      return this.cache.get(src)!;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      // 如果是 base64 数据，不需要 crossOrigin
      if (typeof url === 'string' && !url.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }

      img.onload = () => {
        // 如果是 URL 字符串，存入缓存
        if (typeof src === 'string') {
          this.cache.set(src, img);
        }
        // 如果是 Blob URL，加载完后可以释放内存，但为了后续渲染可能需要保留。
        // 这里简单起见，不立即 revoke，依赖垃圾回收或页面关闭。
        resolve(img);
      };

      img.onerror = (e) => {
        console.error('Watermark image load failed:', url);
        reject(e);
      };

      img.src = url;
    });
  }
}

export const imageLoader = new ImageLoader();
