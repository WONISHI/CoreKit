// packages/rollup-config/index.mjs
import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from '@rollup/plugin-terser';
import dts from "rollup-plugin-dts"; // 记得 pnpm add -D -w rollup-plugin-dts

/**
 * 创建 Rollup 配置
 * @param {Object} options 自定义选项
 * @param {string} options.input 入口文件，默认为 "src/index.ts"
 */
export function createConfig(options = {}) {
  const input = options.input || "src/index.ts";
  const dist = "dist";

  // --- 任务 1: 打包 JS (CJS + ESM) ---
  const jsConfig = {
    input,
    output: [
      {
        file: `${dist}/index.js`,
        format: "cjs",
        sourcemap: true,
      },
      {
        file: `${dist}/index.mjs`,
        format: "es",
        sourcemap: true,
      },
    ],
    // 自动将 package.json 中的依赖排除，防止打包进去
    external: (id) => /node_modules/.test(id),
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: "./tsconfig.json",
        // 【重点 1】这里必须设为 false！
        // 因为我们会用下面的 dtsConfig 专门打包类型，
        // 如果这里是 true，会生成一堆零散的 .d.ts 文件，这就冲突了。
        declaration: false, 
      }),
      terser({
        format: {
          comments: false,
        },
        compress: {
          drop_console: false,
          drop_debugger: true,
          // 保留你的配置：只移除 log/info/debug，保留 warn/error
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
        },
      }),
    ],
  };

  // --- 任务 2: 打包类型 (合并为 index.d.ts) ---
  const dtsConfig = {
    input,
    output: [
      {
        file: `${dist}/index.d.ts`,
        format: "es",
      },
    ],
    plugins: [
      dts(), // 【重点 2】使用 dts 插件合并类型
    ],
  };

  // 返回数组，Rollup 会依次执行这两个任务
  return [jsConfig, dtsConfig];
}