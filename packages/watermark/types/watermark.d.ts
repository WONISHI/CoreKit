export interface WatermarkContentText {
  /** 文本内容，支持 \n 换行 */
  text: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontFamily?: string;
  fontColor?: string;
  /** 与下一个元素的间隙。0 表示不换行，>0 表示换行并留出间距 */
  rowGap?: number;
  /** 单独旋转角度 */
  rotate?: number;
}

export interface WatermarkContentImage {
  /** 图片地址 */
  image: string;
  width?: number;
  height?: number;
  /** 单独旋转角度 */
  rotate?: number;
  /** 与下一个元素的间隙。0 表示不换行，>0 表示换行并留出间距 */
  rowGap?: number;
}

export type WatermarkContentItem = WatermarkContentText | WatermarkContentImage;

export interface WatermarkOptions {
  /** 挂载容器 */
  el?: string | HTMLElement;
  /** 水印 ID */
  id?: string;
  /** 复合内容配置：支持纯字符串或复合数组 */
  content?: string | WatermarkContentItem[];
  fontSize?: number;
  fontWeight?: string | number;
  fontFamily?: string;
  fontColor?: string;
  /** 整体旋转角度 */
  rotate?: number;
  zIndex?: number;
  /** 防篡改监控 */
  monitor?: boolean;
  /** 布局模式：repeat(平铺), lt, rt, lb, rb, center */
  layout?: "repeat" | "lt" | "rt" | "lb" | "rb" | "center";
  /** 平铺间距 [x, y] */
  gap?: number | [number, number];
  /** 单点偏移 [x, y] */
  offset?: number | [number, number];
}

export type InternalOptions = Required<Omit<WatermarkOptions, "el" | "content">> & {
  el?: string | HTMLElement;
  content: string | WatermarkContentItem[];
};

