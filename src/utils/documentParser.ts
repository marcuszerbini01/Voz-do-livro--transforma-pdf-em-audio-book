import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import JSZip from "jszip";
import type { ExtractedPage } from "../types/book";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ParsedDocument {
  titleHint: string;
  authorHint: string;
  fileType: "pdf" | "epub" | "txt";
  coverUrl?: string;
  accentRgb?: [number, number, number];
  pages: ExtractedPage[];
}

export async function extractDominantColor(
  imageDataUrl: string
): Promise<[number, number, number]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 24;
        canvas.height = 24;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve([120, 92, 56]);
          return;
        }
        ctx.drawImage(img, 0, 0, 24, 24);
        const { data } = ctx.getImageData(0, 0, 24, 24);
        let rTotal = 0;
        let gTotal = 0;
        let bTotal = 0;
        let count = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const brightness = (r + g + b) / 3;
          // Skip pure black and pure white extremes for richer ambient color
          if (brightness > 22 && brightness < 235) {
            rTotal += r;
            gTotal += g;
            bTotal += b;
            count++;
          }
        }

        if (count === 0) {
          resolve([120, 92, 56]);
          return;
        }

        resolve([
          Math.round(rTotal / count),
          Math.round(gTotal / count),
          Math.round(bTotal / count),
        ]);
      } catch {
        resolve([120, 92, 56]);
      }
    };
    img.onerror = () => resolve([120, 92, 56]);
    img.src = imageDataUrl;
  });
}

function cleanTextBlock(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function parsePdfFile(file: File): Promise<ParsedDocument> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  let titleHint = file.name.replace(/\.pdf$/i, "");
  let authorHint = "";

  try {
    const meta = await pdf.getMetadata();
    const info = meta.info as Record<string, unknown> | undefined;
    if (info?.Title && typeof info.Title === "string" && info.Title.trim()) {
      titleHint = info.Title.trim();
    }
    if (info?.Author && typeof info.Author === "string" && info.Author.trim()) {
      authorHint = info.Author.trim();
    }
  } catch {
    // Ignore metadata read errors
  }

  let coverUrl: string | undefined;
  let accentRgb: [number, number, number] | undefined;

  try {
    const firstPage = await pdf.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1 });
    const targetWidth = 540;
    const scale = targetWidth / viewport.width;
    const scaledViewport = firstPage.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(scaledViewport.width);
    canvas.height = Math.round(scaledViewport.height);
    const ctx = canvas.getContext("2d");

    if (ctx) {
      await firstPage.render({
        canvasContext: ctx,
        viewport: scaledViewport,
        canvas,
      }).promise;
      coverUrl = canvas.toDataURL("image/jpeg", 0.85);
      accentRgb = await extractDominantColor(coverUrl);
    }
  } catch (err) {
    console.warn("Could not render PDF cover page:", err);
  }

  const pages: ExtractedPage[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as Array<{
      str?: string;
      transform?: number[];
      hasEOL?: boolean;
    }>;

    let pageLines: string[] = [];
    let currentLine = "";
    let lastY: number | null = null;

    for (const item of items) {
      const str = item.str ?? "";
      const y = item.transform ? item.transform[5] : null;

      if (lastY !== null && y !== null && Math.abs(y - lastY) > 6) {
        if (currentLine.trim()) {
          pageLines.push(currentLine.trim());
        }
        // Large vertical gap signals a paragraph break
        if (Math.abs(y - lastY) > 18) {
          pageLines.push("");
        }
        currentLine = str;
      } else {
        currentLine += (currentLine && str && !currentLine.endsWith(" ") && !str.startsWith(" ") ? " " : "") + str;
      }

      if (item.hasEOL) {
        if (currentLine.trim()) {
          pageLines.push(currentLine.trim());
        }
        currentLine = "";
      }

      if (y !== null) {
        lastY = y;
      }
    }

    if (currentLine.trim()) {
      pageLines.push(currentLine.trim());
    }

    const pageText = cleanTextBlock(pageLines.join("\n"));
    if (pageText.length > 0) {
      pages.push({
        index: pages.length + 1,
        label: `Página ${i}`,
        text: pageText,
      });
    }
  }

  if (pages.length === 0) {
    throw new Error(
      "Não foi possível extrair texto deste PDF. Verifique se ele não é apenas uma imagem digitalizada."
    );
  }

  return {
    titleHint,
    authorHint,
    fileType: "pdf",
    coverUrl,
    accentRgb,
    pages,
  };
}

