import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  // 将 src 作为 Vite root，这样 HTML 输出路径为 sidepanel/index.html（对应 manifest.json）
  root: resolve(__dirname, 'src'),
  plugins: [
    react(),
    // 将 manifest.json 复制到 dist 根目录
    viteStaticCopy({
      targets: [
        {
          src: resolve(__dirname, 'manifest.json'),
          dest: '.',
        },
      ],
    }),
  ],
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // SidePanel HTML 入口（相对于 root=src）
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        // Background service worker 入口
        'background/index': resolve(__dirname, 'src/background/index.ts'),
        // Content script 入口
        'content/index': resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        // 每个入口输出为独立文件，不做代码分割
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background/index') return 'background/index.js';
          if (chunkInfo.name === 'content/index') return 'content/index.js';
          // sidepanel 的 JS 放到 sidepanel 目录
          return 'sidepanel/[name]-[hash].js';
        },
        chunkFileNames: 'sidepanel/chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return 'sidepanel/[name]-[hash][extname]';
          return 'assets/[name]-[hash][extname]';
        },
        // 禁止代码分割，保证 content/background 为单文件
        manualChunks: undefined,
      },
    },
  },
});
