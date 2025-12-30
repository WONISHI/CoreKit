# @purekit/watermark

A lightweight, high-performance frontend watermark SDK supporting complex text and image layouts. Features include tamper protection (via MutationObserver), multi-line text, image watermarks, and a flexible Flexbox-like layout strategy.

## Translations
- [中文文档](https://github.com/WONISHI/purekit/blob/master/packages/watermark/README_zh.md)

## 📦 Installation

### npm

```shell
  npm install @purekit/watermark
```

### pnpm

```shell
  pnpm add @purekit/watermark
```

### yarn

```shell
yarn add @purekit/watermark
```

# 🚀 Quick Start

1. Basic Usage
Supports passing a string or an array directly (for automatic line wrapping).

```typescript
import Watermark from '@purekit/watermark';

// Single line text
Watermark.apply("Confidential Internal Data");

// Multi-line text (automatically centered vertically)
Watermark.apply(["Top Secret", "Do Not Distribute", "2023-10-01"]);
```

2. Advanced Configuration
Use a configuration object to control styles, rotation, and spacing.

```js
Watermark.apply({
   content: "User: 10086",
   rotate: -25,
   fontColor: "rgba(200, 0, 0, 0.15)",
   fontSize: 20,
   zIndex: 9999
});
```

3. 🔥 Complex Layouts (Core Feature)
Supports a Flexbox-like layout system that allows for infinite nesting to achieve complex mixed text and image arrangements.

```js
Watermark.apply({
  layout: 'repeat',
  gap: [40, 40], // Gap between watermark tiles
  content: {
    type: 'group',
    layout: 'row', // Horizontal layout: Image left, Text right
    gap: 15,       // Gap between items in this group
    items: [
      // Left: Image
      {
        type: 'image',
        image: 'https://example.com/logo.png',
        width: 30,
        height: 30
      },
      // Right: Vertical Text Group
      {
        type: 'group',
        layout: 'column', // Vertical layout
        gap: 5,
        items: [
          { type: 'text', text: 'Internal Data', fontSize: 16, fontWeight: 'bold' },
          { type: 'text', text: 'UID: 9527', fontSize: 12, fontColor: '#666' }
        ]
      }
    ]
  }
});
```

📚 API Documentation
Global Configuration (WatermarkOptions)

| Property | Type | Default | Description |
|------|------|--------|------|
| content | `string \| any[] \| object` | — | Watermark content. Supports string, array, or a full config object. |
| el | `string \| HTMLElement` | `document.body` | The container to mount the watermark. Supports CSS selector or DOM element. |
| width | `number` | `auto` | Width of a single watermark tile. |
| height | `number` | `auto` | Height of a single watermark tile. |
| rotate | `number` | `-20` | Rotation angle (in degrees). |
| gap | `[number, number]` | `[100, 100]` | Spacing between tiles in X / Y directions. |
| offset | `[number, number]` | `[20, 20]` | Offset of the watermark relative to the top-left corner of the container. |
| layout | `'repeat' \| 'center' \| 'rb'` | `'repeat'` | Layout mode: repeat (tiled), center, or rb (bottom-right). |
| zIndex | `number` | `9999` | The CSS z-index of the watermark layer. |
| monitor | `boolean` | `true` | Enable tamper protection (uses MutationObserver). |
| fontColor | `string` | `'rgba(0,0,0,0.15)'` | Global default font color. |
| fontSize | `number` | `16` | Global default font size (px). |

**Content Node Structure**

When content is an object, it supports the following three node types:

1. Text Node (type: 'text')

| Property | Description |
|------|------|
| text | Text content. Supports \n or <br> for line breaks (converts to a Column Group automatically). |
| fontSize | Font size. |
| fontColor | Font color. |
| fontWeight | Font weight (bold / normal). |

2. Image Node (type: 'image')

| Property | Description |
|------|------|
| image | Image URL or Base64 string. |
| width | Render width of the image. |
| height | Render height of the image. |

3. Group Node (type: 'group')

| Property | Description |
|------|------|
| layout | Layout direction: row (horizontal) or column (vertical). |
| items | Array of child nodes (Array<Node>). |
| gap | Spacing between items in the group (children inherit this gap automatically). |

## ⚠️ Important Notes
1. SSR Compatibility: When using with Next.js or Nuxt.js, ensure Watermark.apply is called inside onMounted or useEffect to avoid server-side execution errors involving document.
2. Positioning: If you specify a specific container via el, ensure that container has position: relative set (the component will attempt to set this, but explicit declaration is recommended).
3. Security Disclaimer: Frontend watermarks primarily serve as a deterrent. They cannot completely prevent removal via advanced technical means (e.g., manual DOM manipulation or request interception).