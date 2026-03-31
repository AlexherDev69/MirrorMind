interface DeviceStatusProps {
  readonly state: "no-device" | "onboarding" | "connecting" | "streaming" | "disconnected" | "error";
}

const STATUS_CONFIG = {
  "no-device": { label: "No device", color: "bg-zinc-500" },
  onboarding: { label: "Setup", color: "bg-purple-500 animate-pulse" },
  connecting: { label: "Connecting", color: "bg-yellow-500" },
  streaming: { label: "Streaming", color: "bg-green-500" },
  disconnected: { label: "Disconnected", color: "bg-yellow-500 animate-pulse" },
  error: { label: "Error", color: "bg-red-500" },
} as const;

export function DeviceStatus({ state }: DeviceStatusProps) {
  const config = STATUS_CONFIG[state];

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-xs text-zinc-400">{config.label}</span>
    </div>
  );
}
