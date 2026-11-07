import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { allTools, findTools, type ToolDef } from "../core/registry";
import { initI18n, useI18n, setLang, type Lang } from "../core/i18n";
import { purgeTrash, getAll, type StoredProject, type StoredExport } from "../core/storage/db";
import { consumeSharedFile, setPendingFile, setPendingOpen } from "../core/project/inbox";
import { canInstall, promptInstall } from "../core/pwa";
import { Spinner, Button } from "./primitives";

type Theme = "light" | "dark" | "system";
function applyTheme(t: Theme) { const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches); document.documentElement.dataset.theme = dark ? "dark" : "light"; }
const cache = new Map<string, ReturnType<typeof lazy>>();
function comp(t: ToolDef) { let c = cache.get(t.id); if (!c) { c = lazy(t.component); cache.set(t.id, c); } return c; }

export default function Studio() {
  const [route, setRoute] = useState(() => location.hash.replace(/^#\/studio\/?/, "") || "home");
  const [lang, setL] = useState<Lang>(() => (localStorage.getItem("isoe-lang") as Lang) || "bn");
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("isoe-theme") as Theme) || "system");
  const [palette, setPalette] = useState(false);
  const [q, setQ] = useState("");
  const [more, setMore] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [opened, setOpened] = useState<{ tool: string; data?: unknown } | null>(null);
  const [installable, setInstallable] = useState(canInstall());
  const [update, setUpdate] = useState<ServiceWorker | null>(null);
  const [shortcuts, setShortcuts] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => { initI18n(lang); }, [lang]);
  useEffect(() => {
    applyTheme(theme); localStorage.setItem("isoe-theme", theme);
    const mq = matchMedia("(prefers-color-scheme: dark)"); const fn = () => theme === "system" && applyTheme("system");
    mq.addEventListener("change", fn); return () => mq.removeEventListener("change", fn);
  }, [theme]);
  useEffect(() => {
    const ins = () => setInstallable(true);
    const upd = (e: Event) => setUpdate((e as CustomEvent<ServiceWorker>).detail);
    window.addEventListener("isoe-installable", ins); window.addEventListener("isoe-sw-update", upd);
    void consumeSharedFile().then((f) => { if (!f) return; setPendingFile(f); const tool = f.type === "application/pdf" ? "pdf.studio" : "image.studio"; location.hash = `#/studio/${tool}`; setRoute(tool); setToast(`শেয়ার করা ফাইল: ${f.name}`); });
    return () => { window.removeEventListener("isoe-installable", ins); window.removeEventListener("isoe-sw-update", upd); };
  }, []);
  useEffect(() => {
    const fn = () => setRoute(location.hash.replace(/^#\/studio\/?/, "") || "home");
    window.addEventListener("hashchange", fn);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    void purgeTrash();
    return () => { window.removeEventListener("hashchange", fn); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  const go = useCallback((id: string) => { location.hash = id === "home" ? "#/studio" : `#/studio/${id}`; setRoute(id); setPalette(false); setMore(false); setQ(""); }, []);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
      if (e.key === "Escape") { setPalette(false); setMore(false); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); window.dispatchEvent(new CustomEvent("isoe-save")); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") { e.preventDefault(); window.dispatchEvent(new CustomEvent("isoe-export")); }
      const editable = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target instanceof HTMLElement && e.target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !editable) { e.preventDefault(); window.dispatchEvent(new CustomEvent(e.shiftKey ? "isoe-redo" : "isoe-undo")); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y" && !editable) { e.preventDefault(); window.dispatchEvent(new CustomEvent("isoe-redo")); }
      if (e.key === "?" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) setShortcuts(true);
    };
    window.addEventListener("keydown", fn); return () => window.removeEventListener("keydown", fn);
  }, []);

  const tools = allTools();
  const tool = tools.find((t) => t.id === route);
  const t = useI18n();
  const results = useMemo(() => findTools(q, lang), [q, lang]);
  const C = tool ? comp(tool) : null;
  const bottom = ["pdf.studio", "image.studio", "seal.studio", "signature.studio"];
  const openProject = (id: string, data?: unknown) => { setOpened({ tool: id, data }); if (data !== undefined) setPendingOpen(id, data); go(id); setTimeout(() => window.dispatchEvent(new CustomEvent("isoe:open", { detail: { tool: id, data } })), 50); };

  return <div className="iso-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
    <a className="iso-skip" href="#iso-main">Skip to content</a>
    <header className="iso-top">
      <button className="iso-brand" onClick={() => go("home")} aria-label={t("home")}><span aria-hidden>⭕</span> <b>ISOE Studio</b></button>
      <button className="iso-search" onClick={() => setPalette(true)} aria-label={`${t("search")} (Ctrl+K)`}>🔍 {t("search")} <kbd>Ctrl K</kbd></button>
      <div className="iso-top-actions">
        <span className={`iso-badge ${online ? "is-done" : "is-error"}`} title={t("localOnly")}>{online ? "● online" : "○ offline"}</span>
        <select aria-label="Language" className="iso-input iso-lang" value={lang} onChange={(e) => { setL(e.target.value as Lang); setLang(e.target.value as Lang); }}><option value="bn">বাংলা</option><option value="en">English</option><option value="ar">العربية</option></select>
        <button className="iso-icon-btn" aria-label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}>{theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "🖥️"}</button>
        {installable && <Button variant="primary" onClick={() => void promptInstall().then((ok) => ok && setInstallable(false))}>Install</Button>}
        <a className="iso-btn iso-btn-ghost" href="#/" onClick={() => { location.hash = ""; }}>{t("legacy")}</a>
      </div>
    </header>
    <div className="iso-body">
      <nav className="iso-nav" aria-label="Modules">
        <button className={`iso-nav-item ${route === "home" ? "is-active" : ""}`} onClick={() => go("home")}><span>🏠</span>{t("home")}</button>
        {tools.map((x) => <button key={x.id} className={`iso-nav-item ${route === x.id ? "is-active" : ""}`} onClick={() => go(x.id)} aria-current={route === x.id ? "page" : undefined}><span aria-hidden>{x.icon}</span>{x.title[lang]}</button>)}
      </nav>
      <main id="iso-main" className="iso-main" tabIndex={-1}>
        {tool && C
          ? <Suspense fallback={<Spinner />}><div key={tool.id}>{tool.id === "projects" ? <ProjectsRoute onOpen={openProject} /> : <C />}</div></Suspense>
          : <Home go={go} lang={lang} onOpen={openProject} />}
        {opened && opened.tool === route && <p className="iso-muted" data-testid="opened-project">প্রজেক্ট লোড হচ্ছে… সমর্থিত মডিউলে (Document/Seal/Engineering) স্বয়ংক্রিয়ভাবে বসবে; অন্যথায় Import/Open ব্যবহার করুন।</p>}
      </main>
    </div>
    <nav className="iso-bottom" aria-label="Mobile">
      {bottom.map((id) => { const x = tools.find((z) => z.id === id)!; return <button key={id} className={route === id ? "is-active" : ""} onClick={() => go(id)}><span>{x.icon}</span><small>{x.title[lang].split(" ")[0]}</small></button>; })}
      <button className={more ? "is-active" : ""} onClick={() => setMore(true)}><span>☰</span><small>{t("more")}</small></button>
    </nav>
    {more && <div className="iso-modal" role="dialog" aria-modal="true" onClick={() => setMore(false)}><div className="iso-sheet" onClick={(e) => e.stopPropagation()}><h2>{t("all")}</h2><div className="iso-cards">{tools.map((x) => <button key={x.id} className="iso-card iso-tool" onClick={() => go(x.id)} data-testid={`tool-${x.id}`}><span>{x.icon}</span>{x.title[lang]}</button>)}</div><Button onClick={() => setMore(false)}>{t("close")}</Button></div></div>}
    {toast && <div className="iso-toast" role="status">{toast} <Button variant="ghost" onClick={() => setToast("")}>×</Button></div>}
    {update && <div className="iso-toast" role="status">আপডেট প্রস্তুত <Button variant="primary" onClick={() => { update.postMessage("skip-waiting"); location.reload(); }}>Reload</Button></div>}
    {shortcuts && <div className="iso-modal" role="dialog" aria-modal="true" aria-label="Shortcuts" onClick={() => setShortcuts(false)}><div className="iso-palette" onClick={(e) => e.stopPropagation()}><h2>Keyboard shortcuts</h2><ul className="iso-list"><li>Ctrl/Cmd+K — command palette</li><li>Ctrl/Cmd+S — save</li><li>Ctrl/Cmd+E — export</li><li>Ctrl/Cmd+Z / Y — undo / redo</li><li>? — this list</li><li>Esc — close dialogs</li></ul><Button onClick={() => setShortcuts(false)}>Close</Button></div></div>}
    {palette && <div className="iso-modal" role="dialog" aria-modal="true" aria-label="Command palette" onClick={() => setPalette(false)}>
      <div className="iso-palette" onClick={(e) => e.stopPropagation()}>
        <input autoFocus className="iso-input" placeholder={`${t("search")}… (Esc)`} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && results[0]) go(results[0].id); }} aria-label="Command palette search" data-testid="palette-input" />
        <ul role="listbox">{results.map((x) => <li key={x.id} role="option" aria-selected={false}><button onClick={() => go(x.id)}><span>{x.icon}</span> {x.title[lang]} <small>{x.keywords.slice(0, 3).join(", ")}</small></button></li>)}</ul>
        <p className="iso-muted">Ctrl+K · Ctrl+S save · Esc close</p>
      </div>
    </div>}
  </div>;
}

