import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

// MV3 manifest. The custom X-BWOC-* signing headers make every request to bwocd
// CORS-non-simple, so bwocd must be started with --cors-origin chrome-extension://<id>
// (see README). host_permissions covers the loopback daemon; the tailnet host is
// requested narrowly at options time via optional_host_permissions.
export default defineManifest({
  manifest_version: 3,
  name: "BWOC Control",
  version: pkg.version,
  description: pkg.description,
  minimum_chrome_version: "137", // WebCrypto Ed25519
  permissions: ["storage", "sidePanel"],
  host_permissions: ["http://127.0.0.1:10130/*"],
  optional_host_permissions: ["https://*/*"],
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  side_panel: { default_path: "src/sidepanel/index.html" },
  action: { default_title: "BWOC Control", default_popup: "src/popup/index.html" },
  options_page: "src/options/index.html",
  icons: { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" },
  // To pin a stable extension id (so bwocd's --cors-origin is fixed), add a
  // "key" here — see README "Pinning the extension ID".
});
