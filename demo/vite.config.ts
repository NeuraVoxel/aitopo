import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { dshWebProxy } from './dsh-web-proxy.ts'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root,
  plugins: [react(), dshWebProxy()],
  server: { port: 5179, open: true },
  resolve: {
    alias: {
      '@neuravoxel/aitopo': path.resolve(root, '../src'),
    },
  },
})
