/// <reference types="vite/client" />
declare module "*?worker" { const W: { new (): Worker }; export default W; }
declare module "imagetracerjs" { const t: { imagedataToSVG: (d: ImageData, opts?: Record<string, unknown>) => string }; export default t; }
declare module "bwip-js" { const b: { toCanvas: (c: HTMLCanvasElement | string, o: Record<string, unknown>) => HTMLCanvasElement; toSVG: (o: Record<string, unknown>) => string; toBuffer: (o: Record<string, unknown>, cb: (e: unknown, png: Uint8Array) => void) => void }; export default b; }

declare const __APP_VERSION__: string;