const ProjectsLazy = lazy(() => import("../modules/projects/Projects"));
function ProjectsRoute({ onOpen }: { onOpen: (tool: string, data?: unknown) => void }) { return <Suspense fallback={<Spinner />}><ProjectsLazy onOpen={onOpen} /></Suspense>; }

function Home({ go, lang, onOpen }: { go: (id: string) => void; lang: Lang; onOpen: (tool: string, data?: unknown) => void }) {
  const tools = allTools(); const t = useI18n();
  const [recents, setRecents] = useState<StoredProject[]>([]);
  const [downloads, setDownloads] = useState<StoredExport[]>([]);
  const [pins, setPins] = useState<string[]>(() => JSON.parse(localStorage.getItem("isoe-pins") || "[]") as string[]);
  const [tour, setTour] = useState(() => !localStorage.getItem("isoe-onboarded"));
  useEffect(() => { void getAll("projects").then((ps) => setRecents(ps.filter((p) => !p.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6))); void getAll("exports").then((es) => setDownloads(es.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5))); }, []);
  const pin = (id: string) => { const next = pins.includes(id) ? pins.filter((x) => x !== id) : [...pins, id]; setPins(next); localStorage.setItem("isoe-pins", JSON.stringify(next)); };
  const openRecent = (p: StoredProject) => { const tool = allTools().find((x) => x.module === p.module)?.id ?? "projects"; onOpen(tool, p.data); };
  return <div className="iso-home">
    {tour && <section className="iso-card" data-testid="onboarding"><h2>স্বাগতম · Welcome</h2><ol><li>ফাইল টেনে আনুন বা “ফাইল খুলুন” — সবকিছু আপনার ডিভাইসেই প্রসেস হয়।</li><li>বাম পাশের মডিউল বা Ctrl+K দিয়ে টুল খুঁজুন।</li><li>কাজ স্বয়ংক্রিয়ভাবে Projects-এ সেভ হয়; Export Center-এ ডাউনলোড ইতিহাস।</li></ol><Button variant="primary" onClick={() => { localStorage.setItem("isoe-onboarded", "1"); setTour(false); }}>শুরু করুন</Button></section>}
    {(recents.length > 0 || downloads.length > 0) && <div className="iso-grid-2"><section className="iso-card"><h2>{t("recent")} projects</h2>{recents.length === 0 ? <p className="iso-muted">{t("none")}</p> : <ul className="iso-list">{recents.map((p) => <li key={p.id}><button className="iso-click" onClick={() => openRecent(p)}>{p.name} <small>· {p.module} · {new Date(p.updatedAt).toLocaleString()}</small></button></li>)}</ul>}</section><section className="iso-card"><h2>{t("recent")} downloads</h2>{downloads.length === 0 ? <p className="iso-muted">{t("none")}</p> : <ul className="iso-list">{downloads.map((d) => <li key={d.id}>{d.filename} <small>· {new Date(d.createdAt).toLocaleString()}</small></li>)}</ul>}</section></div>}
    {pins.length > 0 && <section className="iso-card"><h2>{t("favorites")}</h2><div className="iso-row">{pins.map((id) => { const x = tools.find((z) => z.id === id); return x ? <Button key={id} onClick={() => go(id)}>{x.icon} {x.title[lang]}</Button> : null; })}</div></section>}
    <section className="iso-hero"><h1>Image Seal Overlay Editor · Studio v2</h1><p>{t("localOnly")} · {t("offline")} · বাংলা / English / العربية</p>
      <div className="iso-row"><Button variant="primary" onClick={() => go("pdf.studio")}>📄 {t("openFile")}</Button><Button onClick={() => go("seal.studio")}>⭕ Seal Studio</Button><Button onClick={() => go("prompt.studio")}>✨ Prompt Studio</Button></div>
    </section>
    <h2>{t("all")} modules</h2>
    <div className="iso-cards iso-home-grid">{tools.map((x) => <div key={x.id} className="iso-card iso-tool-wrap"><button className="iso-tool" onClick={() => go(x.id)} data-testid={`tool-${x.id}`}><span className="iso-tool-icon" aria-hidden>{x.icon}</span><b>{x.title[lang]}</b><small>{x.offline ? t("offline") : "Cloud opt-in"}</small></button><button className="iso-pin" aria-label={`Pin ${x.title.en}`} aria-pressed={pins.includes(x.id)} onClick={() => pin(x.id)}>{pins.includes(x.id) ? "★" : "☆"}</button></div>)}</div>
    <section className="iso-card"><h2>Privacy &amp; safety</h2><ul>
      <li>ফাইল ডিভাইসেই থাকে; সব প্রসেসিং ব্রাউজারে (WASM/Workers)। AI Cloud ডিফল্টে বন্ধ।</li>
      <li>সরকারি-ধাঁচের সিলে ডিফল্ট SAMPLE/নমুনা ওয়াটারমার্ক (টগলযোগ্য); আসল সরকারি প্রতীক নয়।</li>
      <li>ইঞ্জিনিয়ারিং সিল ডিজাইন-মাত্র; লাইসেন্স যাচাই করে না। PDF পাসওয়ার্ড শুধু সঠিক পাসওয়ার্ড দিয়েই খোলে।</li>
      <li>ভিজ্যুয়াল স্বাক্ষর ≠ ডিজিটাল স্বাক্ষর; সার্টিফিকেট-ভিত্তিক সাইনিং আলাদা ট্যাবে।</li>
    </ul></section>
  </div>;
}
