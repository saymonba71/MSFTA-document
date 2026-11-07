import { useEffect, useMemo, useRef, useState } from "react";
import type { Seal } from "../types";
import type { TemplateKind } from "../lib/doc";
import { Icon, Modal } from "./ui";
import { EngineeringModal } from "./EngineeringModal";
import { PdfOrganizer } from "./PdfOrganizer";
import { ImagePdfModal } from "./ImagePdfModal";
import { SealExportModal } from "./SealExportModal";
import { deleteLayout, loadLayouts } from "../lib/layouts";
import { cn } from "../utils/cn";

type Props = {
  seals: Seal[];
  activeSealId: string;
  onPickSeal: (id: string) => void;
  onDeleteSeal: (id: string) => boolean;
  onFile: (files: File[]) => void;
  onSample: (kind?: TemplateKind) => void;
  onAddSeal: (seal: Seal) => void;
  onProject: (file: File) => void;
  onPdfText: (file: File) => void;
  onCustomize: () => void;
  onUploadSeal: () => void;
  loading: string | null;
  error: string | null;
};
type Tab = "home" | "search" | "tools" | "saved";
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const menus = [
  { id: "home", label: "কর্মক্ষেত্র", icon: Icon.Home },
  { id: "search", label: "সিল লাইব্রেরি", icon: Icon.Grid },
  { id: "tools", label: "ডকুমেন্ট টুলস", icon: Icon.Tools },
  { id: "saved", label: "সংরক্ষিত", icon: Icon.Bookmark },
] as const;

const templates: { kind: TemplateKind; title: string; description: string }[] = [
  { kind: "certificate", title: "সনদপত্র", description: "সিল ও স্বাক্ষর অনুশীলন" },
  { kind: "blueprint", title: "ড্রয়িং শিট", description: "ইঞ্জিনিয়ারিং নমুনা" },
  { kind: "invoice", title: "চালান", description: "নমুনা ইনভয়েস" },
  { kind: "noc", title: "অনুমোদন পত্র", description: "নমুনা NOC" },
];

