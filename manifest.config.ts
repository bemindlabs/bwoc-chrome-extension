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
  // Public half of the pinned RSA-2048 key => stable extension id
  // domnbaocpijnohbchnaoclndapioomgd (see README "Pinning the extension ID").
  // The private key is NOT in this repo.
  key:
    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoeYSIdhbRExdVQIH9DBBuYdrvgyUca0mP7a5NzllI68XqwpwM/OI1ewFZITSx04oaFPzM8Mvrk3Ai2mrGCgFUmzexZqtlec0IoLJP1x3w57bkriua6M5F0F9t87I7fgt7w/8ZV05X6oDkRzQ9qMGBtVPCOZ+ZnaWB+FVs4hC3E22ybi6yU3fgMApNyPEHB4/AkwHHKjnL9qmtp4o+XBCwB44QmSdatcwi9oh/CpPZ/WUUUrp31K6ONM0O7Asn/ObPo2cASsEGwE10GwbEK34lPPD8TMfO2J1I4h48hKgpfVPbdjuaNds+0Kb+XgaGQoY+1B688XD1CWuiskyo6xXdwIDAQAB",
});
