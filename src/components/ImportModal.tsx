import { useRef, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import {
  parseDocumentFile,
  parseTextInput,
  type ParsedDocument,
} from "../utils/documentParser";
import {
  buildChaptersFromAiScan,
  type AiChapterResponse,
} from "../utils/chapterSplitter";
import type { Book, VoiceName } from "../types/book";
import { VOICE_OPTIONS } from "../types/book";

interface ImportModalProps {
  isOpen: boolean;
  defaultVoice: VoiceName;
  onClose: () => void;
  onImported: (book: Book) => void;
}

export function ImportModal({
  isOpen,
  defaultVoice,
  onClose,
  onImported,
}: ImportModalProps) {
  const [mode, setMode] = useState<"file" | "text">("file");
  const [isDragging, setIsDragging] = useState(false);
  const [pastedTitle, setPastedTitle] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(defaultVoice);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const isBusy = statusMessage !== null;

  const processParsedDocument = async (
    doc: ParsedDocument,
    fileName: string
  ) => {
    setStatusMessage("IA escaneando e dividindo capítulos...");

    const response = await fetch("/api/analyze-chapters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleHint: doc.titleHint,
        authorHint: doc.authorHint,
        pages: doc.pages,
      }),
    });

    if (!response.ok) {
      let msg = "Falha ao analisar capítulos com IA.";
      try {
        const errPayload = (await response.json()) as { error?: string };
        if (errPayload.error) msg = errPayload.error;
      } catch {
        // Keep fallback
      }
      throw new Error(msg);
    }

    const aiData = (await response.json()) as AiChapterResponse;
    const chapters = buildChaptersFromAiScan(doc.pages, aiData);
    const totalEstimatedSeconds = chapters.reduce(
      (sum, c) => sum + c.estimatedSeconds,
      0
    );

    const newBook: Book = {
      id: `book_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: aiData.title?.trim() || doc.titleHint || "Livro sem título",
      author:
        aiData.author?.trim() || doc.authorHint || "Autor desconhecido",
      summary: aiData.summary?.trim() || "",
      fileName,
      fileType: doc.fileType,
      coverUrl: doc.coverUrl,
      accentRgb: doc.accentRgb,
      totalPages: doc.pages.length,
      totalEstimatedSeconds,
      chapters,
      currentChapterIndex: 0,
      currentSegmentIndex: 0,
      playbackSpeed: 1.0,
      voiceName: selectedVoice,
      createdAt: Date.now(),
    };

    onImported(newBook);
    setStatusMessage(null);
    setPastedTitle("");
    setPastedText("");
    onClose();
  };

  const handleFileSelected = async (file: File) => {
    setError(null);
    setStatusMessage("Extraindo texto e capa do arquivo...");
    try {
      const parsed = await parseDocumentFile(file);
      await processParsedDocument(parsed, file.name);
    } catch (err: unknown) {
      setStatusMessage(null);
      setError(
        err instanceof Error ? err.message : "Erro ao processar o arquivo."
      );
    }
  };

  const handlePasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!pastedText.trim()) {
      setError("Cole algum texto para transformar em audiolivro.");
      return;
    }
    setStatusMessage("Preparando documento...");
    try {
      const parsed = await parseTextInput(
        pastedText,
        pastedTitle.trim() || "Leitura rápida"
      );
      await processParsedDocument(
        parsed,
        `${pastedTitle.trim() || "texto"}.txt`
      );
    } catch (err: unknown) {
      setStatusMessage(null);
      setError(
        err instanceof Error ? err.message : "Erro ao processar o texto."
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-[#FAF9F6] p-6 shadow-2xl dark:border-neutral-800 dark:bg-[#131316]">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="import-modal-title"
            className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100"
          >
            Importar livro ou documento
          </h2>
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-200/70 hover:text-neutral-900 disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-neutral-200/70 p-1 dark:bg-neutral-900">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              setMode("file");
              setError(null);
            }}
            className={`min-h-[40px] rounded-lg px-3 text-sm font-medium transition-colors whitespace-nowrap ${
              mode === "file"
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            }`}
          >
            Arquivo (PDF, EPUB, TXT)
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              setMode("text");
              setError(null);
            }}
            className={`min-h-[40px] rounded-lg px-3 text-sm font-medium transition-colors whitespace-nowrap ${
              mode === "text"
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            }`}
          >
            Colar texto
          </button>
        </div>

        {/* Voice Preference */}
        <div className="mt-5">
          <label
            htmlFor="import-voice-select"
            className="block text-xs font-medium text-neutral-600 dark:text-neutral-400"
          >
            Voz natural de narração
          </label>
          <select
            id="import-voice-select"
            disabled={isBusy}
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value as VoiceName)}
            className="mt-1.5 h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-400"
          >
            {VOICE_OPTIONS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — {v.description}
              </option>
            ))}
          </select>
        </div>

        {mode === "file" ? (
          <div className="mt-5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.epub,.txt,.md,application/pdf,application/epub+zip,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFileSelected(f);
                e.target.value = "";
              }}
            />

            <button
              type="button"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                if (!isBusy) setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (isBusy) return;
                const file = e.dataTransfer.files?.[0];
                if (file) void handleFileSelected(file);
              }}
              className={`flex w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center transition-colors ${
                isDragging
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-neutral-300 bg-neutral-100/60 hover:border-neutral-400 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900/50 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
              }`}
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                  <p className="mt-3 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {statusMessage}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    Isso leva apenas alguns segundos.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                    <Upload className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    Clique para escolher ou arraste seu arquivo aqui
                  </p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    PDF, EPUB ou TXT · Capa e capítulos extraídos automaticamente
                  </p>
                </>
              )}
            </button>
          </div>
        ) : (
          <form onSubmit={handlePasteSubmit} className="mt-5 space-y-3">
            <div>
              <input
                type="text"
                disabled={isBusy}
                value={pastedTitle}
                onChange={(e) => setPastedTitle(e.target.value)}
                placeholder="Título (opcional)"
                className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400"
              />
            </div>
            <div>
              <textarea
                rows={6}
                disabled={isBusy}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Cole o texto do livro, artigo ou apostila aqui..."
                className="w-full rounded-xl border border-neutral-300 bg-white p-3.5 text-sm leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400"
              />
            </div>
            <button
              type="submit"
              disabled={isBusy}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{statusMessage}</span>
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  <span>Analisar capítulos e criar audiolivro</span>
                </>
              )}
            </button>
          </form>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs leading-relaxed text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
