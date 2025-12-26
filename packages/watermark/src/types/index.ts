export type LayoutMode = 'repeat' | 'lt' | 'rt' | 'lb' | 'rb' | 'center';
export type ContentLayoutMode = 'row' | 'column';
export type WatermarkImageType = string | Blob | File;

export interface BaseContent {
  rotate?: number;
}

export interface WatermarkText extends BaseContent {
  type: 'text';
  text: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontFamily?: string;
  fontColor?: string;
}

export interface WatermarkImage extends BaseContent {
  type: 'image';
  image: WatermarkImageType;
  width?: number;
  height?: number;
}

export interface WatermarkGroup extends BaseContent {
  type: 'group';
  layout: ContentLayoutMode;
  gap?: number;
  items: WatermarkContent[];
}

export type WatermarkContent = WatermarkText | WatermarkImage | WatermarkGroup;

export interface WatermarkCanvasDrawerRusult {
  base64: string;
  size: [number, number];
}

export interface WatermarkOptions {
  id?: string;
  el?: string | HTMLElement;
  content?: string | string[] | WatermarkContent;
  fontSize?: number;
  fontWeight?: string | number;
  fontFamily?: string;
  fontColor?: string;
  rotate?: number;
  zIndex?: number;
  monitor?: boolean;
  layout?: LayoutMode;
  gap?: [number, number] | number;
  offset?: [number, number] | number;
}

// ==========================================
// 内部计算用的类型 (Measure 后的结果)
// ==========================================

export interface MeasuredBase {
  _renderWidth: number;
  _renderHeight: number;
}

export type MeasuredNode =
  | (WatermarkText & MeasuredBase & { _font?: string; _color?: string })
  | (WatermarkImage & MeasuredBase)
  | MeasuredGroup;

export interface MeasuredGroup extends WatermarkGroup, MeasuredBase {
  items: MeasuredNode[];
  _gap?: number;
}
