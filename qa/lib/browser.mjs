/**
 * Gedeelde browserstart voor de controlescripts (Playwright, Chromium uit de lokale cache).
 * In de Claude-sandbox gaat verkeer naar buiten via een proxy; lokale adressen niet.
 */
import { chromium } from "playwright-core";

export async function startBrowser({ proxy = false, extraArgs = [] } = {}) {
  // --single-process: in de macOS-sandbox faalt Chromium anders op bootstrap_check_in. Gevolg: gebruik
  // per browser één pagina tegelijk (meerdere pagina's in één single-process-browser crashen soms).
  const opties = { args: ["--single-process", "--no-sandbox", ...extraArgs] };
  const p = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (proxy && p) {
    const u = new URL(p);
    opties.proxy = { server: `${u.protocol}//${u.host}`, username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) };
  }
  return chromium.launch(opties);
}

export const BASIS = process.env.BASIS || "http://localhost:4610";
export const ROUTES = ["/", "/aanbod/", "/manifest/", "/over-mij/", "/contact/", "/privacy/"];
export const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
