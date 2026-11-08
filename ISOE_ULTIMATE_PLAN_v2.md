# IMAGE SEAL OVERLAY EDITOR: Ultimate Master Plan v2.0

*(ফাইলের নাম: `ISOE_ULTIMATE_PLAN_v2.md`)*

আপনার মূল প্ল্যানের কোনো ফিচার বাদ দিইনি। প্রতিটি ফিচারে এই বিষয়গুলো যোগ করেছি:

- নির্দিষ্ট লাইব্রেরি ও প্রযুক্তি
- বাস্তব কাজ করার পদ্ধতি
- পাস/ফেইল যাচাইয়ের শর্ত (Acceptance Criteria)
- সিল, সই ও প্রিন্টের বাস্তবসম্মত (physical) আচরণ

আপনার সোর্স কোড আমি দেখিনি, তাই "বিদ্যমান স্ট্যাক" ধরে নিয়ে কিছু লিখিনি। Step 0 তে AI এজেন্ট আগে কোড অডিট করবে।

---

## 0. MASTER INSTRUCTION (AI কোডিং এজেন্টকে প্রথমে এটি দিন)

```
তুমি একজন Senior Full-Stack Engineer। নিচের প্ল্যান অনুযায়ী "Image Seal Overlay Editor" অ্যাপটিকে
পূর্ণাঙ্গ Offline-first Document + PDF + Image + Seal + Signature + Prompt Studio-তে রূপান্তর করবে।

কাজের নিয়ম:
1. কাজ শুরুর আগে বর্তমান প্রজেক্ট অডিট করো: স্ট্যাক, ফোল্ডার স্ট্রাকচার, বিদ্যমান ফিচার তালিকা,
   বিল্ড কমান্ড। ফলাফল docs/AUDIT.md এ লেখো।
2. বিদ্যমান প্রতিটি ফিচারের জন্য আগে Regression Test (বা অন্তত Playwright smoke test) লেখো।
   এগুলো পাস না করা পর্যন্ত নতুন কোড লিখবে না।
3. একবারে একটি Phase / একটি Module করো। প্রতি Module শেষে: build + lint + typecheck + সব test চালাও।
4. কোনো বাটন Demo/Placeholder থাকবে না। কাজ না করলে সেই বাটন UI-তে দেখাবে না।
5. কোনো ফাইল বা API Key ব্যবহারকারীর স্পষ্ট সম্মতি ছাড়া নেটওয়ার্কে যাবে না।
6. প্রতিটি Phase শেষে দেবে: সম্পূর্ণ পরিবর্তিত ফাইল (snippet নয়), CHANGELOG.md, TEST_REPORT.md,
   এবং Definition of Done চেকলিস্ট।
7. কোনো কিছু বাস্তবায়ন করা সম্ভব না হলে (লাইব্রেরি সীমাবদ্ধতা, ব্রাউজার সীমাবদ্ধতা),
   চুপচাপ বাদ না দিয়ে docs/LIMITATIONS.md এ কারণসহ লেখো এবং বিকল্প দাও।
```

---

## 1. অপরিবর্তনীয় নিয়ম (Non-Negotiables)

1. বর্তমান কোনো ফিচার মুছবে না, আচরণও বদলাবে না।
2. মূল সোর্স কোড ও ফোল্ডার স্ট্রাকচার রক্ষা করতে হবে। নতুন কোড `src/modules/*`-এ যাবে।
3. প্রতিটি Tool বাস্তবে চলবে এবং Export করা ফাইল আসলেই খুলতে হবে।
4. Offline-first: মূল সব ফিচার ইন্টারনেট ছাড়া চলবে। শুধু ঐচ্ছিক AI Cloud ফিচার নেট লাগবে।
5. বাংলা, ইংরেজি ও আরবি (RTL সহ) Rendering সঠিক হতে হবে।
6. Mobile ও Desktop সমান গুরুত্ব পাবে।
7. প্রতিটি পরিবর্তনের পর Production Build সফল হতে হবে।

### নৈতিক ও আইনি সীমারেখা (Guardrails)
- **Government-style Seal** মানে জেনারিক নমুনা ডিজাইন। কোনো বাস্তব সরকারি প্রতীক, লোগো বা অফিসিয়াল সিলের হুবহু নকল তৈরির টেমপ্লেট থাকবে না। এই মোডে "SAMPLE / নমুনা" ওয়াটারমার্কের অপশন ডিফল্ট চালু থাকবে এবং ব্যবহারকারী নিজে বন্ধ করতে পারবেন।
- **Engineering Seal** হবে শুধু ডিজাইন টুল। প্রকৃত Professional Engineer সিল বা লাইসেন্স নম্বর যাচাই করে না, এটা UI-তে লেখা থাকবে।
- **PDF Password Removal** শুধু ব্যবহারকারী সঠিক পাসওয়ার্ড দিলে কাজ করবে। কোনো Brute-force বা Cracking থাকবে না।
- **Visual Signature ≠ Digital Signature।** ছবির সই আইনি ডিজিটাল স্বাক্ষর নয়। বাস্তব স্বাক্ষরের জন্য আলাদা Certificate-based মডিউল (§9.5) থাকবে।

---

## 2. প্রযুক্তি স্ট্যাক (সুপারিশ)

বিদ্যমান স্ট্যাক ঠিক থাকলে সেটাই রাখুন। শুধু নিচের লাইব্রেরিগুলো যোগ করুন। যদি স্ট্যাক ঠিক না থাকে, তাহলে TypeScript + Vite + React + PWA ব্যবহার করুন।

