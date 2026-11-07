/** PWA install prompt + service-worker registration/update events. */
let deferredInstall: (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e as typeof deferredInstall; window.dispatchEvent(new Event("isoe-installable")); });
export function canInstall() { return !!deferredInstall; }
export async function promptInstall() { const e = deferredInstall; if (!e) return false; await e.prompt(); const c = await e.userChoice; deferredInstall = null; window.dispatchEvent(new Event("isoe-installable")); return c.outcome === "accepted"; }
export function registerSW() {
  if (!(import.meta.env.PROD && "serviceWorker" in navigator)) return;
  const run = () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      reg.addEventListener("updatefound", () => {
        const w = reg.installing; if (!w) return;
        w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) window.dispatchEvent(new CustomEvent("isoe-sw-update", { detail: w })); });
      });
    }).catch(() => { /* offline caching unavailable */ });
  };
  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
}
