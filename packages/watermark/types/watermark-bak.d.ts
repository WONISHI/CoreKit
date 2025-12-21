export type LayoutMode = 'row' | 'column'; // 对应截图的 "水平方向" | "竖直方向"

export interface BaseContent {
    rotate?: number; // 单独旋转角度
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
    image: string;
    width?: number;  // 图片必须指定宽
    height?: number; // 图片必须指定高
}

export interface WatermarkGroup extends BaseContent {
    type: 'group';
    layout: LayoutMode;
    gap?: number; // 对应截图的 layoutGap
    items: WatermarkContent[]; // 对应截图的 colCotext
}

export type WatermarkContent = WatermarkText | WatermarkImage | WatermarkGroup;

// 更新 Options
export interface WatermarkOptions {
    // ... 其他基础属性 (id, zIndex等) 保持不变
    // content 统一为对象结构，如果是字符串则内部自动转换
    content?: string | WatermarkContent;
}