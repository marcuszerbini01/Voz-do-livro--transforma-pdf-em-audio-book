import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  ChevronLeft,
  Gauge,
  List,
  Loader2,
  Moon,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Sun,
  X,
} from "lucide-react";
import {
  SPEED_OPTIONS,
  VOICE_OPTIONS,
  type Book,
  type VoiceName,
} from "../types/book";
import { formatClock } from "../utils/formatters";
import { BookCover } from "./BookCover";

interface NowPlayingViewProps {
  book: Book;
  isPlaying: boolean;
  isBuffering: boolean;
  error: string | null;
  segmentCurrentTime: number;
  segmentDuration: number;
  isDark: boolean;
  onToggleTheme: () => void;
  onMinimize: () => void;
  onTogglePlay: () => void;
  onSkipSeconds: (delta: number) => void;
  onScrubChapter: (ratio: number) => void;
  onJumpToChapter: (chapterIndex: number) => void;
  onJumpToSegment: (segmentIndex: number) => void;
  onSpeedChange: (speed: number) => void;
  onVoiceChange: (voice: VoiceName) => void;
  onOpenChapters: () => void;
  onClearError: () => void;
}

export function NowPlayingView({
  book,
  isPlaying,
  isBuffering,
  error,
  segmentCurrentTime,
  segmentDuration,
  isDark,
  onToggleTheme,
  onMinimize,
  onTogglePlay,
  onSkipSeconds,
  onScrubChapter,
  onJumpToChapter,
  onJumpToSegment,
  onSpeedChange,
  onVoiceChange,
  onOpenChapters,
  onClearError,
}: NowPlayingViewProps) {
  const [viewMode, setViewMode] = useState<"cover" | "text">("cover");
  const [showReaderSidebar, setShowReaderSidebar] = useState(true);
  const [openMenu, setOpenMenu] = useState<"speed" | "voice" | null>(null);
  const activeSegmentRef = useRef<HTMLButtonElement | null>(null);

  const chapter = book.chapters[book.currentChapterIndex] ?? book.chapters[0];
  const segments = chapter?.segments ?? [];
  const totalSegments = Math.max(1, segments.length);

  const intraProgress =
    segmentDuration > 0
      ? Math.min(1, segmentCurrentTime / segmentDuration)
      : 0;
  const chapterProgress = Math.min(
    1,
    (book.currentSegmentIndex + intraProgress) / totalSegments
  );

  const estimatedChapterSeconds = Math.max(10, chapter?.estimatedSeconds ?? 60);
  const elapsedSeconds = chapterProgress * estimatedChapterSeconds;
  const remainingSeconds = Math.max(0, estimatedChapterSeconds - elapsedSeconds);

  const [r, g, b] = book.accentRgb ?? [138, 108, 66];

  useEffect(() => {
    if (viewMode === "text" && activeSegmentRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [viewMode, book.currentSegmentIndex, book.currentChapterIndex]);

  // Opaque base color + ambient cover gradient (prevents library bleed-through)
  const coverBackdropStyle = isDark
    ? {
        backgroundColor: "#0A0A0B",
        backgroundImage: `radial-gradient(circle at 50% 24%, rgba(${r}, ${g}, ${b}, 0.42) 0%, rgba(${Math.round(
          r * 0.35
        )}, ${Math.round(g * 0.35)}, ${Math.round(
          b * 0.35
        )}, 0.55) 45%, #0A0A0B 100%)`,
      }
    : {
        backgroundColor: "#F7F6F2",
        backgroundImage: `radial-gradient(circle at 50% 22%, rgba(${r}, ${g}, ${b}, 0.28) 0%, rgba(${r}, ${g}, ${b}, 0.12) 48%, #F7F6F2 100%)`,
      };

  // Fullscreen Reader View (Image 3 style: left chapter contents + spacious full-page text + bottom player)
  if (viewMode === "text") {
    return (
      <div
        className="fixed inset-0 z-40 flex flex-col bg-[#F7F6F2] text-[#141416] dark:bg-[#050506] dark:text-[#F4F4F5]"
        onClick={() => setOpenMenu(null)}
      >
        {/* Reader Top Bar */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-neutral-200/80 bg-[#F7F6F2] px-4 sm:px-6 dark:border-neutral-800/80 dark:bg-[#050506]">
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onMinimize}
              aria-label="Voltar à biblioteca"
              className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-200/70 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setShowReaderSidebar((s) => !s)}
              className={`inline-flex min-h-[36px] items-center gap-2 rounded-full border px-3.5 text-xs font-medium transition-colors whitespace-nowrap ${
                showReaderSidebar
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  : "border-neutral-300 text-neutral-700 hover:bg-neutral-200/60 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Capítulos</span>
            </button>
          </div>

          <p className="min-w-0 truncate text-center text-sm font-medium text-neutral-800 dark:text-neutral-200">
            {book.title}
          </p>

          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex items-center gap-1 rounded-full bg-neutral-200/80 p-1 dark:bg-neutral-900">
              <button
                type="button"
                onClick={() => setViewMode("cover")}
                className="min-h-[30px] rounded-full px-3 text-xs font-medium text-neutral-600 transition-colors hover:text-neutral-950 whitespace-nowrap dark:text-neutral-400 dark:hover:text-white"
              >
                Capa
              </button>
              <button
                type="button"
                onClick={() => setViewMode("text")}
                className="min-h-[30px] rounded-full bg-white px-3 text-xs font-medium text-neutral-950 shadow-sm whitespace-nowrap dark:bg-neutral-800 dark:text-white"
              >
                Leitura
              </button>
            </div>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
              className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-200/70 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
            >
              {isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
        </header>

        {/* Reader Workspace: Optional Left Chapters Sidebar + Full-Height Reading Canvas */}
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {showReaderSidebar && (
            <aside className="thin-scrollbar absolute inset-y-0 left-0 z-20 flex w-72 flex-col overflow-y-auto border-r border-neutral-200 bg-[#F7F6F2] px-3 py-4 shadow-2xl lg:static lg:shadow-none dark:border-neutral-800/80 dark:bg-[#08080A]">
              <div className="mb-3 flex items-center justify-between px-2">
                <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  Capítulos ({book.chapters.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowReaderSidebar(false)}
                  aria-label="Ocultar capítulos"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-200/70 lg:hidden dark:text-neutral-400 dark:hover:bg-neutral-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ul className="space-y-0.5">
                {book.chapters.map((ch, idx) => {
                  const isCurrent = idx === book.currentChapterIndex;
                  return (
                    <li key={ch.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onJumpToChapter(idx);
                          if (window.innerWidth < 1024) {
                            setShowReaderSidebar(false);
                          }
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                          isCurrent
                            ? "bg-neutral-900 font-semibold text-white dark:bg-neutral-800 dark:text-white"
                            : "text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
                        }`}
                      >
                        <span className="font-mono-tabular w-5 shrink-0 text-[11px] opacity-60">
                          {idx + 1}.
                        </span>
                        <span className="truncate">{ch.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>
          )}

          {/* Main Full-Page Reading Area */}
          <main className="thin-scrollbar flex-1 overflow-y-auto px-6 py-10 sm:px-12 lg:py-14">
            <div className="mx-auto max-w-2xl">
              {error && (
                <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-700 dark:text-red-300">
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={onClearError}
                    className="shrink-0 font-medium underline"
                  >
                    Fechar
                  </button>
                </div>
              )}

              <div className="mb-8">
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Capítulo {book.currentChapterIndex + 1} de{" "}
                  {book.chapters.length} · Pág. {chapter?.startPage ?? 1}
                  {chapter && chapter.endPage > chapter.startPage
                    ? `–${chapter.endPage}`
                    : ""}
                </p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl dark:text-white">
                  {chapter?.title || book.title}
                </h1>
              </div>

              <div className="space-y-4 pb-12">
                {segments.map((seg, idx) => {
                  const isCurrent = idx === book.currentSegmentIndex;
                  return (
                    <button
                      key={idx}
                      ref={isCurrent ? activeSegmentRef : null}
                      type="button"
                      onClick={() => onJumpToSegment(idx)}
                      className={`font-serif-prose block w-full rounded-xl px-4 py-3 text-left text-[17px] leading-[1.8] transition-colors sm:text-[18px] ${
                        isCurrent
                          ? "bg-sky-500/15 text-neutral-950 ring-1 ring-sky-500/30 dark:bg-sky-500/20 dark:text-white dark:ring-sky-400/30"
                          : "text-neutral-800 hover:bg-neutral-200/50 dark:text-neutral-300 dark:hover:bg-neutral-900/70 dark:hover:text-neutral-100"
                      }`}
                    >
                      {seg}
                    </button>
                  );
                })}
              </div>
            </div>
          </main>
        </div>

        {/* Bottom Docked Reader Playback Bar */}
        <footer
          className="relative shrink-0 border-t border-neutral-200 bg-[#F7F6F2] px-4 pt-2 pb-3 sm:px-8 dark:border-neutral-800/80 dark:bg-[#0A0A0C]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center gap-3">
              <span className="font-mono-tabular w-12 text-right text-[11px] text-neutral-500 dark:text-neutral-400">
                {formatClock(elapsedSeconds / book.playbackSpeed)}
              </span>
              <input
                type="range"
                min={0}
                max={1000}
                value={Math.round(chapterProgress * 1000)}
                onChange={(e) => onScrubChapter(Number(e.target.value) / 1000)}
                aria-label="Progresso do capítulo"
                className="scrub-slider h-4 flex-1 text-neutral-900 dark:text-white"
                style={{
                  background: `linear-gradient(to right, ${
                    isDark ? "#ffffff" : "#171717"
                  } ${chapterProgress * 100}%, ${
                    isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.16)"
                  } ${chapterProgress * 100}%)`,
                  backgroundSize: "100% 3px",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                }}
              />
              <span className="font-mono-tabular w-12 text-[11px] text-neutral-500 dark:text-neutral-400">
                -{formatClock(remainingSeconds / book.playbackSpeed)}
              </span>
            </div>

            <div className="mt-1.5 flex items-center justify-between gap-4">
              {/* Left: Voice selector */}
              <div className="relative flex flex-1 items-center">
                {openMenu === "voice" && (
                  <div className="absolute bottom-12 left-0 z-50 w-60 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-2xl dark:border-neutral-800 dark:bg-[#18181C]">
                    {VOICE_OPTIONS.map((voice) => (
                      <button
                        key={voice.id}
                        type="button"
                        onClick={() => {
                          onVoiceChange(voice.id);
                          setOpenMenu(null);
                        }}
                        className={`flex w-full flex-col rounded-xl px-3 py-2 text-left transition-colors ${
                          book.voiceName === voice.id
                            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950"
                            : "text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                        }`}
                      >
                        <span className="text-xs font-semibold">
                          {voice.name}
                        </span>
                        <span
                          className={`text-[11px] ${
                            book.voiceName === voice.id
                              ? "opacity-80"
                              : "text-neutral-500 dark:text-neutral-400"
                          }`}
                        >
                          {voice.description}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setOpenMenu(openMenu === "voice" ? null : "voice")
                  }
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  <AudioLines className="h-4 w-4" />
                  <span>{book.voiceName}</span>
                </button>
              </div>

              {/* Center: Playback cluster */}
              <div className="flex items-center gap-2 sm:gap-4">
                <button
                  type="button"
                  disabled={book.currentChapterIndex <= 0}
                  onClick={() => onJumpToChapter(book.currentChapterIndex - 1)}
                  aria-label="Capítulo anterior"
                  className="hidden h-9 w-9 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-200/70 disabled:opacity-30 sm:flex dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  <SkipBack className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onSkipSeconds(-15)}
                  aria-label="Voltar 15 segundos"
                  className="relative flex h-10 w-10 items-center justify-center rounded-full text-neutral-800 transition-colors hover:bg-neutral-200/70 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  <RotateCcw className="h-5 w-5" />
                  <span className="font-mono-tabular absolute text-[8px] font-bold">
                    15
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onTogglePlay}
                  aria-label={isPlaying ? "Pausar" : "Reproduzir"}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-950 text-white shadow-md transition-transform hover:scale-105 active:scale-95 dark:bg-white dark:text-neutral-950"
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
                  className="relative flex h-10 w-10 items-center justify-center rounded-full text-neutral-800 transition-colors hover:bg-neutral-200/70 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  <RotateCw className="h-5 w-5" />
                  <span className="font-mono-tabular absolute text-[8px] font-bold">
                    15
                  </span>
                </button>

                <button
                  type="button"
                  disabled={book.currentChapterIndex >= book.chapters.length - 1}
                  onClick={() => onJumpToChapter(book.currentChapterIndex + 1)}
                  aria-label="Próximo capítulo"
                  className="hidden h-9 w-9 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-200/70 disabled:opacity-30 sm:flex dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              </div>

              {/* Right: Speed selector */}
              <div className="relative flex flex-1 items-center justify-end">
                {openMenu === "speed" && (
                  <div className="absolute right-0 bottom-12 z-50 w-44 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-2xl dark:border-neutral-800 dark:bg-[#18181C]">
                    {SPEED_OPTIONS.map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => {
                          onSpeedChange(spd);
                          setOpenMenu(null);
                        }}
                        className={`font-mono-tabular flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                          book.playbackSpeed === spd
                            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950"
                            : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        }`}
                      >
                        <span>{spd.toFixed(2).replace(/\.00$/, ".0")}x</span>
                        {spd === 1.0 && (
                          <span className="font-sans text-[11px] opacity-65">
                            Normal
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setOpenMenu(openMenu === "speed" ? null : "speed")
                  }
                  className="font-mono-tabular inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  <Gauge className="h-4 w-4" />
                  <span>
                    {book.playbackSpeed.toFixed(2).replace(/\.00$/, ".0")}x
                  </span>
                </button>
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // Cover Showcase View (Image 2 style: centered cover art + adaptive opaque backdrop + centered controls)
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto transition-colors duration-300"
      style={coverBackdropStyle}
      onClick={() => setOpenMenu(null)}
    >
      {/* Top Bar */}
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 pt-5 pb-2 sm:px-8">
        <button
          type="button"
          onClick={onMinimize}
          aria-label="Voltar à biblioteca"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/10 text-neutral-900 backdrop-blur-md transition-colors hover:bg-black/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <p className="truncate px-4 text-xs font-medium tracking-wide text-neutral-700 dark:text-white/70">
          {book.chapters.length > 1
            ? `Capítulo ${book.currentChapterIndex + 1} de ${book.chapters.length}`
            : book.title}
        </p>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/10 text-neutral-900 backdrop-blur-md transition-colors hover:bg-black/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>

      {/* Main Centered Content */}
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-between px-6 pt-2 pb-8 sm:px-8">
        {/* Center Showcase: Cover */}
        <div className="flex flex-1 flex-col items-center justify-center py-3">
          <div className="w-56 sm:w-64 md:w-72">
            <BookCover
              title={book.title}
              author={book.author}
              coverUrl={book.coverUrl}
              accentRgb={book.accentRgb}
              size="lg"
              className="aspect-[3/4] w-full rounded-xl shadow-[0_24px_60px_rgba(0,0,0,0.42)] ring-1 ring-black/10 dark:ring-white/10"
            />
          </div>

          {/* Mode Toggle right under the cover */}
          <div className="mt-6 inline-flex items-center gap-1 rounded-full bg-black/10 p-1 backdrop-blur-md dark:bg-white/10">
            <button
              type="button"
              onClick={() => setViewMode("cover")}
              className="min-h-[36px] rounded-full bg-white px-4 text-xs font-medium text-neutral-900 shadow-sm transition-colors whitespace-nowrap dark:bg-white/20 dark:text-white"
            >
              Capa
            </button>
            <button
              type="button"
              onClick={() => setViewMode("text")}
              className="min-h-[36px] rounded-full px-4 text-xs font-medium text-neutral-700 transition-colors hover:text-neutral-950 whitespace-nowrap dark:text-white/75 dark:hover:text-white"
            >
              Leitura
            </button>
          </div>
        </div>

        {/* Lower Player Console */}
        <div className="mt-4 w-full">
          {error && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/15 px-3.5 py-2.5 text-xs text-red-900 dark:text-red-200">
              <span>{error}</span>
              <button
                type="button"
                onClick={onClearError}
                className="shrink-0 font-medium underline"
              >
                Fechar
              </button>
            </div>
          )}

          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-neutral-950 sm:text-xl dark:text-white">
              {chapter?.title || book.title}
            </h1>
            <p className="mt-0.5 truncate text-sm text-neutral-700 dark:text-white/65">
              {book.title} · {book.author}
            </p>
          </div>

          {/* Scrub Bar & Timestamps */}
          <div className="mt-5">
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(chapterProgress * 1000)}
              onChange={(e) => onScrubChapter(Number(e.target.value) / 1000)}
              aria-label="Progresso do capítulo"
              className="scrub-slider h-5 w-full text-neutral-900 dark:text-white"
              style={{
                background: `linear-gradient(to right, ${
                  isDark ? "#ffffff" : "#171717"
                } ${chapterProgress * 100}%, ${
                  isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.18)"
                } ${chapterProgress * 100}%)`,
                backgroundSize: "100% 4px",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
              }}
            />
            <div className="font-mono-tabular mt-0.5 flex items-center justify-between text-xs text-neutral-600 dark:text-white/65">
              <span>{formatClock(elapsedSeconds / book.playbackSpeed)}</span>
              <span>-{formatClock(remainingSeconds / book.playbackSpeed)}</span>
            </div>
          </div>

          {/* Centered Main Controls */}
          <div className="mt-5 flex items-center justify-center gap-4 sm:gap-7">
            <button
              type="button"
              disabled={book.currentChapterIndex <= 0}
              onClick={() => onJumpToChapter(book.currentChapterIndex - 1)}
              aria-label="Capítulo anterior"
              className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-black/10 disabled:opacity-30 dark:text-white/80 dark:hover:bg-white/10"
            >
              <SkipBack className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => onSkipSeconds(-15)}
              aria-label="Voltar 15 segundos"
              className="relative flex h-12 w-12 items-center justify-center rounded-full text-neutral-900 transition-colors hover:bg-black/10 dark:text-white dark:hover:bg-white/10"
            >
              <RotateCcw className="h-6 w-6" />
              <span className="font-mono-tabular absolute text-[9px] font-bold">
                15
              </span>
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={isPlaying ? "Pausar" : "Reproduzir"}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-950 text-white shadow-xl transition-transform hover:scale-[1.03] active:scale-[0.97] dark:bg-white/20 dark:text-white dark:backdrop-blur-md dark:ring-1 dark:ring-white/20"
            >
              {isBuffering ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-7 w-7 fill-current" />
              ) : (
                <Play className="ml-0.5 h-7 w-7 fill-current" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onSkipSeconds(15)}
              aria-label="Avançar 15 segundos"
              className="relative flex h-12 w-12 items-center justify-center rounded-full text-neutral-900 transition-colors hover:bg-black/10 dark:text-white dark:hover:bg-white/10"
            >
              <RotateCw className="h-6 w-6" />
              <span className="font-mono-tabular absolute text-[9px] font-bold">
                15
              </span>
            </button>

            <button
              type="button"
              disabled={book.currentChapterIndex >= book.chapters.length - 1}
              onClick={() => onJumpToChapter(book.currentChapterIndex + 1)}
              aria-label="Próximo capítulo"
              className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-black/10 disabled:opacity-30 dark:text-white/80 dark:hover:bg-white/10"
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </div>

          {/* Bottom Centered Utility Row */}
          <div
            className="relative mt-6 flex items-center justify-center gap-8 sm:gap-12"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Speed Control */}
            <div className="relative flex flex-col items-center">
              {openMenu === "speed" && (
                <div className="absolute bottom-14 left-1/2 z-50 w-44 -translate-x-1/2 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-2xl dark:border-neutral-800 dark:bg-[#18181C]">
                  {SPEED_OPTIONS.map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => {
                        onSpeedChange(spd);
                        setOpenMenu(null);
                      }}
                      className={`font-mono-tabular flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                        book.playbackSpeed === spd
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950"
                          : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <span>{spd.toFixed(2).replace(/\.00$/, ".0")}x</span>
                      {spd === 1.0 && (
                        <span className="font-sans text-[11px] opacity-65">
                          Normal
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === "speed" ? null : "speed")
                }
                aria-label="Ajustar velocidade de leitura"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-black/10 text-neutral-900 transition-colors hover:bg-black/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              >
                <Gauge className="h-5 w-5" />
              </button>
              <span className="font-mono-tabular mt-1.5 text-[11px] font-medium text-neutral-700 dark:text-white/70">
                {book.playbackSpeed.toFixed(2).replace(/\.00$/, ".0")}x
              </span>
            </div>

            {/* Chapters Drawer Trigger */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={onOpenChapters}
                aria-label="Abrir lista de capítulos"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-black/10 text-neutral-900 transition-colors hover:bg-black/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              >
                <List className="h-5 w-5" />
              </button>
              <span className="mt-1.5 text-[11px] font-medium text-neutral-700 dark:text-white/70">
                Capítulos
              </span>
            </div>

            {/* Voice Selector */}
            <div className="relative flex flex-col items-center">
              {openMenu === "voice" && (
                <div className="absolute right-0 bottom-14 z-50 w-60 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-2xl sm:left-1/2 sm:right-auto sm:-translate-x-1/2 dark:border-neutral-800 dark:bg-[#18181C]">
                  {VOICE_OPTIONS.map((voice) => (
                    <button
                      key={voice.id}
                      type="button"
                      onClick={() => {
                        onVoiceChange(voice.id);
                        setOpenMenu(null);
                      }}
                      className={`flex w-full flex-col rounded-xl px-3 py-2 text-left transition-colors ${
                        book.voiceName === voice.id
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950"
                          : "text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <span className="text-xs font-semibold">{voice.name}</span>
                      <span
                        className={`text-[11px] ${
                          book.voiceName === voice.id
                            ? "opacity-80"
                            : "text-neutral-500 dark:text-neutral-400"
                        }`}
                      >
                        {voice.description}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() =>
                  setOpenMenu(openMenu === "voice" ? null : "voice")
                }
                aria-label="Escolher voz natural"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-black/10 text-neutral-900 transition-colors hover:bg-black/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              >
                <AudioLines className="h-5 w-5" />
              </button>
              <span className="mt-1.5 text-[11px] font-medium text-neutral-700 dark:text-white/70">
                {book.voiceName}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
