import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        // 仅排除纯 barrel 文件（只有 export 语句的 index.ts）
        'src/index.ts',
        'src/enums/index.ts',
      ],
    },
  },
});
