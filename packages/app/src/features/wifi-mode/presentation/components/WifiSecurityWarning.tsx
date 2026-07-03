interface WifiSecurityWarningProps {
  readonly onReturnToUsb: () => void;
  readonly disabled?: boolean;
}

/**
 * Inline warning banner explaining the LAN exposure risk of WiFi mode.
 * Shown while connected over WiFi, with a button to revert to USB.
 */
export function WifiSecurityWarning({ onReturnToUsb, disabled }: WifiSecurityWarningProps) {
  return (
    <div className="flex items-start gap-2 rounded border border-amber-800/40 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
      <span aria-hidden className="mt-0.5">⚠</span>
      <div className="flex-1">
        <p className="font-medium">Your phone is exposed on the local network (port 5555).</p>
        <p className="mt-0.5 text-amber-300/80">
          Anyone on the same WiFi may attempt to connect. Return to USB when you are done.
        </p>
      </div>
      <button
        type="button"
        onClick={onReturnToUsb}
        disabled={disabled}
        className="shrink-0 rounded bg-amber-800 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 text-[11px] font-medium text-amber-100 transition-colors"
      >
        Return to USB
      </button>
    </div>
  );
}