function htmlToPlainText(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, svg, head").forEach((el) => el.remove());

  const blocks: string[] = [];
  const blockTags = new Set([
    "P",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "LI",
    "BLOCKQUOTE",
    "DIV",
  ]);

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const hasChildBlocks = Array.from(el.children).some((c) =>
        blockTags.has(c.tagName)
      );
      if (blockTags.has(el.tagName) && !hasChildBlocks) {
        const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
        if (text) blocks.push(text);
        return;
      }
      el.childNodes.forEach(walk);
    }
  }

  if (doc.body) {
    walk(doc.body);
  }

  if (blocks.length === 0 && doc.body?.textContent) {
    return cleanTextBlock(doc.body.textContent);
  }

  return cleanTextBlock(blocks.join("\n\n"));
}

function resolveZipPath(baseDir: string, relativePath: string): string {
  const cleanRel = decodeURIComponent(relativePath.split("#")[0]);
  if (!baseDir) return cleanRel.replace(/^\/+/, "");
  const parts = [...baseDir.split("/").filter(Boolean), ...cleanRel.split("/")];
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") resolved.pop();
    else resolved.push(part);
  }
  return resolved.join("/");
}

export async function parseEpubFile(file: File): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  let titleHint = file.name.replace(/\.epub$/i, "");
  let authorHint = "";
  let coverUrl: string | undefined;
  let accentRgb: [number, number, number] | undefined;

  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) {
    throw new Error("Arquivo EPUB inválido (META-INF/container.xml ausente).");
  }

  const containerXml = await containerFile.async("text");
  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, "application/xml");
  const rootfilePath =
    containerDoc.querySelector("rootfile")?.getAttribute("full-path") || "";

  if (!rootfilePath || !zip.file(rootfilePath)) {
    throw new Error("Não foi possível localizar o manifesto OPF do EPUB.");
  }

  const opfDir = rootfilePath.includes("/")
    ? rootfilePath.slice(0, rootfilePath.lastIndexOf("/"))
    : "";
  const opfXml = await zip.file(rootfilePath)!.async("text");
  const opfDoc = parser.parseFromString(opfXml, "application/xml");

  const titleEl = opfDoc.querySelector("metadata title, dc\\:title, title");
  if (titleEl?.textContent?.trim()) {
    titleHint = titleEl.textContent.trim();
  }
  const creatorEl = opfDoc.querySelector("metadata creator, dc\\:creator, creator");
  if (creatorEl?.textContent?.trim()) {
    authorHint = creatorEl.textContent.trim();
  }

  const manifestMap = new Map<string, { href: string; mediaType: string; properties: string }>();
  opfDoc.querySelectorAll("manifest > item").forEach((item) => {
    const id = item.getAttribute("id") || "";
    const href = item.getAttribute("href") || "";
    const mediaType = item.getAttribute("media-type") || "";
    const properties = item.getAttribute("properties") || "";
    if (id && href) {
      manifestMap.set(id, { href, mediaType, properties });
    }
  });

  // Attempt to locate cover image
  let coverHref: string | undefined;
  let coverMime = "image/jpeg";

  const coverMeta = opfDoc.querySelector('metadata meta[name="cover"]');
  const coverId = coverMeta?.getAttribute("content");
  if (coverId && manifestMap.has(coverId)) {
    const item = manifestMap.get(coverId)!;
    coverHref = item.href;
    coverMime = item.mediaType || coverMime;
  }

  if (!coverHref) {
    for (const [, item] of manifestMap) {
      if (
        item.properties.includes("cover-image") ||
        (/cover/i.test(item.href) && item.mediaType.startsWith("image/"))
      ) {
        coverHref = item.href;
        coverMime = item.mediaType;
        break;
      }
    }
  }

  if (coverHref) {
    const resolvedCoverPath = resolveZipPath(opfDir, coverHref);
    const coverEntry = zip.file(resolvedCoverPath);
    if (coverEntry) {
      const base64 = await coverEntry.async("base64");
      coverUrl = `data:${coverMime};base64,${base64}`;
      accentRgb = await extractDominantColor(coverUrl);
    }
  }

  const spineIds: string[] = [];
  opfDoc.querySelectorAll("spine > itemref").forEach((ref) => {
    const idref = ref.getAttribute("idref");
    if (idref) spineIds.push(idref);
  });

  const pages: ExtractedPage[] = [];
  for (const idref of spineIds) {
    const item = manifestMap.get(idref);
    if (!item) continue;
    const itemPath = resolveZipPath(opfDir, item.href);
    const zipEntry = zip.file(itemPath);
    if (!zipEntry) continue;

    const html = await zipEntry.async("text");
    const plain = htmlToPlainText(html);
    if (plain.length < 25) continue;

    // Split long spine sections into ~2500-char pages so AI indexing stays crisp
    const chunks = splitIntoPageChunks(plain, 2600);
    for (const chunk of chunks) {
      pages.push({
        index: pages.length + 1,
        label: `Seção ${pages.length + 1}`,
        text: chunk,
      });
    }
  }

  if (pages.length === 0) {
    throw new Error("Nenhum texto legível encontrado dentro deste EPUB.");
  }

  return {
    titleHint,
    authorHint,
    fileType: "epub",
    coverUrl,
    accentRgb,
    pages,
  };
}

