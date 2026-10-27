import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Clapperboard,
  Command,
  Film,
  FolderOpen,
  Layers3,
  LoaderCircle,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { useAssets } from "./hooks/useAssets";
import { CANVAS_HEIGHT, CANVAS_WIDTH, LOOP_SECONDS, useMotionCanvas } from "./hooks/useMotionCanvas";
import { exportPngSequence, exportWebM } from "./lib/export";
import type { Asset, AssetCategory, ExportStatus, MotionSettings } from "./types";

const categories = ["All assets", "Overlays", "Timeline accents", "Callouts"] as const;
type CategoryFilter = (typeof categories)[number];
type AssetArtworkStyle = CSSProperties & { "--asset-accent": string };

const defaultMotion: MotionSettings = {
  title: "A quieter kind of motion",
  subtitle: "Curated details for the in-between.",
  strokeColor: "#141a19",
  blur: 3,
  markerStart: 0.18,
  markerEnd: 0.82,
};

function AssetArtwork({ asset, compact = false }: { asset: Asset; compact?: boolean }) {
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    if (!asset.file) {
      setImageUrl("");
      return;
    }
    const url = URL.createObjectURL(asset.file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [asset.file]);

  return (
    <div className={`asset-art asset-art-${asset.kind}${compact ? " asset-art-compact" : ""}`} style={{ "--asset-accent": asset.accent } as AssetArtworkStyle}>
      <div className="art-grid" />
      <div className="art-orb" />
      <div className="art-line" />
      {imageUrl && <img className="asset-source-image" src={imageUrl} alt="" />}
      {!compact && <span className="art-label">{asset.format} <span>·</span> {asset.ratio}</span>}
      {compact && <span className="art-index">FV / 0{asset.id.length % 9 + 1}</span>}
    </div>
  );
}

