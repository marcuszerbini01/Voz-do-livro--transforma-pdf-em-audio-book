import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  List,
  Moon,
  Pause,
  Play,
  Plus,
  Search,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { BookCover } from "./components/BookCover";
import { ChaptersDrawer } from "./components/ChaptersDrawer";
import { ImportModal } from "./components/ImportModal";
import { MiniPlayer } from "./components/MiniPlayer";
import { NowPlayingView } from "./components/NowPlayingView";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { PWAInstallButton } from "./components/PWAInstallButton";
import { useAudiobookPlayer } from "./hooks/useAudiobookPlayer";
import type { Book, VoiceName } from "./types/book";
import { formatDurationHuman, getBookProgress } from "./utils/formatters";
import { deleteBook, getAllBooks, saveBook } from "./utils/storage";

type LibraryFilter = "all" | "in_progress" | "completed";

export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("vozlivro_theme");
    return saved ? saved === "dark" : true;
  });
  const [defaultVoice, setDefaultVoice] = useState<VoiceName>("Kore");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [chaptersBookId, setChaptersBookId] = useState<string | null>(null);

  // Sync theme class on <html> and PWA status bar theme-color
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("vozlivro_theme", isDark ? "dark" : "light");
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute("content", isDark ? "#0A0A0B" : "#F7F6F2");
    }
  }, [isDark]);

  // Load persisted books from IndexedDB
  useEffect(() => {
    let mounted = true;
    getAllBooks()
      .then((loaded) => {
        if (mounted) {
          setBooks(loaded);
          setIsLoadingLibrary(false);
        }
      })
      .catch(() => {
        if (mounted) setIsLoadingLibrary(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleBookUpdated = useCallback((updated: Book) => {
    setBooks((prev) => {
      const exists = prev.some((b) => b.id === updated.id);
      if (!exists) return [updated, ...prev];
      return prev.map((b) => (b.id === updated.id ? updated : b));
    });
  }, []);

  const player = useAudiobookPlayer({ onBookUpdated: handleBookUpdated });

  const handleImported = async (newBook: Book) => {
    await saveBook(newBook);
    setBooks((prev) => [newBook, ...prev]);
    setDefaultVoice(newBook.voiceName);
    player.openBook(newBook, true);
    setIsPlayerExpanded(true);
  };

  const handlePlayBook = (book: Book) => {
    if (player.activeBook?.id === book.id) {
      if (!player.isPlaying) {
        void player.togglePlayPause();
      }
      setIsPlayerExpanded(true);
      return;
    }
    player.openBook(book, true);
    setIsPlayerExpanded(true);
  };

  const handleDeleteBook = async (bookId: string) => {
    player.clearActiveBookIfDeleted(bookId);
    if (chaptersBookId === bookId) {
      setChaptersBookId(null);
    }
    await deleteBook(bookId);
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
  };

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return books.filter((book) => {
      const matchesQuery =
        !q ||
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        book.summary.toLowerCase().includes(q);
      if (!matchesQuery) return false;

      if (filter === "completed") return Boolean(book.completed);
      if (filter === "in_progress") {
        return !book.completed && (book.currentChapterIndex > 0 || book.currentSegmentIndex > 0);
      }
      return true;
    });
  }, [books, searchQuery, filter]);

  const drawerBook = useMemo(() => {
    if (!chaptersBookId) return null;
    if (player.activeBook?.id === chaptersBookId) return player.activeBook;
    return books.find((b) => b.id === chaptersBookId) ?? null;
  }, [chaptersBookId, books, player.activeBook]);

  const handleSelectChapterFromDrawer = (chapterIdx: number) => {
    if (!drawerBook) return;
    if (player.activeBook?.id === drawerBook.id) {
      player.jumpToChapter(chapterIdx, true);
    } else {
      const updated = {
        ...drawerBook,
        currentChapterIndex: chapterIdx,
        currentSegmentIndex: 0,
      };
      player.openBook(updated, true);
    }
    setIsPlayerExpanded(true);
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#141416] transition-colors duration-200 dark:bg-[#0A0A0B] dark:text-[#F4F4F5]">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-20 border-b border-neutral-200/80 bg-[#F7F6F2]/90 backdrop-blur-md dark:border-neutral-800/80 dark:bg-[#0A0A0B]/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setIsPlayerExpanded(false)}
            className="text-lg font-bold tracking-tight text-neutral-950 whitespace-nowrap shrink-0 dark:text-white"
          >
            VozLivro
          </button>

          {/* Zone 2: Concise single-line nav links */}
          <nav className="hidden items-center gap-6 text-sm font-medium text-neutral-600 md:flex dark:text-neutral-400">
            <button
              type="button"
              onClick={() => setIsPlayerExpanded(false)}
              className={`transition-colors whitespace-nowrap shrink-0 hover:text-neutral-950 dark:hover:text-white ${
                !isPlayerExpanded
                  ? "text-neutral-950 underline underline-offset-8 dark:text-white"
                  : ""
              }`}
            >
              Biblioteca
            </button>
            <button
              type="button"
              disabled={!player.activeBook}
              onClick={() => {
                if (player.activeBook) setIsPlayerExpanded(true);
              }}
              className="transition-colors whitespace-nowrap shrink-0 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-white"
            >
              Reprodutor
            </button>
            <button
              type="button"
              disabled={!player.activeBook && books.length === 0}
              onClick={() => {
                const target = player.activeBook ?? books[0];
                if (target) setChaptersBookId(target.id);
              }}
              className="transition-colors whitespace-nowrap shrink-0 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-white"
            >
              Capítulos
            </button>
          </nav>

          {/* Zone 3: 1 primary CTA */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-neutral-950 px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
            >
              <Plus className="h-4 w-4" />
              <span>Importar livro</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Library Canvas */}
      <main
        className={`mx-auto max-w-5xl px-6 pt-10 ${
          player.activeBook ? "pb-32" : "pb-16"
        }`}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              Biblioteca
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <PWAInstallButton />

            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              aria-label={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-medium text-neutral-800 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              {isDark ? (
                <>
                  <Sun className="h-3.5 w-3.5" />
                  <span>Modo claro</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5" />
                  <span>Modo noturno</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Library Toolbar (Filter tabs + Search) */}
        <div className="mt-6 flex flex-col justify-between gap-4 border-b border-neutral-200 pb-5 sm:flex-row sm:items-center dark:border-neutral-800">
          <div className="inline-flex items-center gap-1 self-start rounded-full bg-neutral-200/70 p-1 dark:bg-neutral-900">
            {(
              [
                { id: "all", label: "Todos" },
                { id: "in_progress", label: "Em andamento" },
                { id: "completed", label: "Concluídos" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`min-h-[36px] rounded-full px-4 text-xs font-medium transition-colors whitespace-nowrap ${
                  filter === tab.id
                    ? "bg-white text-neutral-950 shadow-sm dark:bg-neutral-800 dark:text-white"
                    : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar título ou autor..."
              className="h-10 w-full rounded-full border border-neutral-300 bg-white pr-4 pl-10 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-600"
            />
          </div>
        </div>

        {/* Library Content */}
        {isLoadingLibrary ? (
          <div className="py-20 text-center text-sm text-neutral-500 dark:text-neutral-400">
            Carregando biblioteca...
          </div>
        ) : books.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-neutral-300 bg-white/60 px-6 py-16 text-center dark:border-neutral-800 dark:bg-neutral-900/30">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-200/80 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
              <BookOpen className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-neutral-950 dark:text-white">
              Sua estante de áudio está vazia
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              Envie um arquivo PDF, EPUB ou TXT. A inteligência artificial extrai a
              capa, divide automaticamente em capítulos e lê com voz natural.
            </p>
            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-neutral-950 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
            >
              <Upload className="h-4 w-4" />
              <span>Importar primeiro arquivo</span>
            </button>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="py-16 text-center text-sm text-neutral-500 dark:text-neutral-400">
            Nenhum livro encontrado para este filtro.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-200/80 dark:divide-neutral-800/80">
            {filteredBooks.map((book) => {
              const isCurrent = player.activeBook?.id === book.id;
              const isThisPlaying = isCurrent && player.isPlaying;
              const { remainingSeconds } = getBookProgress(book);
              const currentChapter =
                book.chapters[book.currentChapterIndex] ?? book.chapters[0];

              return (
                <li
                  key={book.id}
                  className="flex flex-col-reverse justify-between gap-6 py-8 sm:flex-row sm:items-center"
                >
                  {/* Left: Info & Controls (Image 1 inspired) */}
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => handlePlayBook(book)}
                      className="text-left transition-opacity hover:opacity-80"
                    >
                      <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
                        {book.title}
                      </h2>
                    </button>

                    <p className="mt-1.5 line-clamp-2 max-w-xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                      {book.summary ||
                        currentChapter?.summary ||
                        book.author}
                    </p>

                    {/* Clean unboxed metadata with typographic separators */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                      <span>{book.author}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {book.chapters.length}{" "}
                        {book.chapters.length === 1 ? "capítulo" : "capítulos"}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular">
                        {book.completed
                          ? "Concluído"
                          : `Faltam ${formatDurationHuman(remainingSeconds)}`}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="uppercase">{book.fileType}</span>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handlePlayBook(book)}
                        className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-neutral-950 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                      >
                        {isThisPlaying ? (
                          <>
                            <Pause className="h-3.5 w-3.5 fill-current" />
                            <span>Ouvindo</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5 fill-current" />
                            <span>
                              {book.currentChapterIndex > 0 ||
                              book.currentSegmentIndex > 0
                                ? "Continuar"
                                : "Ouvir"}
                            </span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setChaptersBookId(book.id)}
                        className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-neutral-300 bg-transparent px-4 py-2 text-xs font-medium text-neutral-800 transition-colors hover:bg-neutral-200/60 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
                      >
                        <List className="h-3.5 w-3.5" />
                        <span>Capítulos</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDeleteBook(book.id)}
                        aria-label={`Remover ${book.title}`}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 text-neutral-500 transition-colors hover:border-red-500/40 hover:text-red-500 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-red-500/40 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Right: Book Cover Thumbnail */}
                  <button
                    type="button"
                    onClick={() => handlePlayBook(book)}
                    className="shrink-0 self-start transition-transform hover:scale-[1.02] sm:self-center"
                    aria-label={`Abrir ${book.title}`}
                  >
                    <BookCover
                      title={book.title}
                      author={book.author}
                      coverUrl={book.coverUrl}
                      accentRgb={book.accentRgb}
                      size="md"
                      className="aspect-[3/4] w-24 rounded-lg shadow-lg ring-1 ring-black/10 sm:w-28 dark:ring-white/10"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* Persistent Bottom Mini-Player (when minimized & audio loaded) */}
      {player.activeBook && !isPlayerExpanded && (
        <MiniPlayer
          book={player.activeBook}
          isPlaying={player.isPlaying}
          isBuffering={player.isBuffering}
          onExpand={() => setIsPlayerExpanded(true)}
          onTogglePlay={() => void player.togglePlayPause()}
          onSkipSeconds={player.skipSeconds}
          onCycleSpeed={player.setPlaybackSpeed}
          onOpenChapters={() => setChaptersBookId(player.activeBook!.id)}
        />
      )}

      {/* Fullscreen Now Playing View (Image 2 inspired) */}
      {player.activeBook && isPlayerExpanded && (
        <NowPlayingView
          book={player.activeBook}
          isPlaying={player.isPlaying}
          isBuffering={player.isBuffering}
          error={player.error}
          isQuotaError={player.isQuotaError}
          useDeviceVoice={player.useDeviceVoice}
          segmentCurrentTime={player.segmentCurrentTime}
          segmentDuration={player.segmentDuration}
          isDark={isDark}
          onToggleTheme={() => setIsDark((d) => !d)}
          onMinimize={() => setIsPlayerExpanded(false)}
          onTogglePlay={() => void player.togglePlayPause()}
          onSkipSeconds={player.skipSeconds}
          onScrubChapter={player.scrubChapterRatio}
          onJumpToChapter={(idx) => player.jumpToChapter(idx, true)}
          onJumpToSegment={(idx) => player.jumpToSegment(idx, true)}
          onSpeedChange={player.setPlaybackSpeed}
          onVoiceChange={player.setVoiceName}
          onEnableDeviceVoice={player.enableDeviceVoiceFallback}
          onDisableDeviceVoice={player.disableDeviceVoiceFallback}
          onOpenChapters={() => setChaptersBookId(player.activeBook!.id)}
          onClearError={player.clearError}
        />
      )}

      {/* Chapters Slide-Over Drawer */}
      <ChaptersDrawer
        book={drawerBook}
        isOpen={chaptersBookId !== null}
        isPlaying={player.isPlaying && player.activeBook?.id === drawerBook?.id}
        onClose={() => setChaptersBookId(null)}
        onSelectChapter={handleSelectChapterFromDrawer}
      />

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportOpen}
        defaultVoice={defaultVoice}
        onClose={() => setIsImportOpen(false)}
        onImported={(b) => void handleImported(b)}
      />

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />
    </div>
  );
}