| কাজ | লাইব্রেরি / পদ্ধতি | কেন |
|---|---|---|
| PDF Render | `pdfjs-dist` (Worker-এ) | Viewer, Thumbnail, Text Layer |
| PDF Edit (Merge/Split/Rotate/Meta) | `pdf-lib` | হালকা, Pure JS |
| **PDF Encrypt / Redact / Repair / Flatten** | `mupdf` (WASM) এবং/অথবা `qpdf-wasm` | `pdf-lib` এ Encryption ও প্রকৃত Redaction নেই |
| Canvas Editor | `Konva` বা `Fabric.js` | Layers, Drag, Transform, Snap |
| Complex Script Shaping | `harfbuzzjs` + `fontkit` | বাংলা যুক্তাক্ষর ও আরবি Joining ঠিক রাখা |
| Rich Text | `Tiptap` বা `Lexical` | RTL, Bidi, Font Control |
| ZIP | `fflate` / `client-zip` (Streaming) | বড় Batch-এ মেমোরি বাঁচায় |
| DOCX | `docx` | Prompt/Doc Export |
| QR | `qr-code-styling` + `jsQR` (যাচাই) | Logo QR ও Decode Test |
| Barcode | `bwip-js` বা `JsBarcode` | Code128, EAN13, UPC-A, Code39, ITF |
| OCR | `tesseract.js` (ben+eng+ara) | Offline OCR |
| Background Removal | `@imgly/background-removal` (ONNX/WASM) | Local, একবার Model ক্যাশ হলে Offline |
| Vectorize (SVG) | `imagetracerjs` / `potrace` | শুধু উপযুক্ত কনটেন্টে |
| EXIF | `exifr` | Metadata Viewer / Strip |
| Storage | `idb` (IndexedDB) + OPFS (বড় ফাইল) | Project, Library, Cache |
| Search | `MiniSearch` | Prompt/Tool/Project Search |
| i18n | `i18next` (bn / en / ar) | RTL স্যুইচ |
| Sanitize | `DOMPurify` | SVG ও HTML আমদানি |
| PWA | `Workbox` | Offline, Install |
| Test | `Vitest`, `Playwright`, `pixelmatch`, `axe-core`, `Lighthouse CI` | পূর্ণ কভারেজ |

---

## 3. আর্কিটেকচার

```
src/
 ├─ core/
 │   ├─ pipeline/        # File intake → validate → decode → process → encode
 │   ├─ workers/         # Worker pool (pdf, image, zip, ocr, ai)
 │   ├─ memory/          # Canvas pool, ImageBitmap release, URL revoke, tile renderer
 │   ├─ storage/         # IndexedDB/OPFS, quota, persist(), cleanup
 │   ├─ project/         # Schema, migrations, autosave, snapshots, .isoe zip
 │   ├─ export/          # Export Center job queue, size estimator, history
 │   ├─ fonts/           # Font loader, fallback chains, shaping
 │   ├─ i18n/            # bn, en, ar locales
 │   ├─ security/        # validators, sanitizers, limits, privacy
 │   ├─ commands/        # Undo/Redo (Command pattern), shortcuts, command palette
 │   └─ registry/        # Tool Registry (প্রতিটি মডিউল নিজেকে রেজিস্টার করে)
 ├─ modules/
 │   ├─ pdf-studio/  image-studio/  seal-studio/  signature-studio/
 │   ├─ prompt-studio/  document-studio/  text-studio/  qr-barcode/
 │   ├─ engineering/  batch/  ai-assistant/  projects/  export-center/
 ├─ ui/                  # Design tokens, Layout, Components
 ├─ legacy/              # বিদ্যমান কোড (অক্ষত)
 └─ tests/ (unit, integration, e2e, golden, perf)
```

**Tool Registry:**
```ts
registerTool({
  id: 'pdf.compress', module: 'pdf-studio',
  titleKey: 'tools.pdf.compress', icon, keywords: ['size','কমানো','ضغط'],
  offline: true, requiresAI: false,
  component: () => import('./Compress'),   // Lazy-load
});
```
নতুন Tool যোগ মানে একটি ফাইল ও একটি রেজিস্ট্রেশন। এতে Dashboard, Search ও Shortcut স্বয়ংক্রিয়ভাবে আপডেট হয়।

**Performance বাজেট:**
- Initial JS ≤ 300 KB (gzip)।
- WASM মডেল (mupdf, tesseract, ONNX) শুধু প্রথম ব্যবহারে Lazy-load হবে, তারপর Service Worker-এ ক্যাশ হবে।
- ভারী কাজ (PDF, Image, ZIP, OCR) সবসময় Web Worker-এ চলবে, যাতে UI ফ্রিজ না হয়।

---

## 4. Core Engine (সব মডিউলের ভিত্তি)

### 4.1 File Pipeline ও Memory Management
- Intake → **Magic-byte যাচাই** (শুধু এক্সটেনশন নয়) → Size/Pixel Limit → Decode → Process → Encode।
- বড় Image: `createImageBitmap(file, {resizeWidth})` দিয়ে Preview ছোট রাখা। Export-এর সময় Tile-by-tile রেন্ডার।
- Canvas সীমা: iOS/Android-এ প্রায় ১৬ মেগাপিক্সেলের বেশি Canvas ব্যর্থ হতে পারে। তাই Max Canvas ডিভাইস অনুযায়ী Auto-detect করা হবে এবং বড় হলে Tile Export হবে।
- PDF: শুধু দৃশ্যমান পেজ Render (Virtualized List)। বাকি পেজে Placeholder।
- প্রতিটি ব্যবহারের পর `canvas.width = 0`, `ImageBitmap.close()`, `URL.revokeObjectURL()` বাধ্যতামূলক।
- Memory Pressure: `performance.memory` (যেখানে আছে) ও `navigator.deviceMemory` দেখে Batch Concurrency কমানো।

### 4.2 Project Format (`.isoe` = ZIP)
```
manifest.json     { schemaVersion, appVersion, createdAt, modules[] }
project.json      লেয়ার, অবজেক্ট, পেজ, সেটিংস
assets/           মূল ছবি, ফন্ট, লোগো (Hash দিয়ে ডিডুপ)
thumbs/           প্রিভিউ
history/          Snapshot Diff
```
- `schemaVersion` + Migration ফাংশন: পুরোনো প্রজেক্ট সবসময় খুলতে হবে।
- Autosave: পরিবর্তনের ২ সেকেন্ড পর (debounce) এবং `visibilitychange`/`pagehide`-এ।
- Snapshot Ring Buffer: শেষ ২০টি ভার্সন। Crash Recovery: পরের বার খোলার সময় "অসংরক্ষিত কাজ পুনরুদ্ধার করবেন?" প্রম্পট।
- `navigator.storage.persist()` অনুরোধ এবং `estimate()` দিয়ে কোটা দেখানো।

### 4.3 Undo/Redo
সব এডিট Command Pattern-এ। Undo স্ট্যাক সীমা ১০০ ধাপ। ছবির ডেটা Delta হিসেবে সংরক্ষণ হবে, সম্পূর্ণ কপি নয়।

