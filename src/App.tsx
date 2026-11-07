import { useCallback, useEffect, useMemo, useState } from "react";
import "./index.css";
import "./ui-refresh.css";
import Landing from "./components/Landing";
import Editor from "./components/Editor";
import { CustomizeSealModal, UploadSealModal } from "./components/SealModals";
import { DEFAULT_SEAL, normalizeSealConfig, rasterizeSeal, sealAspect, sealDataUrl, type SealConfig } from "./lib/seal";
import { loadDocument, makeSampleDoc, type TemplateKind } from "./lib/doc";
import type { Doc, Seal } from "./types";
import { importEditableProject, type EditableProject } from "./lib/project";
import { SEAL_A_ASPECT, SEAL_A_IMG, SEAL_B_ASPECT, SEAL_B_IMG } from "./lib/sealAssets";

function useStored<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initial;
      const parsed = JSON.parse(raw);
      if (Array.isArray(initial)) return Array.isArray(parsed) ? parsed as T : initial;
      return parsed && typeof parsed === typeof initial ? parsed as T : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* storage full – ignore */
    }
  }, [key, v]);
  return [v, setV] as const;
}

const PNG_SEALS: Seal[] = [
  { id: "builtin-b", name: "ম্যাপ সিল", src: SEAL_B_IMG, aspect: SEAL_B_ASPECT, builtIn: true },
  { id: "builtin-a", name: "পাতার সিল", src: SEAL_A_IMG, aspect: SEAL_A_ASPECT, builtIn: true },
  { id: "builtin-flag", name: "পতাকা সিল", src: sealDataUrl({ ...DEFAULT_SEAL, emblem: "flag" }), aspect: 1, builtIn: true },
];

export default function App() {
  const [sealCfg, setSealCfg] = useStored<SealConfig>("seal-config-v4", DEFAULT_SEAL);
  const [customSeals, setCustomSeals] = useStored<Seal[]>("custom-seals-v1", []);
  const [activeSealId, setActiveSealId] = useStored<string>("active-seal-v3", "builtin-b");
  const [doc, setDoc] = useState<Doc | null>(null);
  const [projectSession, setProjectSession] = useState<EditableProject | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [openTextOnLoad, setOpenTextOnLoad] = useState(false);

  const fullCfg = useMemo(() => normalizeSealConfig(sealCfg), [sealCfg]);
  const svgUrl = useMemo(() => sealDataUrl(fullCfg), [fullCfg]);
  const [raster, setRaster] = useState<{ key: string; src: string; aspect: number } | null>(null);
  useEffect(() => {
    let alive = true;
    const run = () =>
      rasterizeSeal(svgUrl, 1400)
        .then((r) => alive && setRaster({ key: svgUrl, ...r }))
        .catch(() => {});
    (document.fonts?.ready ?? Promise.resolve()).then(run);
    return () => {
      alive = false;
    };
  }, [svgUrl]);
  const customSvg: Seal = useMemo(
    () => ({
      id: "builtin-svg",
      name: "কাস্টম সিল",
      src: raster && raster.key === svgUrl ? raster.src : svgUrl,
      aspect: raster && raster.key === svgUrl ? raster.aspect : sealAspect(fullCfg.shape),
      builtIn: true,
    }),
    [raster, svgUrl, fullCfg.shape]
  );

  const allSeals = useMemo(() => [...PNG_SEALS, customSvg, ...customSeals.filter((s) => s && typeof s.id === "string" && typeof s.src === "string" && Number.isFinite(s.aspect) && s.aspect > 0)], [customSvg, customSeals]);
  const editorSeals = useMemo(() => {
    const a = allSeals.find((s) => s.id === activeSealId);
    return a ? [a, ...allSeals.filter((s) => s.id !== a.id)] : allSeals;
  }, [allSeals, activeSealId]);

  const handleFiles = useCallback(async (files: File[], openText = false) => {
    setError(null);
    setProjectSession(null);
    setLoading("ফাইল খোলা হচ্ছে...");
    try {
      const d = await loadDocument(files, setLoading);
      setOpenTextOnLoad(openText && d.kind === "pdf");
      setDoc(d);
    } catch (e) {
      console.error(e);
      setError((e as Error).message || "ফাইলটি খোলা যায়নি");
    } finally {
      setLoading(null);
    }
  }, []);

  const handleProject = useCallback(async (file: File) => {
    setError(null);
    setLoading("প্রজেক্ট খোলা হচ্ছে...");
    try {
      const project = await importEditableProject(file);
      setProjectSession(project);
      setDoc(project.doc);
    } catch (e) {
      setError((e as Error).message || "প্রজেক্ট ফাইল খোলা যায়নি");
    } finally {
      setLoading(null);
    }
  }, []);

  const deleteSeal = (id: string) => {
    if (!confirm("লাইব্রেরি থেকে সিলটি মুছবেন? ডকুমেন্টে বসানো সিলটি থাকবে।")) return false;
    setCustomSeals((s) => s.filter((x) => x.id !== id));
    if (activeSealId === id) setActiveSealId("builtin-b");
    return true;
  };

  const closeDoc = () => {
    if (!confirm("এডিটর বন্ধ করবেন? সেভ না করা পরিবর্তন হারিয়ে যাবে।")) return;
    if (doc?.kind === "image") doc.pages.forEach((p) => URL.revokeObjectURL(p.src));
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setDoc(null);
    setProjectSession(null);
    setOpenTextOnLoad(false);
  };

  return (
    <>
      {doc ? (
        <Editor
          doc={doc}
          seals={editorSeals}
          preferredSealId={activeSealId}
          selectionVersion={selectionVersion}
          initialTextMode={openTextOnLoad}
          initialStamps={projectSession?.stamps}
          initialSeals={projectSession?.seals}
          initialPage={projectSession?.pageIdx}
          onClose={closeDoc}
          onCustomize={() => setCustomizeOpen(true)}
          onUploadSeal={() => setUploadOpen(true)}
          onDeleteSeal={deleteSeal}
        />
      ) : (
        <Landing
          seals={allSeals}
          activeSealId={activeSealId}
          onPickSeal={setActiveSealId}
          onDeleteSeal={deleteSeal}
          onFile={handleFiles}
          onPdfText={(file) => { void handleFiles([file], true); }}
          onSample={async (kind: TemplateKind = "certificate") => {
            setProjectSession(null);
            setLoading("নমুনা তৈরি হচ্ছে...");
            try {
              setDoc(await makeSampleDoc(kind));
            } finally {
              setLoading(null);
            }
          }}
          onAddSeal={(s) => {
            setCustomSeals((list) => [...list, s]);
            setActiveSealId(s.id);
            setSelectionVersion((value) => value + 1);
          }}
          onProject={handleProject}
          onCustomize={() => setCustomizeOpen(true)}
          onUploadSeal={() => setUploadOpen(true)}
          loading={loading}
          error={error}
        />
      )}
      <CustomizeSealModal
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        config={fullCfg}
        onSave={(c) => {
          setSealCfg(c);
          setActiveSealId("builtin-svg");
          setSelectionVersion((value) => value + 1);
        }}
      />
      <UploadSealModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onAdd={(s) => {
          setCustomSeals((list) => [...list, s]);
          setActiveSealId(s.id);
          setSelectionVersion((value) => value + 1);
        }}
      />
    </>
  );
}
