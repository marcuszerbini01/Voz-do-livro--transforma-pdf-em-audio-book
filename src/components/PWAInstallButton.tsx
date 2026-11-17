import { useState } from "react";
import { Download, X } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-medium text-neutral-800 transition-colors whitespace-nowrap hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
      >
        <Download className="h-3.5 w-3.5" />
        <span>Instalar app</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-medium text-neutral-800 transition-colors whitespace-nowrap hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Instalar no iPhone</span>
        </button>

        {showGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Como instalar no iPhone ou iPad"
            onClick={() => setShowGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-[#FAF9F6] p-6 shadow-2xl dark:border-neutral-800 dark:bg-[#131316]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-neutral-950 dark:text-white">
                  Instalar no iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="Fechar"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-200/70 dark:text-neutral-400 dark:hover:bg-neutral-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="mt-3 space-y-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                <li>
                  1. Toque no botão <strong>Compartilhar</strong> na barra do
                  Safari.
                </li>
                <li>
                  2. Role para baixo e toque em{" "}
                  <strong>Adicionar à Tela de Início</strong>.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-5 h-10 w-full rounded-xl bg-neutral-950 text-xs font-semibold text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
