import { baseConfig } from '@corekit/rollup-config';

export default {
  ...baseConfig, // 展开基础配置
  input: "src/index.js",
  output: [
    { file: "dist/index.js", format: "cjs" },
    { file: "dist/index.mjs", format: "es" },
  ],
};