export function splitIntoPageChunks(text: string, maxChars = 2600): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    if (current.length + trimmed.length + 2 > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = trimmed;
    } else {
      current += (current ? "\n\n" : "") + trimmed;
    }
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }
  return chunks;
}

export async function parseTextInput(
  text: string,
  titleHint = "Texto importado",
  authorHint = ""
): Promise<ParsedDocument> {
  const cleaned = cleanTextBlock(text);
  if (!cleaned) {
    throw new Error("O arquivo ou texto está vazio.");
  }
  const chunks = splitIntoPageChunks(cleaned, 2400);
  return {
    titleHint,
    authorHint,
    fileType: "txt",
    pages: chunks.map((chunk, idx) => ({
      index: idx + 1,
      label: `Parte ${idx + 1}`,
      text: chunk,
    })),
  };
}

export async function parseDocumentFile(file: File): Promise<ParsedDocument> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf") || file.type === "application/pdf") {
    return parsePdfFile(file);
  }
  if (lower.endsWith(".epub") || file.type === "application/epub+zip") {
    return parseEpubFile(file);
  }
  if (
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    file.type.startsWith("text/")
  ) {
    const content = await file.text();
    return parseTextInput(content, file.name.replace(/\.(txt|md)$/i, ""));
  }
  throw new Error(
    "Formato não suportado. Envie arquivos PDF, EPUB ou TXT."
  );
}

export function splitChapterIntoSegments(chapterText: string): string[] {
  const paragraphs = chapterText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const segments: string[] = [];
  const TARGET_MAX = 1500;

  for (const para of paragraphs) {
    if (para.length <= TARGET_MAX) {
      segments.push(para);
      continue;
    }

    // Split long paragraphs on sentence boundaries
    const sentences = para.match(/[^.!?…]+[.!?…]+(\s|$)|[^.!?…]+$/g) || [para];
    let buffer = "";

    for (const sentence of sentences) {
      const s = sentence.trim();
      if (!s) continue;
      if (buffer.length + s.length + 1 > TARGET_MAX && buffer.length > 0) {
        segments.push(buffer.trim());
        buffer = s;
      } else {
        buffer += (buffer ? " " : "") + s;
      }
    }

    if (buffer.trim()) {
      segments.push(buffer.trim());
    }
  }

  return segments.length > 0 ? segments : [chapterText.trim()];
}

export function estimateReadingSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  // Average natural audiobook pace: ~150 words per minute (2.5 words/sec)
  return Math.max(5, Math.round(words / 2.5));
}
