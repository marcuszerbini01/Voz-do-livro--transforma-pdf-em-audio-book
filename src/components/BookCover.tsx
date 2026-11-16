import { BookOpen } from "lucide-react";

interface BookCoverProps {
  title: string;
  author?: string;
  coverUrl?: string;
  accentRgb?: [number, number, number];
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function BookCover({
  title,
  author,
  coverUrl,
  accentRgb,
  className = "",
  size = "md",
}: BookCoverProps) {
  const [r, g, b] = accentRgb ?? [118, 92, 58];

  if (coverUrl) {
    return (
      <div
        className={`relative overflow-hidden bg-neutral-200 dark:bg-neutral-900 select-none ${className}`}
      >
        <img
          src={coverUrl}
          alt={`Capa de ${title}`}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden select-none text-white ${className}`}
      style={{
        background: `linear-gradient(155deg, rgba(${r}, ${g}, ${b}, 0.92) 0%, rgba(${Math.max(
          16,
          Math.round(r * 0.35)
        )}, ${Math.max(16, Math.round(g * 0.35))}, ${Math.max(
          18,
          Math.round(b * 0.35)
        )}, 1) 100%)`,
      }}
    >
      {/* Subtle spine crease */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/30 to-transparent" />

      <div
        className={`relative z-10 flex items-center justify-between opacity-75 ${
          size === "sm" ? "p-2" : size === "md" ? "p-3.5" : "p-6"
        }`}
      >
        <BookOpen
          className={
            size === "sm" ? "h-3.5 w-3.5" : size === "md" ? "h-4 w-4" : "h-6 w-6"
          }
        />
      </div>

      <div
        className={`relative z-10 ${
          size === "sm"
            ? "p-2"
            : size === "md"
            ? "p-3.5 pt-1"
            : "p-6 pt-2"
        }`}
      >
        <p
          className={`font-semibold leading-tight tracking-tight text-white/95 line-clamp-3 ${
            size === "sm"
              ? "text-[9px]"
              : size === "md"
              ? "text-xs"
              : "text-xl sm:text-2xl"
          }`}
        >
          {title}
        </p>
        {author && size !== "sm" && (
          <p
            className={`mt-1.5 text-white/70 truncate ${
              size === "md" ? "text-[11px]" : "text-sm"
            }`}
          >
            {author}
          </p>
        )}
      </div>
    </div>
  );
}
