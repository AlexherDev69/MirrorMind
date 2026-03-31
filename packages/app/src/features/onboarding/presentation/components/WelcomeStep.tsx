interface WelcomeStepProps {
  readonly onNeedHelp: () => void;
}

export function WelcomeStep({ onNeedHelp }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center gap-6 text-center px-8">
      <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center">
        <svg
          className="w-10 h-10 text-zinc-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-100">
          Connect your Android phone
        </h2>
        <p className="text-sm text-zinc-400">
          Plug your phone via USB cable. USB debugging must be enabled.
        </p>
      </div>

      <div className="w-6 h-6 border-2 border-zinc-600 border-t-blue-500 rounded-full animate-spin" />
      <p className="text-xs text-zinc-600">Waiting for device...</p>

      <button
        onClick={onNeedHelp}
        className="mt-4 px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors"
      >
        I need help enabling USB debugging
      </button>
    </div>
  );
}