function SectionLabel({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return <div className="section-label"><span>{children}</span>{trailing}</div>;
}

function AssetCard({
  asset,
  selected,
  onSelect,
}: {
  asset: Asset;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button className={`asset-card${selected ? " is-selected" : ""}`} onClick={onSelect} aria-pressed={selected}>
      <div className="asset-card-art"><AssetArtwork asset={asset} /></div>
      <div className="asset-card-meta">
        <span className="asset-card-category">{asset.category === "Timeline accents" ? "Timeline accent" : asset.category.slice(0, -1)}</span>
        <span className="asset-card-format">{asset.format}</span>
      </div>
      <div className="asset-card-name">{asset.name}</div>
      <div className="asset-card-foot">
        <span>{asset.ratio}</span><span className="meta-dot">·</span><span>{asset.duration}</span>
        {selected && <span className="selected-check"><Check size={11} /></span>}
      </div>
    </button>
  );
}

function AddAssetDialog({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (name: string, category: AssetCategory, format: string, ratio: string, file?: File) => Promise<Asset>;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<AssetCategory>("Overlays");
  const [format, setFormat] = useState("WEBM");
  const [ratio, setRatio] = useState("16:9");
  const [file, setFile] = useState<File>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (file) {
        const supportedTypes = ["image/png", "image/jpeg", "image/webp"];
        if (!supportedTypes.includes(file.type)) {
          throw new Error("Unsupported file. Choose a PNG, JPEG, or WebP image.");
        }
        if (file.size === 0 || file.size > 50 * 1024 * 1024) {
          throw new Error("The image must be non-empty and no larger than 50 MB.");
        }
        const bitmap = await createImageBitmap(file).catch(() => {
          throw new Error("This image could not be decoded. Try a valid PNG, JPEG, or WebP file.");
        });
        bitmap.close();
      }
      await onAdd(name || file?.name.replace(/\.[^.]+$/, "") || "", category, format, ratio, file);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The asset could not be added.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="modal-card" onSubmit={(event) => void submit(event)}>
        <div className="modal-top">
          <div><span className="eyebrow">Asset library</span><h2>Add an asset</h2></div>
          <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={17} /></button>
        </div>
        <label className="field-label">Asset name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Amber bloom" maxLength={70} /></label>
        <div className="form-grid">
          <label className="field-label">Category<select value={category} onChange={(event) => setCategory(event.target.value as AssetCategory)}><option>Overlays</option><option>Timeline accents</option><option>Callouts</option></select></label>
          <label className="field-label">Format<select value={format} onChange={(event) => setFormat(event.target.value)}><option>WEBM</option><option>MOV</option><option>SVG</option><option>PNG</option><option>JPEG</option><option>WEBP</option></select></label>
        </div>
        <label className="field-label">Aspect ratio<select value={ratio} onChange={(event) => setRatio(event.target.value)}><option>16:9</option><option>9:16</option><option>4:5</option><option>1:1</option></select></label>
        <label className="field-label">Optional image source<input className="file-input" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={(event) => { const selectedFile = event.target.files?.[0]; setFile(selectedFile); if (selectedFile) setFormat(selectedFile.type === "image/png" ? "PNG" : selectedFile.type === "image/jpeg" ? "JPEG" : selectedFile.type === "image/webp" ? "WEBP" : format); }} /><span className="field-hint">PNG, JPEG, or WebP · up to 50 MB · stays on this device</span></label>
        {error && <p className="inline-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button disabled={saving} className="button button-primary">{saving ? "Adding…" : "Add to library"}<ArrowUpRight size={14} /></button></div>
      </form>
    </div>
  );
}

function App() {
  const { assets, loading, error: assetError, updateTags, addAsset } = useAssets();
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("All assets");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [motion, setMotion] = useState(defaultMotion);
  const [playing, setPlaying] = useState(true);
  const [playhead, setPlayhead] = useState(1.35);
  const [tagDraft, setTagDraft] = useState("");
  const [tagError, setTagError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<ExportStatus>({ kind: "idle" });
  const [previewError, setPreviewError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPlayheadUpdate = useRef(0);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedId) ?? assets[0],
    [assets, selectedId],
  );
  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assets.filter((asset) => {
      const categoryMatches = categoryFilter === "All assets" || asset.category === categoryFilter;
      const searchMatches = !query || [
        asset.name,
        asset.category,
        asset.format,
        asset.ratio,
        ...asset.tags,
      ].some((value) => value.toLowerCase().includes(query));
      return categoryMatches && searchMatches;
    });
  }, [assets, categoryFilter, search]);

  const updatePlayheadFromPreview = useCallback((time: number) => {
    const now = performance.now();
    if (now - lastPlayheadUpdate.current >= 90) {
      lastPlayheadUpdate.current = now;
      setPlayhead(time);
    }
  }, []);
  const showPreviewError = useCallback((message: string) => setPreviewError(message), []);
  const renderAt = useMotionCanvas(canvasRef, selectedAsset ?? assets[0] ?? {
    id: "empty", name: "Empty", category: "Overlays", format: "WEBM", ratio: "16:9", duration: "00:05", tags: [], accent: "#929083", kind: "gradient",
  }, motion, playing, playhead, updatePlayheadFromPreview, showPreviewError, !loading && !assetError && Boolean(selectedAsset));

  const updateMotion = <K extends keyof MotionSettings>(key: K, value: MotionSettings[K]) => {
    setMotion((current) => ({ ...current, [key]: value }));
  };

  async function saveTags(nextTags: string[]) {
    if (!selectedAsset) return;
    setTagError("");
    try {
      await updateTags(selectedAsset.id, nextTags);
    } catch (cause) {
      setTagError(cause instanceof Error ? cause.message : "Tags could not be saved.");
    }
  }

  function addTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const tag = tagDraft.trim();
    if (!tag || !selectedAsset) return;
    if (selectedAsset.tags.some((current) => current.toLowerCase() === tag.toLowerCase())) {
      setTagError("That tag is already assigned.");
      return;
    }
    setTagDraft("");
    void saveTags([...selectedAsset.tags, tag]);
  }

  function removeTag(tag: string) {
    void saveTags(selectedAsset.tags.filter((current) => current !== tag));
  }

  async function runExport(format: "webm" | "png") {
    const canvas = canvasRef.current;
    if (!canvas || !selectedAsset) {
      setExportStatus({ kind: "error", message: "Select an asset before exporting the preview." });
      return;
    }
    if (canvas.width === 0 || canvas.height === 0) {
      setExportStatus({ kind: "error", message: "The preview canvas is empty and cannot be exported." });
      return;
    }
    setExportStatus({ kind: "rendering", progress: 0, label: format === "webm" ? "Recording WebM" : "Rendering PNG frames" });
    try {
      const progress = (value: number) => setExportStatus({
        kind: "rendering",
        progress: value,
        label: format === "webm" ? "Recording WebM" : "Rendering PNG frames",
      });
      if (format === "webm") await exportWebM(canvas, selectedAsset, motion, progress);
      else await exportPngSequence(canvas, selectedAsset, motion, progress);
      setExportStatus({ kind: "success", message: format === "webm" ? "WebM export downloaded." : "PNG sequence downloaded." });
    } catch (cause) {
      console.error("Asset export failed.", cause);
      setExportStatus({ kind: "error", message: cause instanceof Error ? cause.message : "The export could not be completed." });
    }
  }

  if (loading) {
    return <main className="loading-screen"><LoaderCircle className="spin" size={22} /><span>Opening your local studio…</span></main>;
  }

  if (assetError || !selectedAsset) {
    return <main className="load-error"><div className="eyebrow">Local asset library</div><h1>Your studio could not be opened.</h1><p>{assetError ?? "No assets are available yet."}</p><p className="muted-copy">Check your browser’s IndexedDB permissions and reload the page.</p></main>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Framevault home"><span className="brand-mark"><Clapperboard size={17} strokeWidth={1.7} /></span><span>framevault<span className="brand-period">.</span></span></a>
        <div className="workspace-switch"><span className="workspace-avatar">S</span><span className="workspace-copy"><strong>Studio workspace</strong><small>Personal library</small></span><ChevronDown size={14} /></div>
        <nav className="side-nav" aria-label="Primary navigation">
          <SectionLabel>Workspace</SectionLabel>
          <button className="nav-item"><Layers3 size={16} /><span>Asset library</span><span className="nav-count">{assets.length}</span></button>
          <button className="nav-item"><Clapperboard size={16} /><span>Motion studio</span></button>
          <button className="nav-item"><FolderOpen size={16} /><span>Collections</span><span className="nav-soon">SOON</span></button>
          <SectionLabel trailing={<button className="tiny-action" aria-label="Add collection"><Plus size={13} /></button>}>Collections</SectionLabel>
          <button className="collection-item"><span className="collection-dot dot-sand" />Editorial titles<span className="collection-total">08</span></button>
          <button className="collection-item"><span className="collection-dot dot-sage" />Atmosphere<span className="collection-total">12</span></button>
          <button className="collection-item"><span className="collection-dot dot-clay" />Social kit<span className="collection-total">06</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="storage-card"><div className="storage-top"><span>LOCAL STORAGE</span><span>ON DEVICE</span></div><div className="storage-track"><i /></div><p>Your assets never leave this browser.</p></div>
          <button className="profile-button"><span className="profile-avatar">C</span><span className="profile-copy"><strong>Creative desk</strong><small>Free workspace</small></span><MoreHorizontal size={17} /></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>Asset library</strong></div>
          <div className="topbar-right"><span className="saved-indicator"><i /> All changes saved</span><button className="icon-button help-button" aria-label="Help"><CircleHelp size={17} /></button><span className="topbar-divider" /><span className="topbar-avatar">C</span></div>
        </header>

        <div className="page-content">
          <section className="library-section">
            <div className="page-heading">
              <div><div className="eyebrow">Your creative toolkit <span className="eyebrow-line" /></div><h1>Asset library<span className="heading-period">.</span></h1><p>Small details. Big shifts in the edit.</p></div>
              <div className="heading-actions"><button className="button button-outline" onClick={() => setDialogOpen(true)}><Plus size={15} /> Add asset</button><button className="button button-primary" onClick={() => document.getElementById("motion-studio")?.scrollIntoView({ behavior: "smooth" })}>Open studio <ArrowUpRight size={14} /></button></div>
            </div>

            <div className="library-toolbar">
              <div className="category-tabs" role="tablist" aria-label="Filter by category">
                {categories.map((category) => <button key={category} role="tab" aria-selected={categoryFilter === category} className={`category-tab${categoryFilter === category ? " active" : ""}`} onClick={() => setCategoryFilter(category)}>{category}{category === "All assets" && <span>{assets.length}</span>}</button>)}
              </div>
              <label className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets, tags, format…" aria-label="Search assets by name, tag, format, or aspect ratio" /><kbd><Command size={10} /> K</kbd></label>
              <button className="filter-button" aria-label="Filter options"><Settings2 size={15} /></button>
            </div>

            <div className="asset-grid">
              {filteredAssets.map((asset) => <AssetCard key={asset.id} asset={asset} selected={selectedAsset.id === asset.id} onSelect={() => { setSelectedId(asset.id); setPreviewError(""); }} />)}
              {filteredAssets.length === 0 && <div className="empty-search"><Search size={20} /><strong>No assets found</strong><span>Try a different name, tag, format, or ratio.</span><button className="text-button" onClick={() => { setSearch(""); setCategoryFilter("All assets"); }}>Clear filters</button></div>}
            </div>
          </section>

          <section id="motion-studio" className="studio-section">
            <div className="studio-heading"><div><div className="eyebrow">Workbench <span className="eyebrow-line" /></div><h2>Motion studio</h2></div><div className="studio-heading-right"><span className="canvas-spec"><span className="live-dot" /> LIVE PREVIEW</span><span className="canvas-size">1280 × 720 <span>·</span> 24 FPS</span><button className="icon-button" aria-label="Studio options"><MoreHorizontal size={17} /></button></div></div>
            <div className="studio-layout">
              <div className="preview-column">
                <div className="preview-frame">
                  <div className="preview-toolbar"><span className="preview-title"><span className="preview-file-icon"><Film size={12} /></span>{selectedAsset.name}<span className="preview-file-ext">.motion</span></span><span className="preview-tool-actions"><span className="quality-indicator">HD</span><button className="preview-tool-button" aria-label="Fit canvas"><ArrowLeftRight size={14} /></button><button className="preview-tool-button" aria-label="More preview actions"><MoreHorizontal size={15} /></button></span></div>
                  {previewError ? <div className="preview-fallback" role="alert"><Sparkles size={20} /><strong>Preview unavailable</strong><span>{previewError}</span><button className="text-button" onClick={() => { setPreviewError(""); try { renderAt(playhead); } catch (cause) { showPreviewError(cause instanceof Error ? cause.message : "The canvas preview could not be rendered."); } }}>Retry preview</button></div> : <div className="canvas-wrap"><canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} aria-label={`Live motion preview for ${selectedAsset.name}`} /></div>}
                  <div className="preview-controls"><button className="play-button" aria-label={playing ? "Pause preview" : "Play preview"} onClick={() => setPlaying((current) => !current)}>{playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button><span className="play-time">{playhead.toFixed(2)}<span> / 05.00</span></span><input aria-label="Timeline playhead" className="timeline-scrubber" type="range" min="0" max={LOOP_SECONDS} step="0.01" value={playhead} onChange={(event) => { const time = Number(event.target.value); setPlaying(false); setPlayhead(time); renderAt(time); }} /><span className="loop-label"><span className="loop-icon">↻</span> LOOP</span><button className="icon-button fullscreen-button" aria-label="Preview settings"><Settings2 size={15} /></button></div>
                </div>
                <div className="timeline-editor">
                  <div className="timeline-ruler"><span>00:00</span><span>01:00</span><span>02:00</span><span>03:00</span><span>04:00</span><span>05:00</span></div>
                  <div className="timeline-track">
                    <span className="track-label"><span className="track-color" /> TITLE</span>
                    <div className="track-lane"><div className="track-clip title-clip" style={{ left: `${motion.markerStart * 100}%`, width: `${(motion.markerEnd - motion.markerStart) * 100}%` }}><span>●</span> {selectedAsset.name} — headline</div></div>
                  </div>
                  <div className="timeline-track subtitle-track">
                    <span className="track-label"><span className="track-color track-color-soft" /> SUBTITLE</span>
                    <div className="track-lane"><div className="track-clip subtitle-clip" style={{ left: `${Math.min(96, motion.markerStart * 100 + 8)}%`, width: `${Math.max(8, (motion.markerEnd - motion.markerStart) * 70)}%` }}>Supporting copy</div></div>
                  </div>
                  <span className="timeline-playhead" style={{ left: `${playhead / LOOP_SECONDS * 100}%` }}><i /></span>
                </div>
              </div>

              <aside className="inspector">
                <div className="inspector-header"><span>INSPECTOR</span><button className="icon-button" aria-label="Inspector options"><MoreHorizontal size={16} /></button></div>
                <div className="inspector-scroll">
                  <div className="inspector-asset">
                    <AssetArtwork asset={selectedAsset} compact />
                    <div><span className="inspector-category">{selectedAsset.category}</span><strong>{selectedAsset.name}</strong><span className="inspector-meta">{selectedAsset.format} <i /> {selectedAsset.ratio} <i /> {selectedAsset.duration}</span></div>
                  </div>
                  <div className="inspector-group"><SectionLabel>Text layers</SectionLabel><label className="field-label inspector-label">Headline<input value={motion.title} maxLength={55} onChange={(event) => updateMotion("title", event.target.value)} /></label><label className="field-label inspector-label">Supporting copy<input value={motion.subtitle} maxLength={65} onChange={(event) => updateMotion("subtitle", event.target.value)} /></label></div>
                  <div className="inspector-group">
                    <SectionLabel>Appearance</SectionLabel>
                    <div className="color-row"><div><span className="control-title">Stroke color</span><span className="control-subtitle">Headline outline</span></div><label className="color-picker"><input type="color" value={motion.strokeColor} onChange={(event) => updateMotion("strokeColor", event.target.value)} aria-label="Headline stroke color" /><span style={{ backgroundColor: motion.strokeColor }} /><span className="color-hex">{motion.strokeColor.toUpperCase()}</span></label></div>
                    <div className="range-setting"><div className="range-title"><span>Motion blur</span><span>{motion.blur.toFixed(1)} <small>px</small></span></div><input type="range" min="0" max="12" step="0.5" value={motion.blur} onChange={(event) => updateMotion("blur", Number(event.target.value))} aria-label="Motion blur intensity" /></div>
                  </div>
                  <div className="inspector-group marker-group">
                    <SectionLabel>Timeline markers <Clock3 size={13} /></SectionLabel>
                    <div className="marker-row"><span><i className="marker-dot marker-in" /> In point</span><input type="range" min="0" max={motion.markerEnd - 0.05} step="0.01" value={motion.markerStart} onChange={(event) => updateMotion("markerStart", Number(event.target.value))} aria-label="In point marker" /><b>{(motion.markerStart * LOOP_SECONDS).toFixed(1)}s</b></div>
                    <div className="marker-row"><span><i className="marker-dot marker-out" /> Out point</span><input type="range" min={motion.markerStart + 0.05} max="1" step="0.01" value={motion.markerEnd} onChange={(event) => updateMotion("markerEnd", Number(event.target.value))} aria-label="Out point marker" /><b>{(motion.markerEnd * LOOP_SECONDS).toFixed(1)}s</b></div>
                    <div className="marker-track"><i style={{ left: `${motion.markerStart * 100}%`, width: `${(motion.markerEnd - motion.markerStart) * 100}%` }} /></div>
                  </div>
                  <div className="inspector-group tags-group"><SectionLabel>Asset tags <Tag size={13} /></SectionLabel><div className="tag-list">{selectedAsset.tags.map((tag) => <span className="asset-tag" key={tag}>{tag}<button onClick={() => removeTag(tag)} aria-label={`Remove ${tag} tag`}><X size={10} /></button></span>)}{selectedAsset.tags.length === 0 && <span className="tags-empty">No tags yet</span>}</div><form className="tag-input" onSubmit={addTag}><Plus size={13} /><input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} placeholder="Add a tag…" aria-label="Add a tag" /><button type="submit" aria-label="Save tag"><ArrowUpRight size={13} /></button></form>{tagError && <span className="inline-error tag-error" role="alert">{tagError}</span>}</div>
                </div>
                <div className="inspector-footer"><span><span className="footer-check"><Check size={11} /></span> Saved locally</span><button className="reset-button" onClick={() => setMotion(defaultMotion)}>Reset settings</button></div>
              </aside>
            </div>

            <div className="export-bar">
              <div className="export-intro"><span className="export-icon"><ArrowDownToLine size={17} /></span><div><strong>Ready for the timeline?</strong><span>Render this motion study as a file.</span></div></div>
              <div className="export-actions"><button className="button button-export-secondary" disabled={exportStatus.kind === "rendering"} onClick={() => void runExport("png")}><Layers3 size={14} /> PNG sequence <ChevronDown size={13} /></button><button className="button button-primary export-primary" disabled={exportStatus.kind === "rendering"} onClick={() => void runExport("webm")}><ArrowDownToLine size={14} /> Export WebM <ChevronDown size={13} /></button></div>
            </div>
            {exportStatus.kind === "rendering" && <div className="export-progress" role="status"><div className="progress-copy"><span><LoaderCircle size={13} className="spin" /> {exportStatus.label}</span><span>{Math.round(exportStatus.progress * 100)}%</span></div><div className="progress-track"><i style={{ width: `${exportStatus.progress * 100}%` }} /></div><span className="export-note">Keep this tab open while your browser renders the frames.</span></div>}
            {exportStatus.kind === "error" && <div className="export-message error-message" role="alert"><span>{exportStatus.message}</span><button onClick={() => setExportStatus({ kind: "idle" })} aria-label="Dismiss export error"><X size={14} /></button></div>}
            {exportStatus.kind === "success" && <div className="export-message success-message" role="status"><Check size={14} /><span>{exportStatus.message}</span><button onClick={() => setExportStatus({ kind: "idle" })} aria-label="Dismiss export success"><X size={14} /></button></div>}
          </section>
          <footer className="page-footer"><span>FRAMEVAULT STUDIO <span>·</span> VERSION 1.0</span><span>MADE FOR THE DETAILS <Sparkles size={12} /></span></footer>
        </div>
      </main>
      {dialogOpen && <AddAssetDialog onClose={() => setDialogOpen(false)} onAdd={addAsset} />}
    </div>
  );
}

export { App };
