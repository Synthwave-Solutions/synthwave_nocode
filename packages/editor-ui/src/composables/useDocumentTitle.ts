import { useSettingsStore } from '@/stores/settings.store';

const DEFAULT_TITLE = 'Workflow Automation';

export function useDocumentTitle() {
  const settingsStore = useSettingsStore();
  const { releaseChannel } = settingsStore.settings;
  const suffix =
    !releaseChannel || releaseChannel === 'stable' ? 'n8n' : `n8n[${releaseChannel.toUpperCase()}]`;

  const titleSet = (workflow: string, status: WorkflowTitleStatus) => {
    const icon = status === 'EXECUTING' ? '⚡' : '';
    window.document.title = `SynthStream - ${icon} ${workflow}`;
  };

  const titleReset = () => {
    document.title = 'SynthStream - Workflow Automation';
  };

  return { titleSet, titleReset };
}