### 4.4 Export Center (Job Queue)
- সব মডিউল `exportQueue.add(job)` ব্যবহার করবে।
- ফলাফল: Preview, **আসল Encode করে File Size** (অনুমান শুধু বড় Batch-এ), Custom Filename (Safe-name Sanitize), Download History (IndexedDB)।
- Format: PNG, JPG, WEBP, PDF, ZIP, TXT, DOCX, JSON, SVG, `.isoe`।
- Custom Resolution/DPI: PNG-তে `pHYs` চাঙ্ক, JPG-তে JFIF DPI লিখতে হবে। এতে প্রিন্টে সঠিক সাইজ আসে।

---

## 5. মডিউল ১: AI PROMPT STUDIO (সম্পূর্ণ Offline-সক্ষম)

### 5.1 Prompt Engine (API ছাড়াই)
একটি **Slot-based Template Engine**:

```
Subject | Action | Environment | Style | Mood | Color Palette | Lighting | Camera/Lens |
Composition | Detail Level | Quality Tags | Aspect Ratio | Negative Prompt | Model Params
```

- ব্যবহারকারীর সাধারণ ইনপুট থেকে Keyword/Intent বের করা হবে (Category Detect)।
- প্রতিটি Category-র জন্য আলাদা Slot Dictionary (JSON) থাকবে।

### 5.2 Model-specific Adapter

একই Prompt ভিন্ন টুলের ফরম্যাটে Output দেবে:

| টার্গেট | আউটপুট ফরম্যাট |
|---|---|
| Midjourney | বর্ণনামূলক + `--ar 16:9 --style raw --v 6 --no ...` |
| Stable Diffusion | Keyword + `(weight:1.2)` + আলাদা Negative Prompt + Steps/CFG/Sampler পরামর্শ |
| DALL·E / ChatGPT Image | প্রাকৃতিক ভাষার অনুচ্ছেদ |
| Sora / Runway / Veo / Kling | Scene + Camera Movement + Duration + FPS + Lens + Lighting Timeline |
| Coding / Website / App | Role + Context + Requirements + Tech Stack + Constraints + Output Format + Acceptance Criteria |
| Business / Marketing / Social | Role + Audience + Tone + Goal + Format + CTA + Length |

### 5.3 Generator (১৬টি ধরন) — প্রতিটির নিজস্ব ফর্ম
উদাহরণ Photography: Camera Body, Lens (35mm/85mm), Aperture, ISO, Shutter, Lighting Setup (Rembrandt, Softbox, Golden Hour), Background, Retouch।
উদাহরণ Logo: Brand Name, Industry, Symbol Idea, Color, Typography Style, Usage (Print/Web), Vector-ready নির্দেশ।

### 5.4 One → Many
- Logo উদাহরণের ১০ স্টাইল (Minimalist, 3D, Luxury, Corporate, Gradient, Typography, Realistic, Brand Identity, Flat Vector, Futuristic) প্রতিটির নিজস্ব Style Pack (Keyword, Lighting, Material, Negative)।
- অন্যান্য Category-র জন্যও ৮–১২টি Style Pack।

### 5.5 Variations (5/10/20/50)
- Seeded Combinatorial Mixer (একই Seed = একই ফলাফল, Reproducible)।
- **Deduplication:** Jaccard Similarity ০.৭-এর বেশি হলে বাদ, যাতে ৫০টি সত্যিই আলাদা হয়।
- নিয়ন্ত্রণ: কোন Slot বদলাবে (শুধু Style / Lighting / Camera / সব)।

### 5.6 Enhancer
Lighting, Camera, Composition, Style, Quality ও Technical নির্দেশ যোগ করে। আলাদা Negative Prompt তৈরি করে (Category ভিত্তিক: blurry, extra fingers, watermark, distorted text...)। UI-তে Before/After Diff Highlight।
ঐচ্ছিক: AI Provider কনফিগার থাকলে LLM দিয়ে আরও উন্নত করা যায়। না থাকলেও Rule-based Enhancer পুরোপুরি কাজ করবে।

### 5.7 Library
My / Favorite / Recent / Collections / Categories / Tags / Notes। Search: MiniSearch (বাংলা ও ইংরেজি Tokenization)। Import/Export JSON (Schema Version সহ)।

### 5.8 Export
| ফরম্যাট | বিবরণ |
|---|---|
| **PDF** | Cover Page (Title, তারিখ, Logo), Prompt Name, Original, Enhanced, Negative, Variations, Category, Notes, Page Number, বাংলা/আরবি ফন্ট Embedded |
| TXT | UTF-8 |
| DOCX | `docx` লাইব্রেরি (Heading, Table, Page Number) |
| JSON | Schema Version সহ |
| Markdown | Frontmatter + তালিকা |

**Acceptance:** বাংলা ও আরবি লেখাসহ PDF খুলে Text Copy করলে লেখা ঠিক আসে। DOCX Microsoft Word / LibreOffice-এ খোলে।

### 5.9 Templates (১০টি)
Logo, Website, Mobile App, YouTube Thumbnail, Facebook Banner, Instagram Post, AI Portrait, Product Ad, Cinematic Video, Professional Website Development। প্রতিটিতে সঠিক Aspect Ratio ও প্ল্যাটফর্ম আকার প্রি-সেট (যেমন YouTube 1280×720, Instagram 1080×1350)।

---

## 6. মডিউল ২: ADVANCED PDF STUDIO

