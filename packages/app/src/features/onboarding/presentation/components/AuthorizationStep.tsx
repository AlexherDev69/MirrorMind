export function AuthorizationStep() {
  return (
    <div className="flex flex-col items-center gap-6 text-center px-8">
      <div className="w-20 h-20 rounded-full bg-yellow-950 flex items-center justify-center">
        <svg
          className="w-10 h-10 text-yellow-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-100">
          Authorize your PC
        </h2>
        <p className="text-sm text-zinc-400">
          A popup should appear on your phone asking to allow USB debugging.
          Tap <span className="text-zinc-200 font-medium">Allow</span>.
        </p>
      </div>

      <div className="bg-zinc-800/50 border border-zinc-800 rounded-lg p-3 w-full">
        <p className="text-xs text-zinc-500">
          Tip: Check <span className="text-zinc-400">"Always allow from this computer"</span> so
          you won't need to authorize again.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-zinc-500">Waiting for authorization...</p>
      </div>
    </div>
  );
}
