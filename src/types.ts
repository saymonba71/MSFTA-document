export type Seal = {
  id: string;
  name: string;
  src: string;
  aspect: number; // width / height
  builtIn?: boolean;
  kind?: "text" | "qr";
  text?: string;
  color?: string;
  fontFamily?: string;
  background?: string;
};

export type PdfTextItem = {
  id: string;
  page: number;
  text: string;
  /** Centre and size as fractions of the rendered page. */
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  fontName?: string;
  bold?: boolean;
};

export type Page = {
  src: string;
  width: number; // pixel size of rendered page image
  height: number;
  name?: string;
  mime?: string;
};

export type Doc = {
  kind: "image" | "pdf";
  name: string;
  mime: string;
  pages: Page[];
  bytes?: ArrayBuffer;
  textItems?: PdfTextItem[];
};

export type Stamp = {
  id: string;
  page: number;
  sealId: string;
  x: number; // center, fraction of page width
  y: number; // center, fraction of page height
  w: number; // width, fraction of page width
  h?: number; // optional height, fraction of page height (text patches)
  rot: number; // degrees, clockwise
  opacity: number;
  brightness?: number; // percent, 100 = original
  contrast?: number; // percent, 100 = original
  hidden?: boolean;
  locked?: boolean;
  /** "ink" presses into the paper (multiply). "normal" looks pasted on top. */
  blend?: "ink" | "normal";
  /** Repeats this stamp as a faint diagonal watermark. */
  tile?: boolean;
  role?: "page-number";
  origin?: "pdf-text";
  itemId?: string;
  edit?: {
    itemId: string;
    text: string;
    sizeMultiplier: number;
    color: string;
    background: string;
    bold: boolean;
    font?: "sans" | "serif" | "mono";
    align?: "left" | "center" | "right";
    padding?: number;
  };
};

export const uid = () => Math.random().toString(36).slice(2, 10);