| # | ফিচার | বাস্তবায়ন |
|---|---|---|
| 1 | Merge | `pdf-lib copyPages`, Drag-reorder, Bookmark সংরক্ষণ |
| 2 | Split | Range / প্রতি N পেজ / Bookmark অনুযায়ী / সাইজ অনুযায়ী |
| 3 | Compress | Image Re-sample (DPI Target) + JPEG Re-encode + Object Stream + Unused Object Removal। ৩ লেভেল + Custom। Before/After সাইজ দেখাবে। যদি ফাইল ছোট না হয়, মূলটিই ফেরত দেবে |
| 4 | Rotate | ৯০/১৮০/২৭০, নির্বাচিত পেজ |
| 5–8 | Reorder / Delete / Extract / Duplicate | Thumbnail Grid, Multi-select, Undo |
| 9 | Crop | CropBox/MediaBox সঠিকভাবে সেট, Visual Selector |
| 10 | Resize | A3/A4/A5/Letter/Legal/Custom, Fit/Fill/Scale |
| 11 | Watermark | Text/Image, Opacity, Rotation, Tile, পেজ রেঞ্জ, বাংলা/আরবি ফন্ট |
| 12 | **Password Protect** | `mupdf`/`qpdf-wasm` দিয়ে AES-256। Permission (Print/Copy/Edit) আলাদা |
| 13 | Password Removal | শুধু সঠিক পাসওয়ার্ড দিলে। ভুল হলে স্পষ্ট ত্রুটি |
| 14 | Metadata Editor | Title, Author, Subject, Keywords + XMP। "Strip All Metadata" |
| 15 | Page Numbers | ফরম্যাট (১,২,৩ / 1,2,3 / i,ii / "Page X of Y"), পজিশন, Start From |
| 16 | Header/Footer | Token: `{page} {pages} {date} {title}` |
| 17 | Bookmarks | Tree Editor (Nested) |
| 18 | TOC | Bookmark থেকে স্বয়ংক্রিয় TOC পেজ + Internal Link |
| 19 | Search | pdf.js Text Layer, Highlight, বাংলা/আরবি Normalization |
| 20 | Text Extract | পেজ অনুযায়ী TXT/JSON। স্ক্যান PDF হলে OCR-এর অফার |
| 21 | Image Extract | মূল Resolution-এ, ZIP-এ |
| 22 | Compare | Text Diff + Pixel Diff (`pixelmatch`), পাশাপাশি/Overlay |
| 23 | Flatten | Form Field ও Annotation ছবিতে/কনটেন্টে মার্জ |
| 24 | Repair | `qpdf`/`mupdf` Rebuild XRef; ব্যর্থ হলে পেজ-বাই-পেজ উদ্ধার |
| 25 | Print Optimization | Bleed/Crop Marks, Grayscale, DPI, Booklet Imposition |

### Advanced Export
A3/A4/A5/Letter/Legal/Custom (mm/in/px), Portrait/Landscape, DPI (72/150/300/600), Compression Level, File Size Preview।

### 🔒 প্রকৃত Redaction (সর্বোচ্চ গুরুত্ব)
শুধু কালো বক্স আঁকা **নিষিদ্ধ**। বাস্তবায়ন:
1. ব্যবহারকারী এলাকা/টেক্সট/Regex Pattern (ফোন, NID, ইমেইল, কার্ড নম্বর) দিয়ে Mark করবে।
2. `mupdf` `applyRedactions` ব্যবহার করে: Content Stream থেকে টেক্সট **মুছে ফেলা**, ওই এলাকার Image Pixel **মুছে ফেলা**, Vector Path কাটা।
3. সম্পর্কিত Metadata, Annotation, Bookmark, Form Field, Hidden Layer, Thumbnail, XMP থেকেও সরানো।
4. সেভের সময় Full Rewrite (Incremental Save নয়), যাতে পুরোনো ডেটা ফাইলে না থাকে।

**স্বয়ংক্রিয় Verification Test (প্রতি Redaction-এ চলবে):**
- Redact করা PDF থেকে pdf.js দিয়ে Text Extract → গোপন স্ট্রিং থাকলে **ফেইল**।
- Raw Bytes-এ (Decompress করে) গোপন স্ট্রিং Search → পেলে **ফেইল**।
- Rendered Image-এ ওই এলাকা Solid কিনা যাচাই।
- ব্যবহারকারীকে "Verification Passed ✔" রিপোর্ট দেখানো।

---

## 7. মডিউল ৩: ADVANCED IMAGE STUDIO

- **Non-destructive Layers:** প্রতি লেয়ারের Opacity, Blend Mode (Multiply, Screen, Overlay), Mask, Lock/Hide।
- Crop (Free/Ratio/Circle), Resize (Lanczos / Pica দিয়ে মানসম্পন্ন), Rotate (যেকোনো কোণ), Flip।
- Adjustments (Brightness, Contrast, Saturation, Sharpness, Blur): WebGL/OffscreenCanvas ফিল্টার, Live Preview।
- Filters: Grayscale, Sepia, Vintage, B&W Document (স্ক্যান ক্লিনআপ), Auto-Enhance।
- Border, Drop Shadow (Blur, Offset, Color, Opacity), Rounded Corners।
- **Background Removal:** Local ONNX মডেল। প্রথমবার মডেল ডাউনলোড (সাইজ দেখিয়ে সম্মতি নিয়ে), তারপর Offline। Edge Refine ব্রাশ (Restore/Erase)। Transparent PNG/WEBP Export।
- Compare: Before/After Slider।
- Metadata Viewer (`exifr`): EXIF, GPS (সতর্কতাসহ), "Strip Metadata on Export" অপশন।
- **SVG Export:** শুধু লোগো/আইকন/সিল/সিগনেচারের মতো Vector-উপযোগী কনটেন্টে। ফটোর ক্ষেত্রে UI বলবে "ফটো SVG-তে রূপান্তর করলে মান নষ্ট হয়" এবং Trace-মোড আলাদা লেবেলে দেখাবে।
- Export: PNG, JPG (Quality Slider + লাইভ সাইজ), WEBP, SVG, PDF (পেজ সাইজ নির্বাচনসহ)।

---

## 8. মডিউল ৪: SEAL & SIGNATURE STUDIO

### 8.1 Seal Generator (SVG-ভিত্তিক, Resolution-independent)
- আকার: Round, Square, Rectangle, Oval, Company, Government-style (নমুনা), Engineering, Logo Seal, Transparent।
- **Circular Text:** SVG `<textPath>`। Arc Start/End, Text Spacing, Inside/Outside, বাংলা/আরবি Shaping ঠিক রেখে।
- Multi-ring (২–৫টি), মাঝখানে Symbol/Star/Logo, Inner/Outer Border (Single/Double/Dotted/Guilloche Pattern)।
- Rotation, Color, Transparency, Font/Size/Weight।
- Export: SVG, Transparent PNG (300/600/1200 DPI), PDF Vector।

### 8.2 Realistic Stamp Mode (Physical Realism)
সিলকে কাগজে বসা বাস্তব রাবার স্ট্যাম্পের মতো দেখাতে:

