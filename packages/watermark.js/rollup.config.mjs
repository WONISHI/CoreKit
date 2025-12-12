import { baseConfig } from '@corekit/rollup-config';

export default {
  ...baseConfig, // 展开基础配置
  input: 'src/index.js',
  output: [
    { file: 'dist/index.js', format: 'cjs' },
    { file: 'dist/index.mjs', format: 'es' },
    { 
      file: 'dist/index.umd.js', 
      format: 'umd',
      name: 'Watermark',
    },
    {
      file: 'dist/index.global.js',
      format: 'iife',
      name: 'Watermark'
    }
  ]
};