export default function Landing({ seals, activeSealId, onPickSeal, onDeleteSeal, onFile, onSample, onAddSeal, onProject, onPdfText, onCustomize, onUploadSeal, loading, error }: Props) {
  const [tab, setTab] = useState<Tab>("home");
  const [query, setQuery] = useState("");
  const [guide, setGuide] = useState(false);
  const [installGuide, setInstallGuide] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(() => window.matchMedia?.("(display-mode: standalone)").matches ?? false);
  const [organizer, setOrganizer] = useState(false);
  const [imagePdfOpen, setImagePdfOpen] = useState(false);
  const [sealExportOpen, setSealExportOpen] = useState(false);
  const [engineering, setEngineering] = useState(false);
  const [engineeringTab, setEngineeringTab] = useState<"approval" | "dimension" | "markup" | "verify">("approval");
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const [savedTick, setSavedTick] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const active = seals.find((seal) => seal.id === activeSealId) ?? seals[0];
  const customSeals = seals.filter((seal) => !seal.builtIn && seal.kind !== "text");
  const filteredSeals = useMemo(() => seals.filter((seal) => seal.kind !== "text" && seal.name.toLowerCase().includes(query.trim().toLowerCase())), [seals, query]);
  const layouts = useMemo(() => { void savedTick; return loadLayouts(); }, [savedTick]);

  useEffect(() => {
    const beforeInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt); };
    const afterInstall = () => { setInstalled(true); setInstallPrompt(null); setNotice("অ্যাপ ইনস্টল হয়েছে।"); };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", afterInstall);
    return () => { window.removeEventListener("beforeinstallprompt", beforeInstall); window.removeEventListener("appinstalled", afterInstall); };
  }, []);

  const install = async () => {
    if (!installPrompt) { setInstallGuide(true); return; }
    const prompt = installPrompt;
    setInstallPrompt(null);
    try { await prompt.prompt(); await prompt.userChoice; } catch { setInstallGuide(true); }
  };
  const openFiles = () => { if (!loading) fileInput.current?.click(); };
  const openEngineering = (mode: "approval" | "dimension" | "markup" | "verify") => { setEngineeringTab(mode); setEngineering(true); };
  const openTab = (next: Tab) => { setTab(next); setNotice(""); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="dashboard-shell">
      <input ref={fileInput} data-testid="document-input" type="file" accept="image/png,image/jpeg,image/webp,application/pdf,.pdf" multiple hidden disabled={!!loading} onChange={(event) => { if (event.target.files?.length) onFile(Array.from(event.target.files)); event.target.value = ""; }} />
      <input ref={pdfInput} data-testid="pdf-input" type="file" accept="application/pdf,.pdf" hidden disabled={!!loading} onChange={(event) => { const file = event.target.files?.[0]; if (file) onPdfText(file); event.target.value = ""; }} />
      <input ref={projectInput} data-testid="project-input" type="file" accept=".sealproject,.json" hidden disabled={!!loading} onChange={(event) => { const file = event.target.files?.[0]; if (file) onProject(file); event.target.value = ""; }} />

      <aside className="dashboard-sidebar" aria-label="অ্যাপ নেভিগেশন">
        <button className="dashboard-brand" onClick={() => openTab("home")} aria-label="সিল বসান হোম">
          <span className="dashboard-brand-mark"><svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="20" cy="20" r="16"/><circle cx="20" cy="20" r="11" strokeDasharray="2 3"/><path d="M12 19h16M12 23h16M17 13h6M17 28h6"/></svg></span>
          <span><strong>সিল বসান</strong><small>ডকুমেন্ট স্টুডিও</small></span>
        </button>
        <button type="button" className="sidebar-create" onClick={openFiles} disabled={!!loading}><Icon.Plus className="h-4 w-4" /> নতুন ফাইল</button>
        <span className="sidebar-heading">আপনার কর্মক্ষেত্র</span>
        <nav className="dashboard-nav" aria-label="প্রধান নেভিগেশন">
          {menus.map((item) => <button key={item.id} type="button" data-testid={`nav-${item.id}`} aria-current={tab === item.id ? "page" : undefined} className={cn("dashboard-nav-item", tab === item.id && "is-active")} onClick={() => openTab(item.id)}><item.icon className="h-[19px] w-[19px]" /><span>{item.label}</span></button>)}
        </nav>
        <div className="sidebar-bottom"><Icon.Shield className="h-4 w-4" /><span>আপনার ফাইল আপনার<br />ডিভাইসেই থাকে।</span></div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <button className="dashboard-mobile-brand" onClick={() => openTab("home")}><span className="dashboard-mobile-mark">স</span><strong>সিল বসান</strong></button>
          <div className="topbar-title"><span>ডকুমেন্ট স্টুডিও</span><Icon.Next className="h-3.5 w-3.5" /><b>{menus.find((item) => item.id === tab)?.label}</b></div>
          <div className="topbar-actions">
            <button type="button" className="topbar-help" onClick={() => setGuide(true)}><Icon.Info className="h-4 w-4" /><span>সহায়তা</span></button>
            {!installed && <button type="button" className="install-button" onClick={install}><Icon.Download className="h-4 w-4" /><span>অ্যাপ ইনস্টল</span></button>}
          </div>
        </header>

        <main className="dashboard-content">
          {tab === "home" && <div className="dashboard-enter">
            <div className="dashboard-heading"><div><span className="section-label">আপনার ব্যক্তিগত ডকুমেন্ট স্টুডিও</span><h1>সিল বসান, <em>নথি সাজান।</em></h1><p>নথির কাজ সেরে নিন নিজের মতো, নিজের ডিভাইসে।</p></div><button className="project-open-link" onClick={() => projectInput.current?.click()}><Icon.Folder className="h-4 w-4" /> প্রজেক্ট খুলুন</button></div>

            <div className="dashboard-primary-grid">
              <section className="upload-panel" onDragEnter={(event) => { event.preventDefault(); dragDepth.current++; setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { event.preventDefault(); dragDepth.current--; if (dragDepth.current <= 0) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); dragDepth.current = 0; if (!loading && event.dataTransfer.files.length) onFile(Array.from(event.dataTransfer.files)); }}>
                <div className="panel-title-row"><div><span className="panel-eyebrow">শুরু করুন</span><h2>আপনার ডকুমেন্ট খুলুন</h2><p>PDF বা ছবিতে সিল, স্বাক্ষর ও লেখা যোগ করুন</p></div><span className="panel-file-icon"><Icon.File className="h-5 w-5" /></span></div>
                <button type="button" className={cn("upload-drop", dragging && "is-dragging")} onClick={openFiles} disabled={!!loading}>
                  <span className="upload-symbol">{loading ? <span className="export-spinner" /> : <Icon.Upload className="h-6 w-6" />}</span>
                  <b>{loading || (dragging ? "এখানে ফাইলটি ছেড়ে দিন" : "ফাইল টেনে আনুন বা বেছে নিন")}</b>
                  <span>PDF, JPG, PNG ও WEBP</span>
                  <span className="choose-file">ফাইল বেছে নিন <Icon.Next className="h-4 w-4" /></span>
                </button>
                <div className="upload-footer"><span><Icon.Shield className="h-4 w-4" /> আপনার ফাইল আপলোড হয় না</span><button type="button" disabled={!!loading} onClick={() => onSample("certificate")}>নমুনা দিয়ে চেষ্টা <Icon.Next className="h-4 w-4" /></button></div>
                {error && <p role="alert" className="dashboard-error">{error}</p>}
              </section>

              <section className="active-seal-panel">
                <div className="panel-title-row"><div><span className="panel-eyebrow">আপনার সংগ্রহ</span><h2>নির্বাচিত সিল</h2></div><button onClick={() => openTab("search")} className="panel-text-button">সব সিল <Icon.Next className="h-4 w-4" /></button></div>
                <button type="button" className="seal-display" onClick={() => openTab("search")} aria-label="সিল নির্বাচন করুন"><img src={active.src} alt={`${active.name} প্রিভিউ`} key={active.src} /></button>
                <div className="seal-meta"><div><b>{active.name}</b><span>পরের নথিতে ব্যবহৃত হবে</span></div><div className="seal-meta-actions"><button onClick={() => setSealExportOpen(true)} title="স্বচ্ছ PNG হিসেবে সিল ডাউনলোড করুন"><Icon.Download className="h-4 w-4" /><span>PNG</span></button><button onClick={() => openTab("search")}>বদলান</button></div></div>
              </section>
            </div>

            <section className="dashboard-tools-section">
              <div className="section-bar"><div><span className="panel-eyebrow">আরও কাজ</span><h2>প্রয়োজনীয় টুলস</h2></div><button onClick={() => openTab("tools")}>সব টুলস <Icon.Next className="h-4 w-4" /></button></div>
              <div className="dashboard-tool-grid">
                <button className="dashboard-tool" onClick={() => pdfInput.current?.click()}><span className="tool-glyph is-rose"><Icon.Text className="h-5 w-5" /></span><span><b>PDF লেখা এডিট</b><small>লেখা, রং ও আকার বদলান</small></span><Icon.Next className="h-4 w-4 tool-chevron" /></button>
                <button className="dashboard-tool" onClick={() => setOrganizer(true)}><span className="tool-glyph is-blue"><Icon.Layers className="h-5 w-5" /></span><span><b>PDF পেজ সাজান</b><small>পেজ একত্র, ঘোরান বা বাদ দিন</small></span><Icon.Next className="h-4 w-4 tool-chevron" /></button>
                <button className="dashboard-tool" onClick={() => setImagePdfOpen(true)}><span className="tool-glyph is-teal"><Icon.Image className="h-5 w-5" /></span><span><b>ছবি থেকে PDF</b><small>একাধিক ছবি একটি PDF-এ</small></span><Icon.Next className="h-4 w-4 tool-chevron" /></button>
                <button className="dashboard-tool" onClick={() => openEngineering("approval")}><span className="tool-glyph is-teal"><Icon.Tools className="h-5 w-5" /></span><span><b>ইঞ্জিনিয়ারিং ব্লক</b><small>ড্রয়িংয়ের অনুমোদন নোট</small></span><Icon.Next className="h-4 w-4 tool-chevron" /></button>
              </div>
            </section>
            {notice && <p role="status" className="dashboard-notice">{notice}</p>}
          </div>}

          {tab === "search" && <div className="dashboard-enter">
            <div className="dashboard-heading"><div><span className="section-label">সিল বসান / লাইব্রেরি</span><h1>আপনার সিল</h1><p>একটি সিল বেছে নিন, অথবা নিজের ডিজাইন তৈরি করুন।</p></div><button className="dashboard-solid-button" onClick={onCustomize}><Icon.Plus className="h-4 w-4" /> সিল তৈরি</button></div>
            {notice && <p role="status" className="dashboard-notice">{notice}</p>}
            <div className="library-topbar"><label><Icon.Search className="h-4 w-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="সিলের নাম খুঁজুন" placeholder="সিলের নাম খুঁজুন" /></label><div className="library-actions"><button onClick={() => setSealExportOpen(true)}><Icon.Download className="h-4 w-4" /> সিল ডাউনলোড</button><button onClick={onUploadSeal}><Icon.Upload className="h-4 w-4" /> নিজের সিল দিন</button></div></div>
            <div className="dashboard-seal-grid">{filteredSeals.map((seal) => <button key={seal.id} type="button" data-seal-id={seal.id} aria-pressed={seal.id === active.id} onClick={() => { onPickSeal(seal.id); setNotice(`“${seal.name}” বেছে নেওয়া হয়েছে।`); }} className={cn("dashboard-seal-choice", seal.id === active.id && "is-selected")}><span className="dashboard-seal-image"><img src={seal.src} alt="" /></span><span className="dashboard-seal-name"><b>{seal.name}</b>{seal.id === active.id && <Icon.Check className="h-4 w-4" />}</span></button>)}</div>
            {!filteredSeals.length && <p className="dashboard-empty">এই নামে কোনো সিল পাওয়া যায়নি।</p>}
            <p className="dashboard-footnote">বেছে নেওয়া সিলটি পরের ডকুমেন্টে ব্যবহার হবে।</p>
          </div>}

          {tab === "tools" && <div className="dashboard-enter">
            <div className="dashboard-heading"><div><span className="section-label">সিল বসান / সরঞ্জাম</span><h1>ডকুমেন্ট টুলস</h1><p>প্রয়োজনীয় কাজটি বেছে নিন।</p></div></div>
            <div className="tools-list">
              <button onClick={() => setOrganizer(true)}><span className="tool-glyph is-blue"><Icon.Layers className="h-5 w-5" /></span><span><b>PDF পেজ সাজান ও একত্র করুন</b><small>পেজ বাছাই, ক্রম পরিবর্তন ও ঘোরান</small></span><Icon.Next className="h-4 w-4" /></button>
              <button onClick={() => setImagePdfOpen(true)}><span className="tool-glyph is-teal"><Icon.Image className="h-5 w-5" /></span><span><b>ছবি থেকে PDF</b><small>ছবি সাজিয়ে একটি PDF তৈরি করুন</small></span><Icon.Next className="h-4 w-4" /></button>
              <button onClick={() => pdfInput.current?.click()}><span className="tool-glyph is-rose"><Icon.Text className="h-5 w-5" /></span><span><b>PDF লেখা এডিট</b><small>টেক্সট স্তর আছে এমন PDF-এর লেখা বদলান</small></span><Icon.Next className="h-4 w-4" /></button>
              <button onClick={() => openEngineering("verify")}><span className="tool-glyph is-violet"><Icon.Qr className="h-5 w-5" /></span><span><b>QR কোড তৈরি</b><small>লিংক বা লেখা থেকে স্ক্যানযোগ্য কোড</small></span><Icon.Next className="h-4 w-4" /></button>
              <button onClick={() => openEngineering("approval")}><span className="tool-glyph is-teal"><Icon.Tools className="h-5 w-5" /></span><span><b>ইঞ্জিনিয়ারিং ব্লক</b><small>ড্রয়িং নম্বর ও অনুমোদনের নোট</small></span><Icon.Next className="h-4 w-4" /></button>
            </div>
            <details className="template-details"><summary>নমুনা নথি দিয়ে অনুশীলন করুন <Icon.Plus className="h-4 w-4" /></summary><div className="template-list">{templates.map((item) => <button key={item.kind} disabled={!!loading} onClick={() => onSample(item.kind)}><Icon.File className="h-4 w-4" /><span><b>{item.title}</b><small>{item.description}</small></span><Icon.Next className="h-4 w-4" /></button>)}</div></details>
            {error && <p role="alert" className="dashboard-error">{error}</p>}
          </div>}

          {tab === "saved" && <div className="dashboard-enter">
            <div className="dashboard-heading"><div><span className="section-label">সিল বসান / সংগ্রহ</span><h1>সংরক্ষিত</h1><p>এই ব্রাউজারে রাখা সিল ও লেআউট।</p></div><button className="dashboard-solid-button" onClick={() => projectInput.current?.click()}><Icon.Folder className="h-4 w-4" /> প্রজেক্ট খুলুন</button></div>
            <div className="saved-lists"><section><h2>নিজের সিল <span>{customSeals.length}</span></h2>{customSeals.length ? customSeals.map((seal) => <div key={seal.id} className="saved-entry"><img src={seal.src} alt="" /><b>{seal.name}</b><button onClick={() => { onPickSeal(seal.id); openTab("home"); }}>ব্যবহার</button><button aria-label={`${seal.name} মুছুন`} onClick={() => onDeleteSeal(seal.id)}><Icon.Trash className="h-4 w-4" /></button></div>) : <p className="dashboard-empty">এখনো কোনো নিজস্ব সিল নেই। <button onClick={onUploadSeal}>সিল যোগ করুন</button></p>}</section>
              <section><h2>সেভ করা লেআউট <span>{layouts.length}</span></h2>{layouts.length ? layouts.map((layout) => <div key={layout.id} className="saved-entry"><span className="saved-entry-icon"><Icon.Layers className="h-4 w-4" /></span><b>{layout.name}<small>{layout.stamps.length}টি স্তর</small></b><button aria-label={`${layout.name} মুছুন`} onClick={() => { if (confirm("এই লেআউটটি মুছে ফেলবেন?")) { deleteLayout(layout.id); setSavedTick((value) => value + 1); } }}><Icon.Trash className="h-4 w-4" /></button></div>) : <p className="dashboard-empty">এডিটরের পেজ ট্যাব থেকে লেআউট সেভ করতে পারবেন।</p>}</section></div>
          </div>}
        </main>
      </div>

      <PdfOrganizer open={organizer} onClose={() => setOrganizer(false)} />
      <ImagePdfModal open={imagePdfOpen} onClose={() => setImagePdfOpen(false)} onEdit={(file) => onFile([file])} />
      <SealExportModal open={sealExportOpen} onClose={() => setSealExportOpen(false)} seal={active} />
      <EngineeringModal open={engineering} onClose={() => setEngineering(false)} initialTab={engineeringTab} onCreate={(seal) => { onAddSeal(seal); setTab("search"); setQuery(""); setNotice("নতুন উপাদানটি সিল লাইব্রেরিতে যুক্ত হয়েছে। নথি খুলে এটি বসাতে পারবেন।"); }} />
      <Modal open={guide} onClose={() => setGuide(false)} title="ব্যবহারের নির্দেশনা">
        <ol className="dashboard-guide"><li><b>১. নথি খুলুন</b><p>PDF বা ছবি বেছে নিন।</p></li><li><b>২. সম্পাদনা করুন</b><p>সিল টেনে বসান, আকার ও কালি ঠিক করুন।</p></li><li><b>৩. সেভ করুন</b><p>ফাইল তৈরি করে ডাউনলোড লিংকে চাপ দিন।</p></li></ol>
        <p className="guide-note">PDF-এর পুরোনো লেখা ঢেকে নতুন লেখা বসে; এটি গোপন তথ্য স্থায়ীভাবে মুছে দেয় না।</p>
      </Modal>
      <Modal open={installGuide} onClose={() => setInstallGuide(false)} title="অ্যাপ হিসেবে ব্যবহার">
        <div className="dashboard-guide"><p>ব্রাউজারের মেনুতে <b>Install app</b> বা <b>Add to Home screen</b> বেছে নিন। iPhone-এ Share মেনু থেকে <b>Add to Home Screen</b> ব্যবহার করুন।</p><p>ইনস্টলের সুবিধা ব্রাউজার ও HTTPS সংযোগের ওপর নির্ভর করে।</p></div>
      </Modal>
    </div>
  );
}