| প্রভাব | কৌশল |
|---|---|
| কালির অসম চাপ | SVG `feTurbulence` + `feDisplacementMap` দিয়ে প্রান্ত ভাঙা |
| কালির ঘনত্বের তারতম্য | Perlin Noise Mask, কিছু অংশ হালকা |
| কাগজে মিশে যাওয়া | Blend Mode = Multiply (নিচের লেখা/টেক্সচার দেখা যায়) |
| কালি ছড়িয়ে পড়া | হালকা Gaussian Blur Halo (Ink Bleed) |
| ছোট অনিয়ম | ০.৫–২° র‍্যান্ডম Rotation, সামান্য Skew (Seed সহ, পুনরায় তৈরি যায়) |
| কাগজের দানা | Paper Grain Texture Overlay |
| Preset | Fresh Ink / Worn / Faded / Heavy Press |

প্রতিটি স্লাইডারে "Realism: Off / Light / Strong" এবং "Clean Vector Mode" দুটোই থাকবে। ক্লিন Vector মোড অফিসিয়াল Layout-এর জন্য।

### 8.3 Signature Studio
- **Freehand:** Pointer Events (Mouse/Touch/Stylus), `pressure` ও গতি অনুযায়ী লাইন Width পরিবর্তন (Variable-width Bezier, `signature_pad` অ্যালগরিদম), Smoothing, Undo/Clear।
- **Typed:** ১০+ হাতের লেখা ধাঁচের ফন্ট (ইংরেজি ও বাংলা Script ফন্ট, লাইসেন্স যাচাই করে)।
- **Upload:** কাগজে সই তুলে ছবি → Auto Threshold + Background Remove → Transparent PNG।
- Color, Thickness, Slant, Transparent PNG/SVG Export।
- Signature Library (IndexedDB), পেজে বসানো: Drag, Resize, Rotate, Multi-page Apply, "সব পেজে" অপশন।

### 8.4 Cryptographic Digital Signature (আলাদা ও নিরাপদ মডিউল)
- Visual Signature থেকে **সম্পূর্ণ আলাদা** UI ও সতর্কবার্তা।
- PAdES-ধরনের স্বাক্ষর: ব্যবহারকারীর নিজস্ব `.p12/.pfx` সার্টিফিকেট আপলোড (শুধু মেমোরিতে, কোথাও সংরক্ষণ হবে না), পাসওয়ার্ড চাওয়া, `pkijs` বা `node-forge` দিয়ে Local Signing।
- Signature Validation: স্বাক্ষরিত PDF-এ Integrity ও Certificate Chain যাচাই (সম্ভাব্য সীমাবদ্ধতা `LIMITATIONS.md`-এ)।
- স্পষ্ট নোট: স্ব-স্বাক্ষরিত (Self-signed) সার্টিফিকেট আইনি স্বীকৃতি পায় না।

---

## 9. মডিউল ৫: DOCUMENT DESIGN STUDIO

- **Document Model:** পেজ = mm ইউনিটে JSON; Element = {Text, Image, Shape, Table, QR, Barcode, Seal, Signature}।
- Editor: Drag & Drop, Resize/Rotate Handle, Multi-select, Group, Align/Distribute, **Snap Guides** (Edge/Center/Equal Spacing), Grid (Toggle/Size), Margin Guide, Rulers, Zoom, Multi-page, Layer Panel।
- **Dynamic Fields:** `{{customer_name}}`, `{{date}}`, `{{total}}`। CSV/JSON আমদানি করে প্রতি সারির জন্য একটি ডকুমেন্ট (Mail-merge), এটি Batch-এর সঙ্গে সংযুক্ত।
- **Invoice/Quotation/Receipt:** Line Item Table, স্বয়ংক্রিয় Subtotal/Tax/Discount/Total, **টাকার অঙ্ক কথায়** (বাংলা ও ইংরেজি), Currency (৳, $, ﷼)।
- **Certificate/ID/Visiting Card:** সঠিক ফিজিক্যাল সাইজ (CR80 85.6×54 mm, Visiting Card 90×55 mm), Bleed 3 mm, Crop Marks, Front/Back।
- Templates (১৫টি): Business Letter, Official Letter, Invoice, Receipt, Quotation, Certificate, ID Card, Visiting Card, Company Profile, Project Report, Engineering Report, Attendance Sheet, Application Form, Agreement Template, Delivery Note।
- Reusable Template: যেকোনো ডকুমেন্ট "Save as Template"।
- **Export:** Vector PDF (টেক্সট Selectable, ফন্ট Embedded), PNG, DOCX (মৌলিক লেআউট), `.isoe`।
- ফন্ট না থাকলে Fallback Chain + সতর্কতা।

---

## 10. মডিউল ৬: ADVANCED TEXT STUDIO

- Rich Text (Tiptap/Lexical): Bold/Italic/Underline/Strike, Heading, List, Link, Table, Color, Highlight।
- Spacing: Line Height, Letter Spacing, Paragraph Spacing। Alignment: Left/Right/Center/Justify।
- Effects: Shadow, Stroke/Border, Background, Gradient Fill, Rotation, Curved Text (Arc/Wave)।
- Find & Replace (Regex, Case, Whole Word), Word/Character/Sentence Counter (বাংলা শব্দ গণনা Unicode Segmenter `Intl.Segmenter` দিয়ে)।
- **ফন্ট বান্ডেল (Offline, লাইসেন্স যাচাই করা):**
  - বাংলা: Noto Sans Bengali, Hind Siliguri, Tiro Bangla, Anek Bangla, Noto Serif Bengali
  - আরবি: Noto Naskh Arabic, Amiri, Cairo, Scheherazade New
  - ইংরেজি: Inter, Roboto, Playfair Display, Merriweather, Lora, Montserrat ইত্যাদি
  - সাবসেট করা WOFF2 ব্যবহার করে সাইজ কমানো
- **Bidi:** `dir="auto"`, মিশ্র বাংলা-ইংরেজি-আরবি লাইন সঠিক। RTL ডকুমেন্টে Layout Mirror।

