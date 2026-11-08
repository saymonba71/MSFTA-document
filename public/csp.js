/* ISOE runtime CSP. Default local-only; consented AI origins (Settings) are added here.
   Loaded as a blocking classic script before the app so the policy applies to all app requests. */
(function () {
  try {
    var allowed = JSON.parse(localStorage.getItem("isoe-csp-origins") || "[]");
    var origins = (Array.isArray(allowed) ? allowed : []).filter(function (o) {
      return typeof o === "string" && (/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(o) || /^http:\/\/localhost(?::\d+)?$/.test(o));
    });
    var meta = document.createElement("meta");
    meta.httpEquiv = "Content-Security-Policy";
    meta.content = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self' blob: data:" + (origins.length ? " " + origins.join(" ") : "") + "; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'";
    document.head.appendChild(meta);
  } catch (e) { /* storage unavailable */ }
})();
