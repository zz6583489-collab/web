import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// Vite discovers styles in lazy routes only after navigation; prebundle those entrypoints once.
const elementStyles = [
  'alert',
  'button',
  'card',
  'date-picker',
  'dialog',
  'drawer',
  'form',
  'form-item',
  'input',
  'option',
  'pagination',
  'progress',
  'select',
  'statistic',
  'table',
  'table-column',
  'timeline',
  'timeline-item',
  'loading',
  'message',
  'message-box',
].map((name) => `element-plus/es/components/${name}/style/css`)

export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [ElementPlusResolver({ directives: false })],
      dts: 'src/components.d.ts',
    }),
  ],
  optimizeDeps: {
    include: ['element-plus/es', ...elementStyles],
  },
  server: {
    proxy: {
      '/api': process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8080',
    },
  },
  test: {
    environment: 'node',
  },
})
