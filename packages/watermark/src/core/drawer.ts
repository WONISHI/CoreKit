import type { MeasuredNode, MeasuredGroup, WatermarkOptions } from '../../types';
import { imageLoader } from '../utils/image-loader';

export class CanvasDrawer {
  static async generate(
    layoutTree: MeasuredNode,
    options: WatermarkOptions,
    ratio: number,
  ): Promise<{ base64: string; size: [number, number] }> {
    const { rotate, gap, layout } = options;
    // @ts-ignore
    const [gx, gy] = (Array.isArray(gap) ? gap : [gap, gap] || [100, 100]).map((n) => n * ratio);

    const contentW = layoutTree._renderWidth;
    const contentH = layoutTree._renderHeight;
    const angle = ((rotate || -20) * Math.PI) / 180;

    const canvasW = Math.abs(Math.cos(angle) * contentW) + Math.abs(Math.sin(angle) * contentH) + (layout === 'repeat' ? gx : 0);
    const canvasH = Math.abs(Math.sin(angle) * contentW) + Math.abs(Math.cos(angle) * contentH) + (layout === 'repeat' ? gy : 0);

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d')!;

    // 绘制起点居中
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.rotate(angle);
    ctx.translate(-contentW / 2, -contentH / 2);

    await this._drawRecursive(ctx, layoutTree);

    return { base64: canvas.toDataURL(), size: [canvasW / ratio, canvasH / ratio] };
  }

  private static async _drawRecursive(ctx: CanvasRenderingContext2D, node: MeasuredNode | MeasuredGroup, x = 0, y = 0) {
    ctx.save();

    // 处理局部旋转
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
      ctx.textBaseline = 'top';
      ctx.fillText(node.text, x, y + (node._renderHeight - parseInt(ctx.font)) / 2 + 2);
    } else if (node.type === 'image') {
      // 从缓存取图片
      const img = await imageLoader.load(node.image);
      ctx.drawImage(img, x, y, node._renderWidth, node._renderHeight);
    } else if (node.type === 'group') {
      let currentX = x;
      let currentY = y;
      const isRow = node.layout === 'row';

      for (const item of node.items) {
        let itemX = currentX;
        let itemY = currentY;

        // Flex 居中对齐逻辑
        if (isRow) {
          itemY = y + (node._renderHeight - item._renderHeight) / 2;
        } else {
          itemX = x + (node._renderWidth - item._renderWidth) / 2;
        }

        await this._drawRecursive(ctx, item, itemX, itemY);

        if (isRow) currentX += item._renderWidth + (node._gap || 0);
        else currentY += item._renderHeight + (node._gap || 0);
      }
    }
    ctx.restore();
  }
}