### Rendering Golden Tests (বাধ্যতামূলক)
```
বাংলা:  ক্ষ ক্ষ্ম স্ত্রী দ্ধ ঙ্গ র‍্যাব কর্ম্ম  "বাংলাদেশ গণপ্রজাতন্ত্রী"
আরবি:  بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ   (হারাকাত সহ)
মিশ্র:  Invoice নং ১২৩ — فاتورة رقم 456
```
এই স্ট্রিংগুলো Editor Canvas, PDF Export, PNG Export ও DOCX Export-এ রেন্ডার করে Golden ছবির সঙ্গে `pixelmatch` তুলনা করা হবে। যুক্তাক্ষর ভাঙলে বা আরবি অক্ষর বিচ্ছিন্ন (Disconnected) হলে টেস্ট ফেইল।

> **PDF-এ জটিল লিপি:** শুধু `pdf-lib`+`fontkit` এ সব বাংলা যুক্তাক্ষর নির্ভুল না-ও হতে পারে। তাই HarfBuzz দিয়ে Shaping করে Glyph সরাসরি বসানো হবে। সেটা ব্যর্থ হলে Fallback: ওই টেক্সট ৩০০+ DPI Vector/Image হিসেবে এমবেড করা এবং Hidden Text Layer যোগ করা, যাতে Search/Copy কাজ করে।

---

## 11. মডিউল ৭: QR & BARCODE STUDIO

- **QR Types:** URL, Wi-Fi (`WIFI:T:WPA;S:...;P:...;;`), vCard Contact, Email, Phone, SMS, Geo Location, Text, Business (vCard+লিংক), Payment।
- **Payment QR:** শুধু Payload তৈরি (UPI, EMVCo Static, সাধারণ URL/Text)। বিভিন্ন দেশের নির্দিষ্ট অ্যাপের Private Format গ্যারান্টি নেই বলে UI-তে সতর্কতা দিন।
- Customization: Foreground/Background/Gradient, Dot Style (Square/Rounded/Dots), Eye Style, **Logo Center** (Error Correction স্বয়ংক্রিয়ভাবে H করা, লোগো আকার ≤ ২৫%), Frame + CTA Text ("Scan Me"), Quiet Zone।
- **Scannability Check:** Export-এর আগে `jsQR` দিয়ে Generated QR Decode করে Payload মেলানো। না মিললে সতর্কতা ("কনট্রাস্ট কম / লোগো বড়")।
- Export: PNG (DPI), SVG, PDF।
- **Barcode:** Code128, EAN-13, UPC-A, Code39, ITF। Check Digit স্বয়ংক্রিয় গণনা ও যাচাই, ভুল দৈর্ঘ্যে ত্রুটি বার্তা। Human-readable Text On/Off, Bar Height/Width, Margin।
- Batch Barcode/QR: CSV থেকে একসঙ্গে অনেকগুলো, ZIP বা Sheet PDF (Label Sheet Avery-ধরনের Grid)।

---

## 12. মডিউল ৮: ENGINEERING & TECHNICAL STUDIO

- **Dimension Tools:** Linear, Aligned, Angular, Radius/Diameter, Leader Line। Arrow Style (Closed/Open/Tick), Extension Lines।
- **Units:** mm, cm, m, in, ft; সঠিক গাণিতিক Conversion।
- **Calibration:** ছবি বা PDF-এ জানা দৈর্ঘ্যের দুটি বিন্দু দেখিয়ে Scale সেট করলে বাকি সব পরিমাপ স্বয়ংক্রিয়ভাবে সেই স্কেলে।
- **Scale Calculator:** 1:n ↔ বাস্তব দৈর্ঘ্য, Paper Size ↔ Scale পরামর্শ।
- **Title Block (ISO 7200 ধাঁচ):** Project, Drawing No., Title, Scale, Date, Drawn/Checked/Approved, Sheet X of Y, Company Logo।
- **Drawing Number Generator:** Pattern `{PROJ}-{DISC}-{SEQ:3}-R{REV}`, ক্রম স্বয়ংক্রিয়।
- **Revision Table:** Rev, Date, Description, By, Approved। Approval Status Stamp (Draft/For Review/Approved/Rejected/As-Built)।
- Engineering Grid, Ruler, Snap (Grid/Endpoint/Midpoint/Angle 15°)।
- Technical Notes, Inspection Checklist (Tick/Cross, Pass/Fail, Signature Slot)।
- Custom Technical Stamps (Approved, Checked, Void, Confidential)।
- Annotation: Text, Callout, Cloud-revision Marker, Arrow, Highlight।
- Export: Vector PDF (A0–A5, Scale সংরক্ষিত), PNG, SVG। **Test:** ১০০ mm রেখা A4-তে প্রিন্ট করলে ১০০ mm ±০.৫ mm আসছে কিনা PDF Unit যাচাই।

---

## 13. মডিউল ৯: BATCH PROCESSING STUDIO

- Input: Multi-file Picker, Drag-drop, **Folder Picker** (`webkitdirectory` / File System Access API; Mobile-এ Multi-select Fallback)।
- Operations Pipeline (Chain): উদাহরণ — Resize → Watermark → Seal বসানো → Compress → Convert → Rename।
- Seal Placement: পজিশন (কোণ/শতাংশ/Anchor), Margin, প্রতি পেজ বা শুধু প্রথম/শেষ পেজ, Rotation, Opacity।
- Rename Pattern: `{name}_{index:3}_{date}.{ext}`।
- **Execution:**
  - Worker Pool, Concurrency = `min(hardwareConcurrency − 1, 4)` (Mobile-এ ২)
  - প্রতি ফাইল আলাদা Isolation: একটি ব্যর্থ হলে বাকিগুলো চলবে
  - Progress Bar (ফাইল ও মোট), ETA, Cancel, Retry Failed
  - Streaming ZIP (`fflate`): ৫০–৫০০ ফাইলেও মেমোরি স্থির থাকে
- Error Report: কোন ফাইল, কেন ব্যর্থ, CSV/JSON ডাউনলোড।
- Output: ZIP বা (সমর্থিত ব্রাউজারে) সরাসরি ফোল্ডারে সেভ।
- **Acceptance:** ৫০টি PDF (প্রতিটি ১০ পেজ) এ একই সিল বসিয়ে ZIP ডাউনলোড; টেস্ট ডিভাইসে Tab ক্র্যাশ ছাড়া সম্পন্ন; আউটপুট পেজ সংখ্যা ইনপুটের সমান।

---

## 14. মডিউল ১০: AI DOCUMENT ASSISTANT

