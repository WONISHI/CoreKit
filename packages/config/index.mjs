import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';
import alias from '@rollup/plugin-alias';
import path from 'path';

/**
 * 创建 Rollup 配置
 * @param {Object} options 自定义选项
 * @param {string} options.input 入口文件，默认为 "src/index.ts"
 */
export function createConfig(options = {}) {
  const input = options.input || 'src/index.ts';
  const dist = 'dist';

  const projectRoot = process.cwd();

  const defaultOutput = [
    {
      file: `${dist}/index.js`,
      format: 'cjs',
    },
    {
      file: `${dist}/index.mjs`,
      format: 'es',
    },
  ];

  let finalOutput = options.output || defaultOutput;

  if (!Array.isArray(finalOutput)) {
    finalOutput = [finalOutput];
  }
  finalOutput = finalOutput.map((item) => ({
    ...item,
    sourcemap: false,
  }));

  const isMinify = /(build|publish)/.test(process.env.npm_lifecycle_event || '');

  const jsConfig = {
    input,
    output: finalOutput,
    external: (id) => /node_modules/.test(id),
    plugins: [
      alias({
        entries: [
          {
            find: '@',
            replacement: path.resolve(projectRoot, 'src'),
          },
        ],
      }),
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
      isMinify
        ? terser({
            format: { comments: false },
            compress: {
              drop_console: false,
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.info', 'console.debug'],
            },
          })
        : null,
    ],
  };

  const dtsConfig = {
    input,
    output: [{ file: `${dist}/index.d.ts`, format: 'es' }],
    plugins: [dts()],
  };

  return [jsConfig, dtsConfig];
}
