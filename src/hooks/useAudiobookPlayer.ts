import { useCallback, useEffect, useRef, useState } from "react";
import type { Book, VoiceName } from "../types/book";
import {
  getCachedAudioBlob,
  makeAudioCacheKey,
  saveBook,
  setCachedAudioBlob,
} from "../utils/storage";

interface UseAudiobookPlayerOptions {
  onBookUpdated: (book: Book) => void;
}

class TtsQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TtsQuotaError";
  }
}

export function useAudiobookPlayer({ onBookUpdated }: UseAudiobookPlayerOptions) {
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [useDeviceVoice, setUseDeviceVoice] = useState(false);
  const [segmentCurrentTime, setSegmentCurrentTime] = useState(0);
  const [segmentDuration, setSegmentDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlCacheRef = useRef<Map<string, string>>(new Map());
  const inFlightRef = useRef<Map<string, Promise<string>>>(new Map());
  const playbackTokenRef = useRef(0);
  const prefetchTimerRef = useRef<number | null>(null);
  const quotaExhaustedRef = useRef(false);
  const useDeviceVoiceRef = useRef(false);
  const activeBookRef = useRef<Book | null>(null);
  const isPlayingRef = useRef(false);

  activeBookRef.current = activeBook;
  isPlayingRef.current = isPlaying;
  useDeviceVoiceRef.current = useDeviceVoice;

  const stopDeviceSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    return () => {
      if (prefetchTimerRef.current !== null) {
        window.clearTimeout(prefetchTimerRef.current);
      }
      stopDeviceSpeech();
      audio.pause();
      audio.src = "";
      for (const url of blobUrlCacheRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      blobUrlCacheRef.current.clear();
    };
  }, [stopDeviceSpeech]);

  const persistProgress = useCallback(
    (updated: Book) => {
      setActiveBook(updated);
      activeBookRef.current = updated;
      onBookUpdated(updated);
      void saveBook(updated);
    },
    [onBookUpdated]
  );

  const fetchSegmentUrl = useCallback(
    async (
      book: Book,
      chapterIdx: number,
      segmentIdx: number,
      voice: VoiceName
    ): Promise<string> => {
      const chapter = book.chapters[chapterIdx];
      if (!chapter) throw new Error("Capítulo não encontrado.");
      const text = chapter.segments[segmentIdx];
      if (!text) throw new Error("Trecho não encontrado.");

      const key = makeAudioCacheKey(book.id, chapter.id, segmentIdx, voice);

      const memCached = blobUrlCacheRef.current.get(key);
      if (memCached) return memCached;

      const existingFlight = inFlightRef.current.get(key);
      if (existingFlight) return existingFlight;

      const promise = (async () => {
        const dbBlob = await getCachedAudioBlob(key);
        if (dbBlob) {
          const url = URL.createObjectURL(dbBlob);
          blobUrlCacheRef.current.set(key, url);
          return url;
        }

        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            voiceName: voice,
          }),
        });

        if (!res.ok) {
          let errMsg = "Erro ao sintetizar voz natural.";
          try {
            const payload = (await res.json()) as { error?: string };
            if (payload.error) errMsg = payload.error;
          } catch {
            // Keep default message
          }
          if (res.status === 429) {
            quotaExhaustedRef.current = true;
            throw new TtsQuotaError(errMsg);
          }
          throw new Error(errMsg);
        }

        quotaExhaustedRef.current = false;
        const wavBlob = await res.blob();
        await setCachedAudioBlob(key, wavBlob);
        const url = URL.createObjectURL(wavBlob);
        blobUrlCacheRef.current.set(key, url);
        return url;
      })();

      inFlightRef.current.set(key, promise);
      try {
        return await promise;
      } finally {
        inFlightRef.current.delete(key);
      }
    },
    []
  );

  const prefetchNext = useCallback(
    (book: Book, chapterIdx: number, segmentIdx: number, token: number) => {
      if (prefetchTimerRef.current !== null) {
        window.clearTimeout(prefetchTimerRef.current);
      }

      if (quotaExhaustedRef.current || useDeviceVoiceRef.current) return;

      const chapter = book.chapters[chapterIdx];
      if (!chapter) return;

      let nextCh = chapterIdx;
      let nextSeg = segmentIdx + 1;

      if (nextSeg >= chapter.segments.length) {
        nextCh = chapterIdx + 1;
        nextSeg = 0;
      }

      if (nextCh < book.chapters.length) {
        prefetchTimerRef.current = window.setTimeout(() => {
          if (
            playbackTokenRef.current !== token ||
            !isPlayingRef.current ||
            quotaExhaustedRef.current ||
            useDeviceVoiceRef.current
          ) {
            return;
          }
          void fetchSegmentUrl(book, nextCh, nextSeg, book.voiceName).catch(
            () => {
              // Prefetch failure is non-blocking; foreground play handles errors
            }
          );
        }, 10000);
      }
    },
    [fetchSegmentUrl]
  );

  const speakWithDeviceVoice = useCallback(
    (
      book: Book,
      chapterIdx: number,
      segmentIdx: number,
      shouldAutoPlay: boolean,
      token: number,
      onAdvance: (nextBook: Book, nextCh: number, nextSeg: number) => void
    ) => {
      stopDeviceSpeech();
      setIsBuffering(false);

      if (!shouldAutoPlay) {
        setIsPlaying(false);
        return;
      }

      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setError("Síntese de voz do navegador não suportada neste dispositivo.");
        setIsPlaying(false);
        return;
      }

      const chapter = book.chapters[chapterIdx];
      const text = chapter?.segments[segmentIdx];
      if (!chapter || !text) {
        setIsPlaying(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "pt-BR";
      utterance.rate = book.playbackSpeed;

      const voices = window.speechSynthesis.getVoices();
      const ptVoice = voices.find((v) =>
        v.lang.toLowerCase().startsWith("pt")
      );
      if (ptVoice) utterance.voice = ptVoice;

      const estSec = Math.max(4, Math.round(text.split(/\s+/).length / 2.5));
      setSegmentDuration(estSec);
      setSegmentCurrentTime(0);

      utterance.onend = () => {
        if (playbackTokenRef.current !== token) return;
        if (segmentIdx + 1 < chapter.segments.length) {
          onAdvance(book, chapterIdx, segmentIdx + 1);
        } else if (chapterIdx + 1 < book.chapters.length) {
          onAdvance(book, chapterIdx + 1, 0);
        } else {
          setIsPlaying(false);
          persistProgress({
            ...book,
            completed: true,
            lastPlayedAt: Date.now(),
          });
        }
      };

      utterance.onerror = (ev) => {
        if (ev.error === "interrupted" || ev.error === "canceled") return;
        if (playbackTokenRef.current !== token) return;
        setIsPlaying(false);
      };

      setIsPlaying(true);
      window.speechSynthesis.speak(utterance);
    },
    [persistProgress, stopDeviceSpeech]
  );

  const loadAndPlaySegment = useCallback(
    async (
      book: Book,
      chapterIdx: number,
      segmentIdx: number,
      shouldAutoPlay: boolean,
      seekSeconds?: number,
      forceDeviceVoice?: boolean
    ) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (prefetchTimerRef.current !== null) {
        window.clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = null;
      }

      const token = ++playbackTokenRef.current;
      setError(null);
      setIsQuotaError(false);
      setSegmentCurrentTime(0);
      setSegmentDuration(0);

      const updatedBook: Book = {
        ...book,
        currentChapterIndex: chapterIdx,
        currentSegmentIndex: segmentIdx,
        lastPlayedAt: Date.now(),
        completed: false,
      };
      persistProgress(updatedBook);

      audio.pause();
      stopDeviceSpeech();

      const activeDeviceMode = forceDeviceVoice ?? useDeviceVoiceRef.current;
      if (activeDeviceMode) {
        speakWithDeviceVoice(
          updatedBook,
          chapterIdx,
          segmentIdx,
          shouldAutoPlay,
          token,
          (b, nCh, nSeg) => {
            void loadAndPlaySegment(b, nCh, nSeg, true, undefined, true);
          }
        );
        return;
      }

      setIsBuffering(true);

      try {
        const url = await fetchSegmentUrl(
          updatedBook,
          chapterIdx,
          segmentIdx,
          updatedBook.voiceName
        );
        if (playbackTokenRef.current !== token) return;

        audio.src = url;
        audio.playbackRate = updatedBook.playbackSpeed;
        audio.preservesPitch = true;

        if (seekSeconds && seekSeconds > 0) {
          audio.onloadedmetadata = () => {
            if (playbackTokenRef.current !== token) return;
            audio.currentTime = Math.min(
              seekSeconds,
              Math.max(0, audio.duration - 0.25)
            );
          };
        } else {
          audio.onloadedmetadata = null;
        }

        if (shouldAutoPlay) {
          await audio.play();
          if (playbackTokenRef.current !== token) return;
          setIsPlaying(true);
          prefetchNext(updatedBook, chapterIdx, segmentIdx, token);
        } else {
          setIsPlaying(false);
        }
      } catch (err: unknown) {
        if (playbackTokenRef.current !== token) return;
        setIsPlaying(false);
        setIsQuotaError(err instanceof TtsQuotaError);
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível reproduzir o áudio."
        );
      } finally {
        if (playbackTokenRef.current === token) {
          setIsBuffering(false);
        }
      }
    },
    [
      fetchSegmentUrl,
      persistProgress,
      prefetchNext,
      speakWithDeviceVoice,
      stopDeviceSpeech,
    ]
  );

  // Wire HTMLAudioElement event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setSegmentCurrentTime(audio.currentTime || 0);
      setSegmentDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    const handleLoadedMetadata = () => {
      setSegmentDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    const handleEnded = () => {
      const book = activeBookRef.current;
      if (!book) return;

      const ch = book.chapters[book.currentChapterIndex];
      if (!ch) return;

      if (book.currentSegmentIndex + 1 < ch.segments.length) {
        void loadAndPlaySegment(
          book,
          book.currentChapterIndex,
          book.currentSegmentIndex + 1,
          true
        );
      } else if (book.currentChapterIndex + 1 < book.chapters.length) {
        void loadAndPlaySegment(book, book.currentChapterIndex + 1, 0, true);
      } else {
        setIsPlaying(false);
        persistProgress({
          ...book,
          completed: true,
          lastPlayedAt: Date.now(),
        });
      }
    };

    const handlePause = () => {
      if (isPlayingRef.current && audio.ended === false) {
        setIsPlaying(false);
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
    };
  }, [loadAndPlaySegment, persistProgress]);

  const openBook = useCallback(
    (book: Book, autoPlay = true) => {
      const safeChapter = Math.min(
        Math.max(0, book.currentChapterIndex),
        Math.max(0, book.chapters.length - 1)
      );
      const chapter = book.chapters[safeChapter];
      const safeSegment = chapter
        ? Math.min(
            Math.max(0, book.currentSegmentIndex),
            chapter.segments.length - 1
          )
        : 0;

      void loadAndPlaySegment(book, safeChapter, safeSegment, autoPlay);
    },
    [loadAndPlaySegment]
  );

  const togglePlayPause = useCallback(async () => {
    const book = activeBookRef.current;
    const audio = audioRef.current;
    if (!book || !audio) return;

    if (useDeviceVoiceRef.current) {
      if (isPlaying) {
        stopDeviceSpeech();
        setIsPlaying(false);
      } else {
        void loadAndPlaySegment(
          book,
          book.currentChapterIndex,
          book.currentSegmentIndex,
          true,
          undefined,
          true
        );
      }
      return;
    }

    if (isPlaying) {
      if (prefetchTimerRef.current !== null) {
        window.clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = null;
      }
      audio.pause();
      setIsPlaying(false);
      return;
    }

    if (audio.src) {
      try {
        audio.playbackRate = book.playbackSpeed;
        await audio.play();
        setIsPlaying(true);
        prefetchNext(
          book,
          book.currentChapterIndex,
          book.currentSegmentIndex,
          playbackTokenRef.current
        );
      } catch {
        void loadAndPlaySegment(
          book,
          book.currentChapterIndex,
          book.currentSegmentIndex,
          true
        );
      }
    } else {
      void loadAndPlaySegment(
        book,
        book.currentChapterIndex,
        book.currentSegmentIndex,
        true
      );
    }
  }, [isPlaying, loadAndPlaySegment, prefetchNext, stopDeviceSpeech]);

  const jumpToChapter = useCallback(
    (chapterIndex: number, autoPlay = true) => {
      const book = activeBookRef.current;
      if (!book || chapterIndex < 0 || chapterIndex >= book.chapters.length) {
        return;
      }
      void loadAndPlaySegment(book, chapterIndex, 0, autoPlay);
    },
    [loadAndPlaySegment]
  );

  const jumpToSegment = useCallback(
    (segmentIndex: number, autoPlay = true) => {
      const book = activeBookRef.current;
      if (!book) return;
      const chapter = book.chapters[book.currentChapterIndex];
      if (
        !chapter ||
        segmentIndex < 0 ||
        segmentIndex >= chapter.segments.length
      ) {
        return;
      }
      void loadAndPlaySegment(
        book,
        book.currentChapterIndex,
        segmentIndex,
        autoPlay
      );
    },
    [loadAndPlaySegment]
  );

  const skipSeconds = useCallback(
    (delta: number) => {
      const audio = audioRef.current;
      const book = activeBookRef.current;
      if (!audio || !book) return;

      const chapter = book.chapters[book.currentChapterIndex];
      if (!chapter) return;

      if (useDeviceVoiceRef.current) {
        if (delta < 0 && book.currentSegmentIndex > 0) {
          void loadAndPlaySegment(
            book,
            book.currentChapterIndex,
            book.currentSegmentIndex - 1,
            isPlaying
          );
        } else if (
          delta > 0 &&
          book.currentSegmentIndex + 1 < chapter.segments.length
        ) {
          void loadAndPlaySegment(
            book,
            book.currentChapterIndex,
            book.currentSegmentIndex + 1,
            isPlaying
          );
        }
        return;
      }

      const target = audio.currentTime + delta;

      if (delta < 0) {
        if (target >= 0) {
          audio.currentTime = target;
          setSegmentCurrentTime(target);
        } else if (book.currentSegmentIndex > 0) {
          void loadAndPlaySegment(
            book,
            book.currentChapterIndex,
            book.currentSegmentIndex - 1,
            isPlaying
          );
        } else if (book.currentChapterIndex > 0) {
          const prevCh = book.chapters[book.currentChapterIndex - 1];
          void loadAndPlaySegment(
            book,
            book.currentChapterIndex - 1,
            Math.max(0, prevCh.segments.length - 1),
            isPlaying
          );
        } else {
          audio.currentTime = 0;
          setSegmentCurrentTime(0);
        }
      } else {
        const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
        if (dur > 0 && target < dur - 0.3) {
          audio.currentTime = target;
          setSegmentCurrentTime(target);
        } else if (book.currentSegmentIndex + 1 < chapter.segments.length) {
          void loadAndPlaySegment(
            book,
            book.currentChapterIndex,
            book.currentSegmentIndex + 1,
            isPlaying
          );
        } else if (book.currentChapterIndex + 1 < book.chapters.length) {
          void loadAndPlaySegment(
            book,
            book.currentChapterIndex + 1,
            0,
            isPlaying
          );
        }
      }
    },
    [isPlaying, loadAndPlaySegment]
  );

  const scrubChapterRatio = useCallback(
    (ratio: number) => {
      const book = activeBookRef.current;
      if (!book) return;
      const chapter = book.chapters[book.currentChapterIndex];
      if (!chapter || chapter.segments.length === 0) return;

      const clamped = Math.max(0, Math.min(0.9999, ratio));
      const exactIdx = clamped * chapter.segments.length;
      const targetSegment = Math.floor(exactIdx);
      const intraRatio = exactIdx - targetSegment;

      if (
        !useDeviceVoiceRef.current &&
        targetSegment === book.currentSegmentIndex &&
        audioRef.current &&
        Number.isFinite(audioRef.current.duration) &&
        audioRef.current.duration > 0
      ) {
        const newTime = intraRatio * audioRef.current.duration;
        audioRef.current.currentTime = newTime;
        setSegmentCurrentTime(newTime);
      } else {
        void loadAndPlaySegment(
          book,
          book.currentChapterIndex,
          targetSegment,
          isPlaying
        );
      }
    },
    [isPlaying, loadAndPlaySegment]
  );

  const setPlaybackSpeed = useCallback(
    (speed: number) => {
      const book = activeBookRef.current;
      if (!book) return;
      if (audioRef.current) {
        audioRef.current.playbackRate = speed;
        audioRef.current.preservesPitch = true;
      }
      const updated = { ...book, playbackSpeed: speed };
      persistProgress(updated);
      if (useDeviceVoiceRef.current && isPlayingRef.current) {
        void loadAndPlaySegment(
          updated,
          updated.currentChapterIndex,
          updated.currentSegmentIndex,
          true,
          undefined,
          true
        );
      }
    },
    [loadAndPlaySegment, persistProgress]
  );

  const setVoiceName = useCallback(
    (voiceName: VoiceName) => {
      const book = activeBookRef.current;
      if (!book) return;
      setUseDeviceVoice(false);
      useDeviceVoiceRef.current = false;
      quotaExhaustedRef.current = false;
      const updated = { ...book, voiceName };
      void loadAndPlaySegment(
        updated,
        updated.currentChapterIndex,
        updated.currentSegmentIndex,
        isPlaying,
        undefined,
        false
      );
    },
    [isPlaying, loadAndPlaySegment]
  );

  const enableDeviceVoiceFallback = useCallback(() => {
    const book = activeBookRef.current;
    if (!book) return;
    setUseDeviceVoice(true);
    useDeviceVoiceRef.current = true;
    setError(null);
    setIsQuotaError(false);
    void loadAndPlaySegment(
      book,
      book.currentChapterIndex,
      book.currentSegmentIndex,
      true,
      undefined,
      true
    );
  }, [loadAndPlaySegment]);

  const disableDeviceVoiceFallback = useCallback(() => {
    const book = activeBookRef.current;
    stopDeviceSpeech();
    setUseDeviceVoice(false);
    useDeviceVoiceRef.current = false;
    quotaExhaustedRef.current = false;
    if (book) {
      void loadAndPlaySegment(
        book,
        book.currentChapterIndex,
        book.currentSegmentIndex,
        true,
        undefined,
        false
      );
    }
  }, [loadAndPlaySegment, stopDeviceSpeech]);

  const clearActiveBookIfDeleted = useCallback(
    (deletedId: string) => {
      if (activeBookRef.current?.id === deletedId) {
        playbackTokenRef.current++;
        stopDeviceSpeech();
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
        }
        setIsPlaying(false);
        setIsBuffering(false);
        setActiveBook(null);
      }
    },
    [stopDeviceSpeech]
  );

  // Android / OS Lock-Screen & Notification Controls via Media Session API
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    if (!activeBook) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      return;
    }

    const chapter =
      activeBook.chapters[activeBook.currentChapterIndex] ??
      activeBook.chapters[0];

    const artwork: MediaImage[] = activeBook.coverUrl
      ? [{ src: activeBook.coverUrl, sizes: "512x512", type: "image/jpeg" }]
      : [{ src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" }];

    navigator.mediaSession.metadata = new MediaMetadata({
      title: chapter?.title || activeBook.title,
      artist: activeBook.author || "VozLivro",
      album: activeBook.title,
      artwork,
    });

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

    navigator.mediaSession.setActionHandler("play", () => {
      if (!isPlayingRef.current) void togglePlayPause();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      if (isPlayingRef.current) void togglePlayPause();
    });
    navigator.mediaSession.setActionHandler("seekbackward", () => {
      skipSeconds(-15);
    });
    navigator.mediaSession.setActionHandler("seekforward", () => {
      skipSeconds(15);
    });
    navigator.mediaSession.setActionHandler("previoustrack", () => {
      if (activeBook.currentChapterIndex > 0) {
        jumpToChapter(activeBook.currentChapterIndex - 1, true);
      }
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => {
      if (activeBook.currentChapterIndex + 1 < activeBook.chapters.length) {
        jumpToChapter(activeBook.currentChapterIndex + 1, true);
      }
    });
  }, [activeBook, isPlaying, togglePlayPause, skipSeconds, jumpToChapter]);

  return {
    activeBook,
    isPlaying,
    isBuffering,
    error,
    isQuotaError,
    useDeviceVoice,
    segmentCurrentTime,
    segmentDuration,
    openBook,
    togglePlayPause,
    jumpToChapter,
    jumpToSegment,
    skipSeconds,
    scrubChapterRatio,
    setPlaybackSpeed,
    setVoiceName,
    enableDeviceVoiceFallback,
    disableDeviceVoiceFallback,
    clearActiveBookIfDeleted,
    clearError: () => {
      setError(null);
      setIsQuotaError(false);
    },
  };
}