### 14.1 Local (API ছাড়া)
| ফিচার | পদ্ধতি |
|---|---|
| Text Extraction | pdf.js |
| OCR / Handwriting (সীমিত) | `tesseract.js` ben+eng+ara, Pre-process (Deskew, Binarize)। হাতের লেখা সীমিত নির্ভুলতার; UI-তে সতর্কতা |
| Summarizer (Basic) | Extractive (TextRank), বাংলা-সচেতন Sentence Split |
| Table Extraction | Text Position Clustering (Row/Column Detect) → CSV/XLSX |
| Invoice Data Extraction | Regex + Keyword Rules (Invoice No, Date, Total, Tax) + User-correctable Review UI |
| Comparison | Text Diff |
| Classification | Keyword/Rule-based |
| Grammar (Basic) | সরল Rule (Double Space, Punctuation) |

### 14.2 Optional Cloud AI (ঐচ্ছিক)
- Provider Abstraction: OpenAI-compatible, Anthropic, Google Gemini, Local (Ollama/LM Studio), Custom Base URL।
- Q&A, Translation, Rewriting, Professional Writing, উন্নত Summary।
- **গোপনীয়তা নিয়ন্ত্রণ:**
  - API Key ডিফল্টে শুধু সেশনে; "Remember" দিলে WebCrypto (AES-GCM) দিয়ে ব্যবহারকারীর Passphrase-এ Encrypt করে IndexedDB-তে।
  - প্রতিটি Cloud কলের আগে **Consent Dialog**: "এই টেক্সট (প্রথম ২০০ অক্ষর Preview, মোট X অক্ষর) [Provider]-এ পাঠানো হবে।"
  - Redact-before-send: সংবেদনশীল Pattern স্বয়ংক্রিয় মাস্ক করার অপশন।
  - কখনো Key লগ/Export/Project ফাইলে যাবে না।
  - AI চালু না থাকলে কোনো Network Request হবে না (Playwright Test দিয়ে যাচাই)।

---

## 15. মডিউল ১১: PROJECT MANAGEMENT

Save, Auto Save, History, Recent, Favorite, Duplicate, Rename, Delete (Trash ৩০ দিন), Backup/Restore (`.isoe` বা সম্পূর্ণ Workspace ZIP), Import/Export, Version History (Snapshot Restore/Compare), Autosave Recovery (§4.2)। Project Card-এ Thumbnail, Module Badge, শেষ সম্পাদনার সময়।

---

## 16. নিরাপত্তা ও গোপনীয়তা

- **Local-only:** CSP `connect-src 'self'` ডিফল্ট; AI Provider চালু করলে শুধু সেই ডোমেইন Allow।
- ইনপুট: Magic-byte যাচাই, Max Size/Pixel/Page Limit (সেটিংসে পরিবর্তনযোগ্য), **Zip-bomb ও Decompression-bomb গার্ড**, PDF JavaScript/Launch Action স্ট্রিপ।
- **SVG Import:** DOMPurify দিয়ে Sanitize (Script/Event Handler/External Ref বাদ)।
- Safe Filename (Path Traversal, Reserved Name, Unicode Normalize)।
- Temporary Data Cleanup: Export শেষে Blob/OPFS Temp মুছে ফেলা; App শুরুতে অনাথ Temp Cleanup।
- **Sensitive Document Warning:** NID/পাসপোর্ট/কার্ড/ফোন Pattern Detect হলে নোটিশ: "সংবেদনশীল তথ্য পাওয়া গেছে — Redaction ব্যবহার করবেন?"
- Privacy Settings: Analytics ডিফল্ট **বন্ধ/অনুপস্থিত**, Clear All Local Data (বোতাম + নিশ্চিতকরণ), Per-project Delete।
- Redaction যাচাই: §6 এর Verification Test।

---

## 17. UI/UX ও DASHBOARD

- **নেভিগেশন (১২টি):** Home, PDF, Image, Seal, Signature, Prompt, Document, QR & Barcode, Engineering, Batch, Projects, Settings।
- Desktop: Sidebar + Top Bar; Mobile: Bottom Nav (৫টি মুখ্য) + "More" Drawer।
- Dashboard: Recent Projects, Quick Actions, Favorite Tools (পিন), Saved Prompts, Recent Downloads, Templates, Usage Statistics (**Local**, শুধু ডিভাইসে)।
- Design Tokens (Color/Spacing/Radius/Typography)। Dark/Light/System Theme।
- ভাষা: বাংলা / English / العربية (RTL Layout Mirror স্বয়ংক্রিয়)।
- **Command Palette** (`Ctrl/Cmd+K`) সব Tool Search। Shortcuts: `Ctrl+Z/Y`, `Ctrl+S`, `Ctrl+E` (Export), `Ctrl+D` (Duplicate), `Del`, `Space+Drag` (Pan), `Ctrl+Scroll` (Zoom), `?` (Shortcut তালিকা)।
- Tooltip, Contextual Help, প্রথমবার Onboarding Tour।
- Accessibility: WCAG 2.1 AA, Keyboard Navigation, Focus Ring, ARIA Label, Reduced Motion।

---

## 18. SETTINGS

ভাষা, Theme, Default Export Format, Default PDF Size, Default Image Quality, Default Seal, Default Font, Save Location Guidance (ব্রাউজার ডাউনলোড ফোল্ডার ব্যাখ্যা + File System Access), Privacy, Storage Management (ব্যবহার-ভিত্তিক বিভাজন), Clear Cache, Backup & Restore, API Configuration, AI Provider Configuration (Connection Test বোতাম), About & Version, Changelog।

---

## 19. MOBILE EXPERIENCE

- Mobile-first Layout, ন্যূনতম Touch Target 44×44 px।
- Pointer Events দিয়ে Pinch-zoom, Two-finger Pan, Long-press Context Menu; `touch-action` সঠিক সেট (Signature Canvas-এ স্ক্রল বন্ধ)।
- Camera: `<input type="file" accept="image/*" capture="environment">` + Document Scan Mode (Perspective Correct + Enhance)।
- Gallery/Files Picker, Share Target (PWA `share_target`)।
- PWA: Manifest, Maskable Icon, Install Prompt, Offline Fallback, Update Notification।
- Android APK দরকার হলে **Capacitor** দিয়ে একই কোডবেস Wrap করুন (Native File Save/Share)।
- Background-safe: দীর্ঘ কাজে `Wake Lock API`, Progress Persist, ট্যাব Hidden হলে Pause/Resume, Crash-এ Recovery।
- Memory: §4.1 এর Tile/Virtualization নিয়ম; Mobile-এ Batch Concurrency = ১–২।

