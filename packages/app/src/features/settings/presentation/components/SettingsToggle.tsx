import { useState } from "react";
import { SettingsModal } from "./SettingsModal";
import { Icon } from "../../../../core/components";

export function SettingsToggle() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center justify-center w-7 h-7 rounded hover:bg-zinc-800 transition-colors group"
        title="Settings"
        aria-label="Settings"
      >
        <Icon name="settings" className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200" />
      </button>

      {showModal && <SettingsModal onClose={() => setShowModal(false)} />}
    </>
  );
}
