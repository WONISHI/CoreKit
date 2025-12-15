import { createConfig } from "@purekit/rollup-config";

export default createConfig({
  input: "src/index.ts",
  output: [
    { file: "dist/index.js", format: "cjs" },
    { file: "dist/index.mjs", format: "es" },
    {
      file: "dist/index.umd.js",
      format: "umd",
      name: "Watermark",
    },
    {
      file: "dist/index.global.js",
      format: "iife",
      name: "Watermark",
    },
  ],
});
