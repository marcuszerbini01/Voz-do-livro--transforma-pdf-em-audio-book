import { Play, X } from "lucide-react";
import type { Book } from "../types/book";
import { formatDurationHuman } from "../utils/formatters";

interface ChaptersDrawerProps {
  book: Book | null;
  isOpen: boolean;
  isPlaying: boolean;
  onClose: () => void;
  onSelectChapter: (chapterIndex: number) => void;
}

export function ChaptersDrawer({
  book,
  isOpen,
  isPlaying,
  onClose,
  onSelectChapter,
}: ChaptersDrawerProps) {
  if (!isOpen || !book) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Capítulos do livro"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-md flex-col border-l border-neutral-200 bg-[#FAF9F6] shadow-2xl dark:border-neutral-800 dark:bg-[#111114]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-6 py-5 dark:border-neutral-800">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Capítulos
            </h2>
            <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
              {book.title} · {book.chapters.length}{" "}
              {book.chapters.length === 1 ? "capítulo" : "capítulos"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar capítulos"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-200/70 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {book.summary && (
          <div className="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
            <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
              {book.summary}
            </p>
          </div>
        )}

        <div className="thin-scrollbar flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-1">
            {book.chapters.map((ch, idx) => {
              const isCurrent = idx === book.currentChapterIndex;
              return (
                <li key={ch.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectChapter(idx);
                      onClose();
                    }}
                    className={`flex w-full items-start gap-3 rounded-xl px-3.5 py-3.5 text-left transition-colors ${
                      isCurrent
                        ? "bg-neutral-900 text-white dark:bg-neutral-800 dark:text-neutral-50"
                        : "text-neutral-800 hover:bg-neutral-200/60 dark:text-neutral-200 dark:hover:bg-neutral-900"
                    }`}
                  >
                    <span
                      className={`font-mono-tabular mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                        isCurrent
                          ? "bg-amber-500 text-neutral-950"
                          : "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                      }`}
                    >
                      {isCurrent && isPlaying ? (
                        <Play className="h-3 w-3 fill-current" />
                      ) : (
                        idx + 1
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium">
                          {ch.title}
                        </p>
                        <span
                          className={`font-mono-tabular shrink-0 text-xs ${
                            isCurrent
                              ? "text-neutral-300 dark:text-neutral-400"
                              : "text-neutral-500 dark:text-neutral-500"
                          }`}
                        >
                          {formatDurationHuman(ch.estimatedSeconds)}
                        </span>
                      </div>

                      {ch.summary && (
                        <p
                          className={`mt-1 line-clamp-2 text-xs leading-relaxed ${
                            isCurrent
                              ? "text-neutral-300 dark:text-neutral-400"
                              : "text-neutral-500 dark:text-neutral-400"
                          }`}
                        >
                          {ch.summary}
                        </p>
                      )}

                      <p
                        className={`mt-1.5 text-[11px] ${
                          isCurrent
                            ? "text-neutral-400"
                            : "text-neutral-400 dark:text-neutral-500"
                        }`}
                      >
                        Pág. {ch.startPage}
                        {ch.endPage > ch.startPage ? `–${ch.endPage}` : ""}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}
