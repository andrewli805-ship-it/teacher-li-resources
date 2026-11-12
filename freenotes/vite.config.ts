import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const BASE = "/teacher-li-resources/apps/freenotes/";

export default defineConfig({
  base: BASE,
  build: {
    outDir: "../apps/freenotes",
    emptyOutDir: true,
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      // Keep the worker on this directory so it cannot control homework or gallery.
      scope: BASE,
      includeAssets: [
        "favicon.ico",
        "favicon.svg",
        "apple-touch-icon.png",
        "icons/*.png",
      ],
      manifest: {
        name: "Freenotes",
        short_name: "Freenotes",
        description: "手寫筆記與檔案標註",
        start_url: BASE,
        scope: BASE,
        display: "standalone",
        orientation: "any",
        background_color: "#f7f1e8",
        theme_color: "#2f5d4a",
        lang: "zh-Hant",
        categories: ["productivity", "education"],
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,mjs,woff}"],
        navigateFallback: "index.html",
      },
    }),
  ],
  optimizeDeps: {
    include: ["pdfjs-dist", "idb", "jspdf", "xlsx"],
  },
  worker: {
    format: "es",
  },
});
