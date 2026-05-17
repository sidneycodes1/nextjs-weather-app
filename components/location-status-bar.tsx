"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { RefreshCw, AlertCircle, MapPin } from "lucide-react";

interface LocationStatusBarProps {
  status: "idle" | "loading" | "success" | "error" | "denied";
  locationDisplay: string | null;
  onRefresh?: () => void;
  onRetry?: () => void;
  isManual?: boolean;
}

export function LocationStatusBar({
  status,
  locationDisplay,
  onRefresh,
  onRetry,
  isManual,
}: LocationStatusBarProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    onRefresh?.();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <AnimatePresence>
      {status === "loading" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-800 px-4 py-3"
        >
          <div className="flex items-center justify-center gap-2 max-w-6xl mx-auto">
            <div className="animate-spin">
              <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
              Detecting your location…
            </span>
          </div>
        </motion.div>
      )}

      {status === "success" && locationDisplay && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="bg-green-50 dark:bg-green-950 border-b border-green-200 dark:border-green-800 px-4 py-3"
        >
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-900 dark:text-green-200">
                📍 {locationDisplay}
              </span>
            </div>
            {onRefresh && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-1 hover:bg-green-100 dark:hover:bg-green-900 rounded-md transition-colors disabled:opacity-50"
                title="Refresh location"
              >
                <RefreshCw
                  className={`w-4 h-4 text-green-600 dark:text-green-400 ${
                    isRefreshing ? "animate-spin" : ""
                  }`}
                />
              </button>
            )}
          </div>
        </motion.div>
      )}

      {status === "error" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="bg-orange-50 dark:bg-orange-950 border-b border-orange-200 dark:border-orange-800 px-4 py-3"
        >
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span className="text-sm font-medium text-orange-900 dark:text-orange-200">
                Unable to detect location. Please try again or search manually.
              </span>
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-xs px-3 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        </motion.div>
      )}

      {status === "denied" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="bg-red-50 dark:bg-red-950 border-b border-red-200 dark:border-red-800 px-4 py-3"
        >
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <span className="text-sm font-medium text-red-900 dark:text-red-200">
              📍 Location access denied — enable in browser settings
            </span>
          </div>
        </motion.div>
      )}

      {isManual && status === "idle" && locationDisplay && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3"
        >
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <span className="text-sm text-slate-700 dark:text-slate-300">
              📍 {locationDisplay}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
