import type { WatermarkContent, WatermarkOptions, MeasuredNode, MeasuredGroup, WatermarkText } from '../../types';
import { imageLoader } from '../utils/image-loader';

export class LayoutEngine {
  /** 1. 预加载资源 */
  static async preload(node: WatermarkContent): Promise<void> {
    if (node.type === 'image') {
      await imageLoader.load(node.image);
    } else if (node.type === 'group') {
      await Promise.all(node.items.map((item) => this.preload(item)));
    }
  }

  /** 2. 标准化输入 (处理 \n 和字符串) */
  static normalize(content: string | WatermarkContent): WatermarkContent {
    if (typeof content === 'string') {
      return this._normalizeText(content);
    }
    if (content.type === 'text') {
      return this._normalizeText(content.text, content);
    } else if (content.type === 'group') {
      return {
        ...content,
        items: content.items.map((item) => this.normalize(item)),
      };
    }
    return content;
  }

  private static _normalizeText(text: string, style?: Partial<WatermarkText>): WatermarkContent {
    const rawText = text.replace(/<br\/?>/g, '\n');
    if (!rawText.includes('\n')) {
      return { type: 'text', text: rawText, ...style } as WatermarkText;
    }
    const lines = rawText.split('\n');
    return {
      type: 'group',
      layout: 'column',
      gap: 4,
      items: lines.map((line) => ({
        type: 'text',
        text: line,
        ...style,
      })),
    } as any;
  }

  /** 3. 测量尺寸 */
  static measure(ctx: CanvasRenderingContext2D, node: WatermarkContent, globalOptions: WatermarkOptions, ratio: number): MeasuredNode {
    if (node.type === 'text') {
      const fontSize = (node.fontSize || globalOptions.fontSize || 16) * ratio;
      /**
       * ctx.font 的几种组合
       * 1. 字号 字体
       * 2. 加粗 + 字号 + 字体   ctx.font = 'bold 20px Arial'; √
       * 3. 斜体 + 字号 + 字体   ctx.font = 'italic 20px Arial';
       * 4. 变体 + 字号 + 字体   ctx.font = 'small-caps 20px Arial';
       * 5. 加粗 + 斜体 + 字号 + 字体  ctx.font = 'bold italic 20px Arial'; 或者 italic bold 20px Arial
       * 6. 斜体 + 变体 + 加粗 + 字号 + 字体
       */
      const font = `${node.fontWeight || globalOptions.fontWeight || 'normal'} ${fontSize}px ${
        node.fontFamily || globalOptions.fontFamily || 'sans-serif'
      }`;
      ctx.font = font;
      // 获取文字的宽度
      const metrics = ctx.measureText(node.text);
      return {
        ...node,
        _renderWidth: metrics.width,
        _renderHeight: fontSize * 1.2,
        _font: font,
        _color: node.fontColor || globalOptions.fontColor,
      };
    } else if (node.type === 'image') {
      return {
        ...node,
        _renderWidth: (node.width || 50) * ratio,
        _renderHeight: (node.height || 50) * ratio,
      };
    } else if (node.type === 'group') {
      const measuredItems = node.items.map((item) => this.measure(ctx, item, globalOptions, ratio));
      const gap = (node.gap || 0) * ratio;
      let totalW = 0,
        totalH = 0;

      if (node.layout === 'row') {
        totalW = measuredItems.reduce((acc, item) => acc + item._renderWidth, 0) + (measuredItems.length - 1) * gap;
        totalH = Math.max(...measuredItems.map((i) => i._renderHeight));
      } else {
        totalW = Math.max(...measuredItems.map((i) => i._renderWidth));
        totalH = measuredItems.reduce((acc, item) => acc + item._renderHeight, 0) + (measuredItems.length - 1) * gap;
      }

      return {
        ...node,
        items: measuredItems,
        _renderWidth: totalW,
        _renderHeight: totalH,
        _gap: gap,
      } as MeasuredGroup;
    }

    // Fix: 防止 never 类型报错
    return { ...(node as any), _renderWidth: 0, _renderHeight: 0 };
  }
}
