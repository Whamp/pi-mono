import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

export default defineConfig({
	plugins: [
        tailwindcss(),
        nodePolyfills({
            include: ['crypto', 'http', 'https', 'stream', 'util', 'url', 'buffer', 'process'],
            globals: {
                Buffer: true,
                global: true,
                process: true,
            },
        })
    ],
    resolve: {
        alias: {
            "node:fs": path.resolve(__dirname, 'src/mocks/fs.ts'),
            "node:os": path.resolve(__dirname, 'src/mocks/os.ts'),
            "node:path": path.resolve(__dirname, 'src/mocks/path.ts'),
            "vm": path.resolve(__dirname, 'src/mocks/vm.ts'),
            "node:vm": path.resolve(__dirname, 'src/mocks/vm.ts'),
        }
    },
    esbuild: {
        target: "es2022",
        tsconfigRaw: {
            compilerOptions: {
                experimentalDecorators: true,
                useDefineForClassFields: false
            }
        }
    },
    build: {
        target: "es2022"
    }
});
