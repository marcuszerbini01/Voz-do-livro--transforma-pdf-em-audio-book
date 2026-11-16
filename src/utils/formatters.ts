import type { Book } from "../types/book";

export function formatDurationHuman(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }
  if (minutes > 0) {
    return `${minutes} min`;
  }
  return "< 1 min";
}

export function formatClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "00:00";
  const rounded = Math.floor(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const mins = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;

  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function getBookProgress(book: Book): {
  fraction: number;
  remainingSeconds: number;
} {
  let totalSegments = 0;
  let completedSegments = 0;

  book.chapters.forEach((ch, chIdx) => {
    const segCount = Math.max(1, ch.segments.length);
    totalSegments += segCount;
    if (chIdx < book.currentChapterIndex) {
      completedSegments += segCount;
    } else if (chIdx === book.currentChapterIndex) {
      completedSegments += Math.min(segCount, book.currentSegmentIndex);
    }
  });

  const fraction = totalSegments > 0 ? completedSegments / totalSegments : 0;
  const remainingSeconds = Math.max(
    0,
    Math.round(book.totalEstimatedSeconds * (1 - fraction))
  );
  return { fraction, remainingSeconds };
}
