import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";

/** Version declared in the Tauri config, or null until it is loaded. */
export function useAppVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion(null));
  }, []);

  return version;
}
