// packages/scroll-observer.js/rollup.config.mjs
import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from '@rollup/plugin-terser';

export const baseConfig = {
  // 入口文件
  input: "src/index.ts",
  output: [
    {
      file: "dist/index.js",
      format: "cjs",
      sourcemap: true,
    },
    {
      file: "dist/index.mjs",
      format: "es",
      sourcemap: true,
    },
  ],
  plugins: [
    resolve(),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: true,
      declarationDir: "dist",
    }),
    terser({
      format: {
        // 移除所有注释 (包括 /**! ... */ 这种版权注释也移除)
        comments: false,
      },
      compress: {
        // (可选) 移除所有 console.log，生产环境建议开启
        drop_console: true,
        // (可选) 移除 debugger
        drop_debugger: true,
      },
    }),
  ],
};
