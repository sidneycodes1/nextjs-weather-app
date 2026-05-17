"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  MapPin,
  Loader2,
  CheckCircle,
  AlertCircle,
  XCircle,
} from "lucide-react";

interface LocationPermissionModalProps {
  isOpen: boolean;
  status: "idle" | "loading" | "success" | "error" | "denied";
  locationDisplay: string | null;
  onAllow: () => void;
  onCancel: () => void;
  onRetry?: () => void;
}

export function LocationPermissionModal({
  isOpen,
  status,
  locationDisplay,
  onAllow,
  onCancel,
  onRetry,
}: LocationPermissionModalProps) {
  const [showAutoClose, setShowAutoClose] = useState(false);

  // Auto-close on success after 1.5 seconds
  useEffect(() => {
    if (status === "success") {
      setShowAutoClose(true);
      const timer = setTimeout(() => {
        onCancel();
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setShowAutoClose(false);
    }
  }, [status, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onCancel}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-md mx-4 rounded-lg bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-4">
              {/* Icon */}
              <div className="flex justify-center">
                {status === "idle" && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.4 }}
                  >
                    <MapPin className="w-12 h-12 text-blue-500" />
                  </motion.div>
                )}

                {status === "loading" && (
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                )}

                {status === "success" && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                  >
                    <CheckCircle className="w-12 h-12 text-green-500" />
                  </motion.div>
                )}

                {status === "error" && (
                  <AlertCircle className="w-12 h-12 text-orange-500" />
                )}

                {status === "denied" && (
                  <XCircle className="w-12 h-12 text-red-500" />
                )}
              </div>

              {/* Title */}
              <div className="text-center space-y-2">
                {status === "idle" && (
                  <>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                      Allow Location Access
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Enable location access to get real-time weather updates
                      and forecasts for your exact current area.
                    </p>
                  </>
                )}

                {status === "loading" && (
                  <>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                      Detecting your location…
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Please wait while we access your position.
                    </p>
                  </>
                )}

                {status === "success" && (
                  <>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                      Location Found
                    </h2>
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-sm text-slate-600 dark:text-slate-300"
                    >
                      📍 {locationDisplay}
                    </motion.p>
                  </>
                )}

                {status === "error" && (
                  <>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                      Unable to Detect Location
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      We couldn't access your location. Please try again or
                      search manually.
                    </p>
                  </>
                )}

                {status === "denied" && (
                  <>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                      Location Access Denied
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Enable location in your browser settings or search for
                      cities manually.
                    </p>
                  </>
                )}
              </div>

              {/* Buttons */}
              {!showAutoClose && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-3 pt-4"
                >
                  {status === "idle" && (
                    <>
                      <button
                        onClick={onAllow}
                        className="w-full px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
                      >
                        Allow Access
                      </button>
                      <button
                        onClick={onCancel}
                        className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors"
                      >
                        Not Now
                      </button>
                    </>
                  )}

                  {status === "error" && (
                    <>
                      <button
                        onClick={onRetry || onAllow}
                        className="w-full px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
                      >
                        Retry
                      </button>
                      <button
                        onClick={onCancel}
                        className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors"
                      >
                        Search Manually
                      </button>
                    </>
                  )}

                  {status === "denied" && (
                    <button
                      onClick={onCancel}
                      className="w-full px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-medium transition-colors"
                    >
                      Search Manually
                    </button>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
