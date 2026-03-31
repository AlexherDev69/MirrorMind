import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-purple-600 hover:bg-purple-500 text-white font-semibold",
  secondary:
    "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium",
  ghost:
    "bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200",
  danger:
    "bg-red-900/50 hover:bg-red-800/50 text-red-400",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly fullWidth?: boolean;
}

export function Button({
  variant = "secondary",
  fullWidth = false,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 ${
        VARIANT_CLASSES[variant]
      } ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