---

## 20. TESTING ও QUALITY GATES

| স্তর | টুল | কী পরীক্ষা |
|---|---|---|
| Unit | Vitest | Prompt Engine, Check Digit, Unit Conversion, Number→Words, Schema Migration |
| Integration | Vitest + jsdom/Worker | PDF Ops, Export Pipeline, Storage |
| E2E | Playwright (Chromium/Firefox/WebKit) | সব Tool-এর Happy Path |
| Mobile | Playwright Device Emulation + বাস্তব Android Chrome ম্যানুয়াল চেকলিস্ট | Touch, Pinch, Camera |
| PDF Render | pdf.js Render → `pixelmatch` Golden | প্রতিটি PDF Op-এর পর |
| Export Validity | Output ফাইল পুনরায় Parse করা (PDF/ZIP/DOCX/PNG খুলে দেখা) | অবৈধ ফাইল = ফেইল |
| Prompt Export | PDF/DOCX/MD/JSON Round-trip | ডেটা সম্পূর্ণ |
| Font | Golden স্ট্রিং (§10) | বাংলা, আরবি, মিশ্র |
| Redaction | Text-extract + Raw-byte Scan | গোপন স্ট্রিং ০ টি |
| Large File | ২০০-পেজ PDF, ৫০ MP Image, ৫০ ফাইল Batch | ক্র্যাশ নেই, সময়সীমা বাজেটে |
| Offline | Playwright `context.setOffline(true)` | সব Local ফিচার চলে; Network Request = ০ |
| Privacy | Request Interceptor | AI বন্ধ থাকলে বাইরে কোনো কল নেই |
| Memory Leak | বারবার Open/Close ×৫০ লুপ + Heap Snapshot | বৃদ্ধি সীমার মধ্যে |
| Accessibility | `axe-core` + ম্যানুয়াল Keyboard | Critical Violation = ০ |
| PWA/Perf | Lighthouse CI | PWA ✔, Performance ≥ ৮৫ (Mobile) |

**Regression Gate (প্রতিটি Module-এর পর):** Lint → Typecheck → Unit → Integration → E2E (পুরোনো ফিচারসহ) → Production Build → Bundle Size Check। একটিও ফেইল হলে পরের ধাপে যাওয়া নিষেধ।

---

## 21. IMPLEMENTATION PHASES ও DEFINITION OF DONE

| Phase | অন্তর্ভুক্ত | Done-এর শর্ত |
|---|---|---|
| **0** | অডিট, Regression Test, `core/` Skeleton, Tool Registry, i18n, Theme | পুরোনো সব ফিচার Test-এ সবুজ; Build সফল |
| **1 Essential** | PDF Compress/Split/Merge+, Image Studio, Export Center, Doc Templates (প্রথম ৫টি), Project Mgmt (Autosave/Recovery/.isoe) | সব Export খোলে; ১০০-পেজ PDF Compress-এ UI ফ্রিজ নেই |
| **2 Creative** | Prompt Studio পূর্ণ (Engine, Adapters, Variations, Library, Export ৫ ফরম্যাট) | ৫০ Variation Dedupe-সহ; PDF-এ বাংলা সঠিক |
| **3 Professional** | Seal+Realistic Mode, Signature, QR/Barcode, Engineering, Batch, **প্রকৃত Redaction**, PDF Encrypt | Redaction Verification Pass; QR Decode Pass; ৫০-PDF Batch Pass |
| **4 AI** | OCR, Local Summarizer/Table/Invoice, Optional Cloud Provider, Consent Flow | AI বন্ধে Network = ০; OCR বাংলা/আরবি নমুনায় চলে |
| **5 Production** | Security Hardening, Perf Tuning, PWA/APK, পূর্ণ Regression, Accessibility | সব Quality Gate সবুজ; Lighthouse লক্ষ্য পূরণ |
| **6 (ঐচ্ছিক ভবিষ্যৎ)** | Cloud Sync, Accounts, Team Workspace, Plugin API, Premium Templates, AI Credit | আলাদা প্রজেক্ট হিসেবে; Offline Core অক্ষত |

---

## 22. সর্বশেষ চেকলিস্ট (Release-এর আগে)

- [ ] পুরোনো প্রতিটি ফিচার আগের মতোই কাজ করছে
- [ ] কোনো Demo/Dead Button নেই
- [ ] প্রতিটি Export ফাইল বাইরের প্রোগ্রামে (Adobe/Chrome/Word/ছবি ভিউয়ার) খোলে
- [ ] বাংলা, আরবি, ইংরেজি Golden Test সবুজ
- [ ] Redaction-এর পর Text Extract ও Raw Scan-এ গোপন তথ্য নেই
- [ ] Offline Mode-এ সব Local ফিচার চলে
- [ ] AI বন্ধ থাকলে কোনো বাইরের Network Request নেই
- [ ] Android Chrome ও Desktop (Chrome/Firefox/Safari) এ পরীক্ষিত
- [ ] বড় ফাইলে মেমোরি Crash নেই
- [ ] `LIMITATIONS.md` ও `CHANGELOG.md` হালনাগাদ
- [ ] Production Build সফল

---

**চূড়ান্ত লক্ষ্য:** একটি Offline-first অ্যাপে PDF Editor + Image Editor + Seal Maker + Signature Maker + Document Creator + Prompt Generator + AI Document Assistant + Batch Studio।

---

### পরবর্তী ধাপ
আপনার বর্তমান সোর্স কোড (বা ফোল্ডার স্ট্রাকচার ও `package.json`) পেস্ট করলে আমি প্রথমে Phase 0 অডিট করে দিতে পারব। তারপর Phase 1 থেকে সম্পূর্ণ কোড ফাইল ধাপে ধাপে লিখে দেব। একসঙ্গে সব কোড দিলে ফাইল এত বড় হবে যে ভুল ও কাটা-পড়া অংশের ঝুঁকি থাকবে, তাই ফেজ ধরে দেওয়াই নিরাপদ।
