import { useCallback, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useSettingsStore } from "../stores/settings.store";
import {
  RESOLUTION_OPTIONS,
  BITRATE_OPTIONS,
  FPS_OPTIONS,
  SCROLL_SENSITIVITY_MIN,
  SCROLL_SENSITIVITY_MAX,
} from "../../domain/settings.types";
import { resetOnboarding } from "../../data/settings-persistence";
import { Modal, Button } from "../../../../core/components";

interface SettingsModalProps {
  readonly onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { settings, updateSettings, toggleAlwaysOnTop, streamSettingsChanged, acknowledgeStreamChange } =
    useSettingsStore();

  const handleClose = useCallback(() => {
    acknowledgeStreamChange();
    onClose();
  }, [acknowledgeStreamChange, onClose]);

  return (
    <Modal
      title="Settings"
      onClose={handleClose}
      footer={<Button variant="secondary" fullWidth onClick={handleClose}>Close</Button>}
    >
      <div className="space-y-6">
        {/* Stream */}
        <Section title="Stream">
          <SelectField
            label="Max resolution"
            value={settings.maxResolution}
            options={RESOLUTION_OPTIONS}
            onChange={(v) => updateSettings({ maxResolution: v })}
          />
          <SelectField
            label="Bitrate"
            value={settings.bitrate}
            options={BITRATE_OPTIONS}
            onChange={(v) => updateSettings({ bitrate: v })}
          />
          <SelectField
            label="Max FPS"
            value={settings.maxFps}
            options={FPS_OPTIONS}
            onChange={(v) => updateSettings({ maxFps: v })}
          />
          {streamSettingsChanged && (
            <p className="text-xs text-yellow-400 mt-2">
              Stream settings changed. Reconnect your phone to apply.
            </p>
          )}
        </Section>

        {/* Window */}
        <Section title="Window">
          <ToggleField
            label="Always on top"
            description="Keep the window above other apps"
            checked={settings.alwaysOnTop}
            onChange={toggleAlwaysOnTop}
          />
          <ToggleField
            label="Minimize to tray"
            description="Hide to system tray instead of closing"
            checked={settings.minimizeToTray}
            onChange={() => updateSettings({ minimizeToTray: !settings.minimizeToTray })}
          />
        </Section>

        {/* Controls */}
        <Section title="Controls">
          <SliderField
            label="Scroll sensitivity"
            value={settings.scrollSensitivity}
            min={SCROLL_SENSITIVITY_MIN}
            max={SCROLL_SENSITIVITY_MAX}
            step={1}
            onChange={(v) => updateSettings({ scrollSensitivity: v })}
          />
        </Section>

        {/* Capture */}
        <Section title="Capture">
          <FolderField
            label="Screenshot folder"
            value={settings.screenshotPath}
            onChange={(v) => updateSettings({ screenshotPath: v })}
          />
          <FolderField
            label="Recording folder"
            value={settings.recordingPath}
            onChange={(v) => updateSettings({ recordingPath: v })}
          />
        </Section>

        {/* Advanced */}
        <Section title="Advanced">
          <ResetOnboardingButton />
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-zinc-500">Version</span>
            <span className="text-xs text-zinc-400">POC v0.1.0</span>
          </div>
        </Section>
      </div>
    </Modal>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function Section({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SelectField<T extends number>({
  label, value, options, onChange,
}: {
  readonly label: string;
  readonly value: T;
  readonly options: ReadonlyArray<{ readonly value: T; readonly label: string }>;
  readonly onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-zinc-300">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as T)}
        className="text-xs px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 focus:outline-none focus:border-purple-600"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleField({
  label, description, checked, onChange,
}: {
  readonly label: string;
  readonly description?: string;
  readonly checked: boolean;
  readonly onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm text-zinc-300">{label}</span>
        {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={onChange}
        role="switch"
        aria-checked={checked}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? "bg-purple-600" : "bg-zinc-700"}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

function SliderField({
  label, value, min, max, step, onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-zinc-300">{label}</span>
        <span className="text-xs text-zinc-400 tabular-nums">{value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-zinc-700 accent-purple-600"
      />
    </div>
  );
}

function FolderField({
  label, value, onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const handleBrowse = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false, title: `Select ${label.toLowerCase()}` });
    if (selected) onChange(selected as string);
  }, [label, onChange]);

  const displayPath = value || "(Default)";
  const shortPath = displayPath.length > 30 ? `...${displayPath.slice(-27)}` : displayPath;

  return (
    <div>
      <span className="text-sm text-zinc-300">{label}</span>
      <div className="flex items-center gap-2 mt-1">
        <span className="flex-1 text-xs text-zinc-500 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 truncate" title={value}>
          {shortPath}
        </span>
        <Button variant="ghost" className="shrink-0 text-xs px-2 py-1.5" onClick={handleBrowse}>
          Browse
        </Button>
      </div>
    </div>
  );
}

function ResetOnboardingButton() {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  const handleReset = useCallback(async () => {
    await resetOnboarding();
    setConfirming(false);
    setDone(true);
  }, []);

  if (done) {
    return <p className="text-xs text-green-400 py-2">Onboarding reset. Reconnect your phone to restart the wizard.</p>;
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 py-2">
        <span className="text-xs text-zinc-400">Are you sure?</span>
        <Button variant="danger" className="text-xs px-2 py-1" onClick={handleReset}>Yes, reset</Button>
        <Button variant="secondary" className="text-xs px-2 py-1" onClick={() => setConfirming(false)}>Cancel</Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <span className="text-sm text-zinc-300">Reset onboarding</span>
        <p className="text-xs text-zinc-500 mt-0.5">Show the setup wizard again</p>
      </div>
      <Button variant="secondary" className="text-xs px-3 py-1.5" onClick={() => setConfirming(true)}>Reset</Button>
    </div>
  );
}
