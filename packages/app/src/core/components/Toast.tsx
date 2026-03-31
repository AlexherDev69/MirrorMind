import { useEffect, useState, useCallback } from "react";
import { create } from "zustand";

interface ToastMessage {
  readonly id: number;
  readonly text: string;
  readonly type: "info" | "error" | "success";
}

interface ToastStore {
  readonly toasts: ToastMessage[];
  addToast: (text: string, type?: "info" | "error" | "success") => void;
  removeToast: (id: number) => void;
}

let nextId = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (text, type = "info") => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, text, type }] }));
    // Auto-remove after 3 seconds
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },
  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

/** Shorthand to show a toast from anywhere. */
export function showToast(text: string, type: "info" | "error" | "success" = "info") {
  useToastStore.getState().addToast(text, type);
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  readonly toast: ToastMessage;
  readonly onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setTimeout(onDismiss, 200);
  }, [onDismiss]);

  const colorMap = {
    info: "bg-zinc-800 border-zinc-700 text-zinc-300",
    error: "bg-red-950 border-red-800/50 text-red-300",
    success: "bg-green-950 border-green-800/50 text-green-300",
  };

  return (
    <div
      className={`pointer-events-auto px-4 py-2 rounded-lg border text-xs shadow-lg transition-all duration-200 cursor-pointer ${
        colorMap[toast.type]
      } ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
      onClick={handleDismiss}
    >
      {toast.text}
    </div>
  );
}
