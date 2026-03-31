import { useEffect, useState, type ReactNode } from "react";

interface FadeTransitionProps {
  /** Unique key that triggers the transition when it changes. */
  readonly transitionKey: string;
  readonly children: ReactNode;
  /** Duration in ms. Default 200. */
  readonly duration?: number;
}

/**
 * Fades content in when `transitionKey` changes.
 * Uses a simple opacity + translateY CSS transition.
 */
export function FadeTransition({
  transitionKey,
  children,
  duration = 200,
}: FadeTransitionProps) {
  const [visible, setVisible] = useState(false);
  const [currentKey, setCurrentKey] = useState(transitionKey);

  useEffect(() => {
    if (transitionKey !== currentKey) {
      // Fade out
      setVisible(false);

      const timeout = setTimeout(() => {
        setCurrentKey(transitionKey);
        // Fade in on next frame
        requestAnimationFrame(() => setVisible(true));
      }, duration);

      return () => clearTimeout(timeout);
    } else {
      // Initial mount — fade in
      requestAnimationFrame(() => setVisible(true));
    }
  }, [transitionKey, currentKey, duration]);

  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{
        transition: `opacity ${duration}ms ease, transform ${duration}ms ease`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
      }}
    >
      {children}
    </div>
  );
}
