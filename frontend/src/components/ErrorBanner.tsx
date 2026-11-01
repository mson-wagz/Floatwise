interface ErrorBannerProps {
  title?: string;
  message: string;
  type?: "warning" | "error" | "info";
  onDismiss?: () => void;
}

export default function ErrorBanner({
  title = "Anomaly Detected",
  message,
  type = "warning",
  onDismiss,
}: ErrorBannerProps) {
  const colors = {
    warning: "bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-200",
    error: "bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-950/40 dark:border-rose-700 dark:text-rose-200",
    info: "bg-blue-50 border-blue-300 text-blue-900 dark:bg-blue-950/40 dark:border-blue-700 dark:text-blue-200",
  };

  const icons = {
    warning: "⚠️",
    error: "🛑",
    info: "ℹ️",
  };

  return (
    <div className={`rounded-xl border p-3.5 flex items-start justify-between gap-3 text-sm shadow-sm ${colors[type]}`}>
      <div className="flex items-start gap-2.5">
        <span className="text-base select-none">{icons[type]}</span>
        <div>
          {title && <p className="font-semibold text-xs tracking-wider uppercase opacity-90">{title}</p>}
          <p className="mt-0.5 leading-relaxed">{message}</p>
        </div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-xs font-bold opacity-60 hover:opacity-100 p-1"
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}
