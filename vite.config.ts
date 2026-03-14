import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  const conditionalPlugins = [];
  if (mode === "development") {
    const { componentTagger } = await import("lovable-tagger");
    conditionalPlugins.push(componentTagger());
  }

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    preview: {
      host: "::",
      port: 8080,
      allowedHosts: true as const,
    },
    plugins: [react(), ...conditionalPlugins],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
