// Minimal service worker. Signing + API calls happen in the UI pages (which share
// the extension origin, IndexedDB, and the non-extractable key), so the worker only
// wires up the side panel and ensures an identity exists on install.

import { ensureIdentity } from "./signer";

chrome.runtime.onInstalled.addListener(() => {
  // Generate the controller keypair eagerly so the options page can show the
  // public key immediately.
  ensureIdentity().catch((e) => console.error("identity init failed", e));
  // Clicking the toolbar icon opens the popup (manifest action); the popup's
  // button opens the side panel via chrome.sidePanel.open().
  chrome.sidePanel.setPanelBehavior?.({ openPanelOnActionClick: false }).catch(() => {});
});
