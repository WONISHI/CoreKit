import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from '@rollup/plugin-terser';
import dts from "rollup-plugin-dts";

/**
 * 创建 Rollup 配置
 * @param {Object} options 自定义选项
 * @param {string} options.input 入口文件，默认为 "src/index.ts"
 */
export function createConfig(options = {}) {
  const input = options.input || "src/index.ts";
  const dist = "dist";

  // 1. 定义默认输出 (CJS + ESM)
  const defaultOutput = [
    {
      file: `${dist}/index.js`,
      format: "cjs",
    },
    {
      file: `${dist}/index.mjs`,
      format: "es",
    },
  ];

  // 2. 决定最终使用哪个 Output (优先用传入的，否则用默认的)
  let finalOutput = options.output || defaultOutput;

  // 3. 【关键】强制处理 sourcemap: false
  if (!Array.isArray(finalOutput)) {
    finalOutput = [finalOutput];
  }
  finalOutput = finalOutput.map((item) => ({
    ...item,
    sourcemap: false,
  }));

  const jsConfig = {
    input,
    output: finalOutput, // 使用处理后的 output
    external: (id) => /node_modules/.test(id),
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
      }),
      // terser({
      //   format: { comments: false },
      //   compress: {
      //     drop_console: false,
      //     drop_debugger: true,
      //     pure_funcs: ["console.log", "console.info", "console.debug"],
      //   },
      // }),
    ],
  };

  const dtsConfig = {
    input,
    output: [{ file: `${dist}/index.d.ts`, format: "es" }],
    plugins: [dts()],
  };

  return [jsConfig, dtsConfig];
}