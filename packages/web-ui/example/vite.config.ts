import tailwindcss from "@tailwindcss/vite";
import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Plugin to serve the Pi server connection file
function piServerPlugin() {
	return {
		name: "pi-server-connection",
		configureServer(server: any) {
			server.middlewares.use((req: any, res: any, next: any) => {
				if (req.url === "/.pi-server.json") {
					// Look for connection file in web-ui package root (where npm run dev:remote runs)
					const connectionFile = resolve(__dirname, "../.pi-server.json");
					if (existsSync(connectionFile)) {
						const content = readFileSync(connectionFile, "utf-8");
						res.setHeader("Content-Type", "application/json");
						res.end(content);
					} else {
						res.statusCode = 404;
						res.end(JSON.stringify({ error: "Pi server not running" }));
					}
					return;
				}
				next();
			});
		},
	};
}

export default defineConfig({
	plugins: [tailwindcss(), piServerPlugin()],
	define: {
		// Provide process for Node.js code that uses it
		"process.env": "{}",
		process: JSON.stringify({ env: {} }),
	},
	resolve: {
		alias: {
			// Stub out Node.js modules for browser - these providers won't work but the app will load
			"node:crypto": resolve(__dirname, "src/stubs/crypto.ts"),
			"node:os": resolve(__dirname, "src/stubs/os.ts"),
			"node:fs": resolve(__dirname, "src/stubs/fs.ts"),
			"node:path": resolve(__dirname, "src/stubs/path.ts"),
		},
	},
	optimizeDeps: {
		esbuildOptions: {
			define: {
				global: "globalThis",
			},
		},
	},
});
