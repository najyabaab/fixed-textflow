import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import path from 'path';
import manifest from './src/manifest';

export default defineConfig({
    plugins: [
        react(),
        crx({ manifest }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    build: {
        outDir: 'dist',
    },
    server: {
        port: 5173,
        strictPort: true,
        hmr: {
            port: 5173,
        },
    },
});
