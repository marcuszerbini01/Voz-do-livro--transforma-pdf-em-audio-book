import {
  List,
  Loader2,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { SPEED_OPTIONS, type Book } from "../types/book";
import { getBookProgress } from "../utils/formatters";
import { BookCover } from "./BookCover";

interface MiniPlayerProps {
  book: Book;
  isPlaying: boolean;
  isBuffering: boolean;
  onExpand: () => void;
  onTogglePlay: () => void;
  onSkipSeconds: (delta: number) => void;
  onCycleSpeed: (nextSpeed: number) => void;
  onOpenChapters: () => void;
}

export function MiniPlayer({
  book,
  isPlaying,
  isBuffering,
  onExpand,
  onTogglePlay,
  onSkipSeconds,
  onCycleSpeed,
  onOpenChapters,
}: MiniPlayerProps) {
  const chapter = book.chapters[book.currentChapterIndex] ?? book.chapters[0];
  const { fraction } = getBookProgress(book);

  const handleNextSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(
      book.playbackSpeed as (typeof SPEED_OPTIONS)[number]
    );
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    onCycleSpeed(next);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-[#FAF9F6]/95 backdrop-blur-md dark:border-neutral-800 dark:bg-[#0D0D10]/95">
      {/* Hairline Progress Bar */}
      <div className="h-0.5 w-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className="h-full bg-neutral-900 transition-all duration-300 dark:bg-white"
          style={{ width: `${Math.max(2, Math.round(fraction * 100))}%` }}
        />
      </div>

      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        {/* Book & Chapter Info (Click to expand to Image 2 view) */}
        <button
          type="button"
          onClick={onExpand}
          className="flex min-w-0 flex-1 items-center gap-3 text-left transition-opacity hover:opacity-85"
        >
          <BookCover
            title={book.title}
            coverUrl={book.coverUrl}
            accentRgb={book.accentRgb}
            size="sm"
            className="h-11 w-8 shrink-0 rounded-md shadow-sm"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {chapter?.title || book.title}
            </p>
            <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
              {book.title}
            </p>
          </div>
        </button>

        {/* Centered Controls */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <button
            type="button"
            onClick={() => onSkipSeconds(-15)}
            aria-label="Voltar 15 segundos"
            className="relative hidden h-10 w-10 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-200/70 sm:flex dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="font-mono-tabular absolute text-[7px] font-bold">
              15
            </span>
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? "Pausar" : "Reproduzir"}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900 text-white transition-transform hover:scale-105 active:scale-95 dark:bg-white dark:text-neutral-950"
          >
            {isBuffering ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onSkipSeconds(15)}
            aria-label="Avançar 15 segundos"
            className="relative hidden h-10 w-10 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-200/70 sm:flex dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <RotateCw className="h-4 w-4" />
            <span className="font-mono-tabular absolute text-[7px] font-bold">
              15
            </span>
          </button>

          <button
            type="button"
            onClick={handleNextSpeed}
            aria-label="Alternar velocidade"
            className="font-mono-tabular min-h-[40px] rounded-lg px-2.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {book.playbackSpeed.toFixed(2).replace(/\.00$/, ".0")}x
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1 sm:flex-1 sm:justify-end">
          <button
            type="button"
            onClick={onOpenChapters}
            aria-label="Capítulos"
            className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-200/70 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onExpand}
            aria-label="Expandir reprodutor"
            className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-200/70 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
