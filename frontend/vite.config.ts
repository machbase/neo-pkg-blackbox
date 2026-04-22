import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __dirname = dirname(fileURLToPath(import.meta.url));

const entries: Record<string, string> = {
    index: resolve(__dirname, "index.html"),
    main: resolve(__dirname, "main.html"),
    side: resolve(__dirname, "side.html"),
};

const entry = process.env.VITE_ENTRY || "index";

const apiPrefix = process.env.VITE_API_PREFIX || "";

export default defineConfig({
    define: {
        __API_PREFIX__: JSON.stringify(apiPrefix),
    },
    plugins: [react(), tailwindcss(), viteSingleFile()],
    build: {
        rollupOptions: {
            input: entries[entry],
        },
        emptyOutDir: entry === "index",
    },
    server: {
        host: true,
        port: 5173,
        proxy: {
            "/public/neo-pkg-blackbox": "http://127.0.0.1:5654",
        },
        // proxy: {
        //     "/api": `http://192.168.0.87:8000`,
        //     "/db": `http://192.168.0.87:8000`,
        //     "/web": `http://192.168.0.87:8000`, // echart 등 정적 파일
        // },
    },
});
