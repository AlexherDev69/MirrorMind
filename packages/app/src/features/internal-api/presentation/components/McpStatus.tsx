import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Modal, Button, Icon } from "../../../../core/components";

type McpState = "loading" | "not-installed" | "installed";

export function McpStatus() {
  const [mcpState, setMcpState] = useState<McpState>("loading");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    invoke<boolean>("check_mcp_installed")
      .then((installed) => setMcpState(installed ? "installed" : "not-installed"))
      .catch(() => setMcpState("not-installed"));
  }, []);

  if (mcpState === "loading") return null;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-purple-950/50 hover:bg-purple-900/50 border border-purple-800/30 transition-colors"
        aria-label="MCP settings"
      >
        <div className={`w-2 h-2 rounded-full bg-purple-500 ${mcpState === "not-installed" ? "animate-pulse" : ""}`} />
        <span className="text-purple-300">
          {mcpState === "installed" ? "MCP Active" : "Setup MCP"}
        </span>
      </button>

      {showModal && (
        <McpSetupModal
          onClose={() => setShowModal(false)}
          onInstalled={() => setMcpState("installed")}
        />
      )}
    </>
  );
}

interface McpSetupModalProps {
  readonly onClose: () => void;
  readonly onInstalled: () => void;
}

function McpSetupModal({ onClose, onInstalled }: McpSetupModalProps) {
  const [installState, setInstallState] = useState<"idle" | "installing" | "installed" | "error">("idle");
  const [settingsPath, setSettingsPath] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [configuredProjects, setConfiguredProjects] = useState<string[]>([]);
  const [mcpToken, setMcpToken] = useState("");
  const [tokenCopied, setTokenCopied] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const projects = await invoke<string[]>("get_configured_projects");
      setConfiguredProjects(projects);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadProjects();
    invoke<string>("get_mcp_token").then(setMcpToken).catch(() => setMcpToken(""));
  }, [loadProjects]);

  const handleCopyToken = useCallback(async () => {
    await navigator.clipboard.writeText(mcpToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  }, [mcpToken]);

  const handleSelectAndInstall = useCallback(async () => {
    const selectedPath = await open({ directory: true, multiple: false, title: "Select a project folder" });
    if (!selectedPath) return;

    setInstallState("installing");
    try {
      const path = await invoke<string>("setup_mcp_for_project", { projectPath: selectedPath });
      setSettingsPath(path);
      setInstallState("installed");
      onInstalled();
      await loadProjects();
    } catch (err) {
      setErrorMsg(String(err));
      setInstallState("error");
    }
  }, [onInstalled, loadProjects]);

  const handleRemoveProject = useCallback(async (projectPath: string) => {
    try {
      await invoke("remove_configured_project", { projectPath });
      await loadProjects();
      const projects = await invoke<string[]>("get_configured_projects");
      if (projects.length === 0) setInstallState("idle");
    } catch { /* ignore */ }
  }, [loadProjects]);

  const tokenSection = mcpToken ? (
    <div className="px-6 py-3 border-t border-zinc-800">
      <p className="text-xs font-medium text-zinc-500 mb-1.5">Auth Token</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs text-zinc-400 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 truncate select-all font-mono">
          {mcpToken}
        </code>
        <Button variant="ghost" className="shrink-0 text-xs px-2 py-1.5" onClick={handleCopyToken}>
          {tokenCopied ? "Copied!" : "Copy"}
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <Modal
      title="MirrorMind MCP"
      onClose={onClose}
      footer={
        <div>
          {tokenSection}
          <Button variant="secondary" fullWidth onClick={onClose}>Close</Button>
        </div>
      }
    >
      {installState === "idle" && (
        <IdleView onSelectFolder={handleSelectAndInstall} configuredProjects={configuredProjects} onRemoveProject={handleRemoveProject} />
      )}
      {installState === "installing" && <InstallingView />}
      {installState === "installed" && (
        <InstalledView settingsPath={settingsPath} onAddAnother={handleSelectAndInstall} configuredProjects={configuredProjects} onRemoveProject={handleRemoveProject} />
      )}
      {installState === "error" && <ErrorView error={errorMsg} onRetry={handleSelectAndInstall} />}
    </Modal>
  );
}

// ── Sub-views ────────────────────────────────────────────────────

function IdleView({ onSelectFolder, configuredProjects, onRemoveProject }: {
  readonly onSelectFolder: () => void;
  readonly configuredProjects: string[];
  readonly onRemoveProject: (path: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400 text-center">Let Claude Code see and control your phone screen.</p>
      <Button variant="primary" fullWidth onClick={onSelectFolder}>Select a project folder</Button>
      <p className="text-xs text-zinc-600 text-center">
        This will add the MCP config to <code className="text-zinc-500">.claude/settings.local.json</code> in your project.
      </p>
      {configuredProjects.length > 0 && <ProjectList projects={configuredProjects} onRemove={onRemoveProject} />}
    </div>
  );
}

function InstallingView() {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <Icon name="spinner" className="w-6 h-6 text-purple-500" />
      <p className="text-sm text-zinc-400">Installing...</p>
    </div>
  );
}

function InstalledView({ settingsPath, onAddAnother, configuredProjects, onRemoveProject }: {
  readonly settingsPath: string;
  readonly onAddAnother: () => void;
  readonly configuredProjects: string[];
  readonly onRemoveProject: (path: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-green-950 flex items-center justify-center">
          <Icon name="check" className="w-6 h-6 text-green-400" />
        </div>
        <p className="text-sm font-medium text-green-400 mt-2">Installed!</p>
        <p className="text-xs text-zinc-500 mt-1 break-all">{settingsPath}</p>
      </div>
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-center">
        <p className="text-sm text-zinc-300 font-medium">Now restart Claude Code in that project</p>
        <p className="text-xs text-zinc-500 mt-1">The MirrorMind tools will appear automatically.</p>
      </div>
      <Button variant="secondary" fullWidth onClick={onAddAnother}>Add another project</Button>
      {configuredProjects.length > 0 && <ProjectList projects={configuredProjects} onRemove={onRemoveProject} />}
    </div>
  );
}

function ErrorView({ error, onRetry }: { readonly error: string; readonly onRetry: () => void }) {
  return (
    <div className="space-y-4 text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-red-950 flex items-center justify-center">
        <Icon name="close" className="w-6 h-6 text-red-400" />
      </div>
      <p className="text-sm font-medium text-red-400">Install failed</p>
      <p className="text-xs text-zinc-500">{error}</p>
      <Button variant="secondary" fullWidth onClick={onRetry}>Try again</Button>
    </div>
  );
}

function ProjectList({ projects, onRemove }: { readonly projects: string[]; readonly onRemove: (path: string) => void }) {
  return (
    <div className="border-t border-zinc-800 pt-3">
      <p className="text-xs font-medium text-zinc-500 mb-2">Configured projects ({projects.length})</p>
      <div className="space-y-1.5">
        {projects.map((project) => (
          <div key={project} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800">
            <p className="text-xs text-zinc-400 truncate flex-1" title={project}>{project}</p>
            <button onClick={() => onRemove(project)} className="text-zinc-600 hover:text-red-400 transition-colors text-xs shrink-0" title="Remove" aria-label="Remove project">
              <Icon name="close" className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
