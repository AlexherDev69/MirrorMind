import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

interface ModalProps {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly width?: string;
}

/**
 * Reusable modal with backdrop, Escape to close, focus trap,
 * data-modal attribute, and entrance/exit animation.
 */
export function Modal({
  title,
  onClose,
  children,
  footer,
  width = "w-full max-w-[420px]",
}: ModalProps) {
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Animate in on mount + focus the panel
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    panelRef.current?.focus();
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 150);
  }, [onClose]);

  // Escape to close + focus trap
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
        return;
      }

      // Focus trap: Tab cycles within the modal
      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;

        const focusable = panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [handleClose],
  );

  return (
    <div
      data-modal
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-150"
      style={{ opacity: visible ? 1 : 0 }}
      onClick={handleClose}
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl ${width} max-h-[80vh] flex flex-col mx-4 transition-all duration-150 outline-none`}
        style={{
          transform: visible ? "scale(1) translateY(0)" : "scale(0.95) translateY(8px)",
          opacity: visible ? 1 : 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-6 h-6 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Close"
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-zinc-800">{footer}</div>
        )}
      </div>
    </div>
  );
}
