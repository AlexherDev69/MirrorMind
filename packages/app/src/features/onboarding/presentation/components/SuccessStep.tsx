interface SuccessStepProps {
  readonly model: string;
  readonly brand: string | null;
}

export function SuccessStep({ model, brand }: SuccessStepProps) {
  return (
    <div className="flex flex-col items-center gap-5 text-center px-8">
      <div className="w-20 h-20 rounded-full bg-green-950 flex items-center justify-center">
        <svg
          className="w-10 h-10 text-green-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-green-400">All set!</h2>
        <p className="text-sm text-zinc-400">
          {brand ? `${brand} — ` : ""}{model}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-zinc-500">Starting stream...</p>
      </div>
    </div>
  );
}
