import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Standalone test config: no @crxjs plugin (it needs a browser build context).
// Default environment is node (Node 22 WebCrypto has Ed25519); component tests opt in
// to jsdom with a `// @vitest-environment jsdom` docblock.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/main.tsx", "src/**/*.html"],
      reporter: ["text-summary", "text"],
    },
  },
});
