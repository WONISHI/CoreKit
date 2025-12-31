/** @type {import('ts-jest').JestConfigWithTsJest} */
const path = require('path');

module.exports = {
  // 1. 使用 jsdom 环境
  testEnvironment: 'jsdom',

  rootDir: path.resolve(__dirname),

  // 2. 关键：在测试启动前加载 canvas 模拟环境
  // 这会给 window 对象挂载假的 Canvas API，解决 getContext 为 null 的问题
  setupFiles: ['jest-canvas-mock'],

  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // 3. 修复警告：新版配置写法
        // 开启隔离模式，跳过类型检查，提升速度
        isolatedModules: true,
        tsconfig: {
          lib: ['dom', 'es2017', 'esnext'],
          target: 'esnext',
          esModuleInterop: true,
        },
      },
    ],
  },

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/packages/watermark/src/$1',
  },

  modulePathIgnorePatterns: ['<rootDir>/dist/'],
};
