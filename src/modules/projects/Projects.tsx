import { useEffect, useState } from "react";
import { Button, Input, Select, Notice, ModuleHeader, Empty, useAsyncAction } from "../../ui/primitives";
import { getAll, put, del, get, type ProjectMeta } from "../../core/storage/db";
import { packIsoe, unpackIsoe, migrateLegacySealProject, ISOE_VERSION, type IsoeData } from "../../core/project/format";
import { downloadBlob, prettySize } from "../../core/export/queue";
import { registry } from "../../core/registry";

export default function Projects({ onOpen }: { onOpen?: (tool: string, data?: unknown) => void }) {
  const [list, setList] = useState<ProjectMeta[]>([]);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState("grid");
  const [sort, setSort] = useState("updated");
  const [selected, setSelected] = useState<string | null>(null);
  const [versions, setVersions] = useState<{ savedAt: string; size: number }[]>([]);
  const [trash, setTrash] = useState(false);
  const { busy, error, run } = useAsyncAction();

  const refresh = () => run(async () => {
    const rows = await getAll("projects");
    setList(rows.map((r) => ({ id: r.id, name: r.name, module: r.module, updatedAt: new Date(r.updatedAt).toISOString(), size: JSON.stringify(r.data ?? null).length, trashedAt: r.deletedAt ? new Date(r.deletedAt).toISOString() : undefined })));
  });
  useEffect(() => { void refresh(); }, []);

  const open = async (m: ProjectMeta) => { const p = await get("projects", m.id); onOpen?.(m.module === "doc-template" ? "document.studio" : m.module, p?.data); };
  const softDelete = async (m: ProjectMeta) => { await put("projects", { ...(await get("projects", m.id))!, deletedAt: Date.now() }); await refresh(); };
  const restore = async (m: ProjectMeta) => { await put("projects", { ...(await get("projects", m.id))!, deletedAt: undefined }); await refresh(); };
  const remove = async (m: ProjectMeta) => { await del("projects", m.id); await refresh(); };

  const exportIsoe = (m: ProjectMeta) => run(async () => {
    const p = await get("projects", m.id); if (!p) return;
    const bytes = await packIsoe({ name: p.name, module: p.module, data: p.data, assets: new Map(), history: [] });
    downloadBlob(new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/octet-stream" }), `${m.name}.isoe`);
  });

  const importIsoe = (f: File) => run(async () => {
    let data: IsoeData;
    if (/\.sealproject$/i.test(f.name)) data = unpackIsoe(new Uint8Array(await (await migrateLegacySealProject(f)).arrayBuffer()));
    else data = unpackIsoe(new Uint8Array(await f.arrayBuffer()));
    await put("projects", { id: crypto.randomUUID(), name: data.name, module: data.module, createdAt: Date.now(), updatedAt: Date.now(), favorite: false, data: data.data });
    await refresh();
  });

  const showVersions = (m: ProjectMeta) => run(async () => {
    setSelected(m.id);
    const { getHistory } = await import("../../core/project/autosave");
    const h = await getHistory(m.id);
    setVersions(h.map((x) => ({ savedAt: x.savedAt, size: x.size })));
  });

  const restoreVersion = (i: number) => run(async () => {
    if (!selected) return;
    const { getHistory } = await import("../../core/project/autosave");
    const h = await getHistory(selected);
    await put("projects", { ...(await get("projects", selected))!, data: h[i].data, updatedAt: Date.now() });
    await refresh();
  });

  const backupAll = () => run(async () => {
    const { zipSync, strToU8 } = await import("fflate");
    const all = await getAll("projects");
    const entries: Record<string, Uint8Array> = {};
    for (const m of all) entries[`projects/${m.id}.json`] = strToU8(JSON.stringify(m));
    entries["settings.json"] = strToU8(JSON.stringify(await getAll("settings")));
    downloadBlob(new Blob([zipSync(entries).slice().buffer as ArrayBuffer], { type: "application/zip" }), "isoe-backup.zip");
  });

  const restoreBackup = (f: File) => run(async () => {
    const { unzipSync, strFromU8 } = await import("fflate");
    const entries = unzipSync(new Uint8Array(await f.arrayBuffer()), { filter: (e) => e.originalSize <= 64 * 1024 * 1024 });
    for (const [k, v] of Object.entries(entries)) if (k.startsWith("projects/")) { const p = JSON.parse(strFromU8(v)); await put("projects", { ...p, updatedAt: Date.now() }); }
    await refresh();
  });

  const visible = list
    .filter((m) => (!!m.trashedAt) === trash && (filter === "all" || m.module === filter) && m.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "size" ? (b.size ?? 0) - (a.size ?? 0) : b.updatedAt.localeCompare(a.updatedAt));

  return <div className="iso-module" data-testid="projects">
    <ModuleHeader icon="🗂" title="Projects" desc="IndexedDB · .isoe import/export · version history · trash 30 days · backup/restore" actions={<>
      <label className="iso-btn">Import .isoe/.sealproject<input type="file" hidden accept=".isoe,.sealproject" onChange={(e) => e.target.files?.[0] && void importIsoe(e.target.files[0])} /></label>
      <Button onClick={() => void backupAll()}>Backup all</Button>
      <label className="iso-btn">Restore backup<input type="file" hidden accept=".zip" onChange={(e) => e.target.files?.[0] && void restoreBackup(e.target.files[0])} /></label>
    </>} />
    {error && <Notice kind="error">{error}</Notice>}
    <div className="iso-row">
      <Button variant={!trash ? "primary" : "default"} onClick={() => setTrash(false)}>Projects</Button>
      <Button variant={trash ? "primary" : "default"} onClick={() => setTrash(true)}>Trash</Button>
      <Input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 200 }} />
      <Select value={filter} onChange={setFilter} options={[{ value: "all", label: "সব" }, ...registry.map((t) => ({ value: t.module, label: t.title }))]} />
      <Select value={sort} onChange={setSort} options={[{ value: "updated", label: "Updated" }, { value: "name", label: "Name" }, { value: "size", label: "Size" }]} />
      <Button onClick={() => setView(view === "grid" ? "list" : "grid")}>{view}</Button>
    </div>
    {visible.length === 0
      ? <Empty text={trash ? "ট্র্যাশ খালি" : "কোনো প্রজেক্ট নেই; ডকুমেন্ট স্টুডিওতে কাজ শুরু করলে স্বয়ংক্রিয়ভাবে সংরক্ষিত হবে"} />
      : <div className={view === "grid" ? "iso-cards" : "iso-list"}>{visible.map((m) => <div key={m.id} className="iso-card">
          <b>{m.name}</b>
          <small>{registry.find((t) => t.module === m.module)?.title ?? m.module} · {new Date(m.updatedAt).toLocaleString()} · {prettySize(m.size ?? 0)}</small>
          <div className="iso-row">{trash ? <>
            <Button onClick={() => void restore(m)}>Restore</Button>
            <Button variant="danger" onClick={() => void remove(m)}>Delete forever</Button>
          </> : <>
            <Button onClick={() => void open(m)}>Open</Button>
            <Button onClick={() => void exportIsoe(m)}>.isoe</Button>
            <Button onClick={() => void showVersions(m)}>Versions</Button>
            <Button onClick={async () => { await put("projects", { ...(await get("projects", m.id))!, id: crypto.randomUUID(), name: `${m.name} copy`, updatedAt: Date.now() }); await refresh(); }}>Duplicate</Button>
            <Button variant="ghost" onClick={() => void softDelete(m)}>Trash</Button>
          </>}</div>
        </div>)}</div>}
    {selected && <div className="iso-card"><h3>Version history ({versions.length})</h3>
      {versions.length === 0 && <Empty text="এই প্রজেক্টের স্ন্যাপশট নেই" />}
      {versions.map((v, i) => <div key={i} className="iso-row"><span>{new Date(v.savedAt).toLocaleString()} · {prettySize(v.size)}</span><Button disabled={busy} onClick={() => void restoreVersion(i)}>Restore</Button></div>)}
      <Button onClick={() => setSelected(null)}>Close</Button></div>}
    <Notice>Schema v{ISOE_VERSION} · পুরোনো .sealproject স্বয়ংক্রিয়ভাবে মাইগ্রেট হবে; মূল ফাইল অপরিবর্তিত থাকে।</Notice>
  </div>;
}
