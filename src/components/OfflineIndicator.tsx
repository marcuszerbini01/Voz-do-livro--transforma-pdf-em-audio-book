import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-16 right-4 z-50 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/15 px-3.5 py-2 text-xs font-medium text-amber-800 shadow-lg backdrop-blur-md dark:text-amber-200">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>Modo offline — reproduzindo áudios salvos</span>
    </div>
  );
}
