import type { Chapter, ExtractedPage } from "../types/book";
import {
  estimateReadingSeconds,
  splitChapterIntoSegments,
} from "./documentParser";

export interface AiChapterResponse {
  title: string;
  author: string;
  summary: string;
  chapters: Array<{
    title: string;
    startPage: number;
    startSnippet: string;
    summary: string;
  }>;
}

export function buildChaptersFromAiScan(
  pages: ExtractedPage[],
  aiResult: AiChapterResponse
): Chapter[] {
  const pageCount = pages.length;

  // Build cumulative character offsets per page across full combined text
  const pageOffsets: Array<{ start: number; end: number; pageIndex: number }> = [];
  let cursor = 0;
  const fullTextParts: string[] = [];

  for (const p of pages) {
    const chunk = p.text.trim();
    const start = cursor;
    fullTextParts.push(chunk);
    cursor += chunk.length;
    pageOffsets.push({ start, end: cursor, pageIndex: p.index });
    cursor += 2; // "\n\n" separator
  }

  const fullText = fullTextParts.join("\n\n");
  const rawChapters = Array.isArray(aiResult.chapters) ? aiResult.chapters : [];

  if (rawChapters.length === 0) {
    const segments = splitChapterIntoSegments(fullText);
    return [
      {
        id: "ch-1",
        index: 0,
        title: "Capítulo 1 — Texto completo",
        summary: aiResult.summary || "Leitura integral do documento.",
        startPage: 1,
        endPage: pageCount,
        text: fullText,
        segments,
        estimatedSeconds: estimateReadingSeconds(fullText),
      },
    ];
  }

  // Locate exact character start index for each AI-detected chapter
  const located = rawChapters
    .map((ch, idx) => {
      const clampedPage = Math.max(1, Math.min(pageCount, ch.startPage || 1));
      const pageMeta = pageOffsets[clampedPage - 1];
      let startChar = pageMeta ? pageMeta.start : 0;

      // Try locating the snippet within that page (or neighboring page) for mid-page splits
      if (idx > 0 && ch.startSnippet && ch.startSnippet.trim().length >= 5) {
        const snippetWords = ch.startSnippet
          .trim()
          .split(/\s+/)
          .slice(0, 5)
          .join(" ")
          .toLowerCase();

        const searchWindowStart = Math.max(0, startChar - 400);
        const searchWindowEnd = Math.min(
          fullText.length,
          (pageMeta?.end ?? startChar) + 400
        );
        const windowSlice = fullText
          .slice(searchWindowStart, searchWindowEnd)
          .toLowerCase();
        const foundIdx = windowSlice.indexOf(snippetWords);
        if (foundIdx !== -1) {
          startChar = searchWindowStart + foundIdx;
        }
      }

      if (idx === 0) {
        startChar = 0;
      }

      return {
        title: ch.title?.trim() || `Capítulo ${idx + 1}`,
        summary: ch.summary?.trim() || "",
        startPage: clampedPage,
        startChar,
      };
    })
    .sort((a, b) => a.startChar - b.startChar);

  // Deduplicate overlapping start positions
  const normalized: typeof located = [];
  for (const item of located) {
    const prev = normalized[normalized.length - 1];
    if (!prev || item.startChar - prev.startChar > 80) {
      normalized.push(item);
    }
  }

  const chapters: Chapter[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const curr = normalized[i];
    const next = normalized[i + 1];
    const sliceStart = i === 0 ? 0 : curr.startChar;
    const sliceEnd = next ? next.startChar : fullText.length;
    const text = fullText.slice(sliceStart, sliceEnd).trim();

    if (!text) continue;

    const endPage = next
      ? Math.max(curr.startPage, next.startPage)
      : pageCount;

    chapters.push({
      id: `ch-${chapters.length + 1}`,
      index: chapters.length,
      title: curr.title,
      summary: curr.summary,
      startPage: curr.startPage,
      endPage,
      text,
      segments: splitChapterIntoSegments(text),
      estimatedSeconds: estimateReadingSeconds(text),
    });
  }

  return chapters;
}
