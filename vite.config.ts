import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
      },
      manifest: {
        name: "MuzixHub",
        short_name: "MuzixHub",
        description: "Stream Music Your Way",
        theme_color: "#0f0f14",
        background_color: "#0f0f14",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "/MuzixHub Logo.jpeg",
            sizes: "192x192",
            type: "image/jpeg",
          },
          {
            src: "/MuzixHub Logo.jpeg",
            sizes: "512x512",
            type: "image/jpeg",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Force Vite/Rollup to resolve the jsmediatags package to the
      // bundled browser build which avoids package export/main issues.
      // The code imports the package using the full subpath
      // "jsmediatags/dist/jsmediatags.min.js" so map that exact specifier
      // to the real file location to avoid double-appending "dist/...".
      "jsmediatags/dist/jsmediatags.min.js": path.resolve(
        __dirname,
        "node_modules/jsmediatags/dist/jsmediatags.min.js"
      ),
      // keep a fallback alias for plain imports
      "jsmediatags": path.resolve(__dirname, "node_modules/jsmediatags/dist/jsmediatags.min.js"),
    },
  },
}));
