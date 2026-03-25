import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { useConnectionStore } from '../connections/connectionStore';
import type { CloudMeta, CopyPhase, CopyTicketResult, JiraTicketDetail } from './types';

interface CopyState {
  phase: CopyPhase;
  sourceTicket: JiraTicketDetail | null;
  sourceKey: string | null;

  // Target field values (editable in preview)
  targetSummary: string;
  targetDescription: string;
  targetStatus: string;
  targetPriorityId: string;
  targetLabels: string[];
  selectedLabels: string[];
  targetProjectKey: string;

  // Cloud metadata (populated from fetch_cloud_meta)
  cloudMeta: CloudMeta | null;

  // Copy result
  result: CopyTicketResult | null;
  error: string | null;

  // Progress step label
  progressStep: string;

  // Actions
  startPreview: (
    ticket: JiraTicketDetail,
    sourceBaseUrl: string,
    cloudBaseUrl: string,
  ) => Promise<void>;
  setTargetSummary: (summary: string) => void;
  setTargetDescription: (description: string) => void;
  setTargetStatus: (status: string) => void;
  setTargetPriorityId: (priorityId: string) => void;
  setTargetProjectKey: (key: string) => void;
  toggleLabel: (label: string) => void;
  confirmCopy: (sourceBaseUrl: string, cloudBaseUrl: string) => Promise<void>;
  reset: () => void;
}

const initialState = {
  phase: 'idle' as CopyPhase,
  sourceTicket: null,
  sourceKey: null,
  targetSummary: '',
  targetDescription: '',
  targetStatus: '',
  targetPriorityId: '',
  targetLabels: [],
  selectedLabels: [],
  targetProjectKey: '',
  cloudMeta: null,
  result: null,
  error: null,
  progressStep: '',
};

export const useCopyStore = create<CopyState>((set, get) => ({
  ...initialState,

  startPreview: async (ticket, _sourceBaseUrl, cloudBaseUrl) => {
    const savedTargetProjectKey = useConnectionStore.getState().targetProjectKey ?? '';
    set({
      phase: 'loading_preview',
      sourceTicket: ticket,
      sourceKey: ticket.key,
      targetSummary: ticket.fields.summary,
      targetDescription:
        typeof ticket.fields.description === 'string' ? ticket.fields.description : '',
      targetProjectKey: savedTargetProjectKey,
      error: null,
    });

    try {
      const meta = await invoke<CloudMeta>('fetch_cloud_meta', {
        baseUrl: cloudBaseUrl,
      });

      const labels = ticket.fields.labels || [];

      // Prefill status: map source status name to target if possible
      const sourceStatusName = ticket.fields.status.name;
      const matchedStatus = meta.availableStatuses.find(
        (s) => s.name.toLowerCase() === sourceStatusName.toLowerCase(),
      );
      const defaultStatus = matchedStatus?.name || meta.availableStatuses[0]?.name || '';

      // Prefill priority: map source priority name to target if possible
      const sourcePriorityName = ticket.fields.priority.name;
      const matchedPriority = meta.availablePriorities.find(
        (p) => p.name.toLowerCase() === sourcePriorityName.toLowerCase(),
      );
      const defaultPriorityId =
        matchedPriority?.id ||
        meta.availablePriorities.find((p) => p.name === 'Medium')?.id ||
        meta.availablePriorities[0]?.id ||
        '';

      set({
        phase: 'previewing',
        cloudMeta: meta,
        targetLabels: labels,
        selectedLabels: [...labels],
        targetStatus: defaultStatus,
        targetPriorityId: defaultPriorityId,
      });
    } catch (_err) {
      set({
        phase: 'idle',
        error: 'Could not load target fields. Check your destination connection in Settings.',
      });
    }
  },

  setTargetSummary: (summary) => set({ targetSummary: summary }),
  setTargetDescription: (description) => set({ targetDescription: description }),
  setTargetStatus: (status) => set({ targetStatus: status }),
  setTargetPriorityId: (priorityId) => set({ targetPriorityId: priorityId }),
  setTargetProjectKey: (key) => set({ targetProjectKey: key }),

  toggleLabel: (label) => {
    const current = get().selectedLabels;
    if (current.includes(label)) {
      set({ selectedLabels: current.filter((l) => l !== label) });
    } else {
      set({ selectedLabels: [...current, label] });
    }
  },

  confirmCopy: async (sourceBaseUrl, cloudBaseUrl) => {
    const state = get();
    if (!state.sourceKey || !state.cloudMeta) return;

    set({
      phase: 'copying',
      progressStep: 'Copying ticket with attachments, comments, and work log...',
    });

    try {
      const result = await invoke<CopyTicketResult>('copy_ticket', {
        sourceKey: state.sourceKey,
        sourceBaseUrl,
        targetBaseUrl: cloudBaseUrl,
        targetSummary: state.targetSummary,
        targetDescription: state.targetDescription || null,
        targetStatus: state.targetStatus,
        targetPriorityId: state.targetPriorityId,
        targetLabels: state.selectedLabels,
        currentAccountId: state.cloudMeta?.currentAccountId,
        targetProjectKey: state.targetProjectKey,
      });

      set({ phase: 'result', result, progressStep: '' });
    } catch (err) {
      set({
        phase: 'result',
        result: {
          targetKey: null,
          targetUrl: null,
          steps: [{ step: 'create_issue', success: false, detail: String(err) }],
        },
        progressStep: '',
      });
    }
  },

  reset: () => set(initialState),
}));
