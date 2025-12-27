import {defineConfig} from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: '/',
  title: 'purekit',
  description: '一个轻量、纯净的前端多包工具库',
  head: [['link', {rel: 'icon', href: '/logo.svg'}]],
  themeConfig: {
    logo: './logo.svg',
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      {text: 'watermark', link: '/'},
      {text: 'scroll-observer', link: '/markdown-examples'},
    ],

    sidebar: {
      '/packages/watermark/':
        [
          {
            text: '目录',
            items: [
              {text: '安装', link: '/packages/watermark/安装'},
              {text: '调用方式', link: '/packages/watermark/调用方式'},
              {text: '参数', link: '/packages/watermark/参数'},
              {text: '方法', link: '/packages/watermark/方法'}
            ]
          }
        ],

      '/packages/scroll-observer/':
        [
          {
            text: '目录',
            items: [
              {text: '安装', link: '/packages/scroll-observer/安装'},
              {text: 'API', link: '/packages/scroll-observer/api'}
            ]
          }
        ]
    },

    socialLinks: [{icon: 'github', link: 'https://github.com/vuejs/vitepress'}],
  },
})
;
