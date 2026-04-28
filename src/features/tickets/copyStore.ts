import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { useConnectionStore } from '../connections/connectionStore';
import { useSchemaCacheStore, schemaCacheKey } from '@/stores/schemaCacheStore';
import type { FieldSchema } from '@/types/fieldSchema';
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

  // Phase 22 override state (D-11 / D-12 / D-13)
  targetIssueTypeId: string | null;
  overrideValues: Record<string, unknown>;
  resolvedTargetFields: FieldSchema[];

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

  // Phase 22 actions (D-11)
  setTargetIssueTypeId: (id: string) => Promise<void>;
  setResolvedTargetFields: (fields: FieldSchema[]) => void;
  setOverrideValue: (fieldId: string, v: unknown) => void;
  clearOverrides: () => void;
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
  // Phase 22 (D-11):
  targetIssueTypeId: null as string | null,
  overrideValues: {} as Record<string, unknown>,
  resolvedTargetFields: [] as FieldSchema[],
};

export const useCopyStore = create<CopyState>((set, get) => ({
  ...initialState,

  startPreview: async (ticket, _sourceBaseUrl, _cloudBaseUrl) => {
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
      const meta = await invoke<CloudMeta>('fetch_cloud_meta');

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

      // Phase 22: pre-warm + default issue-type selection (D-04, D-05)
      try {
        const projectKey = useConnectionStore.getState().targetProjectKey ?? '';
        if (projectKey) {
          const cacheStore = useSchemaCacheStore.getState();
          let prewarmed = cacheStore.prewarmedIssueTypes[projectKey] ?? [];
          if (prewarmed.length === 0) {
            await cacheStore.preWarm(projectKey);
            prewarmed = useSchemaCacheStore.getState().prewarmedIssueTypes[projectKey] ?? [];
          }
          if (prewarmed.length > 0) {
            const sourceTypeName = ticket.fields.issuetype?.name ?? '';
            const matched = sourceTypeName
              ? prewarmed.find(
                  (it) => it.name.toLowerCase() === sourceTypeName.toLowerCase(),
                )
              : null;
            const defaultTypeId = matched?.id ?? prewarmed[0]?.id ?? null;
            if (defaultTypeId) {
              await useSchemaCacheStore
                .getState()
                .loadSchema('target', projectKey, defaultTypeId);
              const entry =
                useSchemaCacheStore.getState().cache[
                  schemaCacheKey('target', projectKey, defaultTypeId)
                ];
              set({
                targetIssueTypeId: defaultTypeId,
                resolvedTargetFields: entry?.fields ?? [],
              });
            }
          }
        }
      } catch (innerErr) {
        // Schema pre-warm failures must NOT block the existing preview UX (graceful degradation D-04).
        console.error('[copyStore] issue-type pre-warm failed:', innerErr);
      }
    } catch (err) {
      console.error('[copyStore] fetch_cloud_meta failed:', err);
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

  setTargetIssueTypeId: async (id) => {
    if (!id) {
      set({ targetIssueTypeId: null, resolvedTargetFields: [] });
      return;
    }
    set({ targetIssueTypeId: id });
    const projectKey = get().targetProjectKey;
    if (!projectKey) return;
    await useSchemaCacheStore.getState().loadSchema('target', projectKey, id);
    const entry =
      useSchemaCacheStore.getState().cache[schemaCacheKey('target', projectKey, id)];
    set({ resolvedTargetFields: entry?.fields ?? [] });
  },

  setResolvedTargetFields: (fields) => set({ resolvedTargetFields: fields }),

  setOverrideValue: (fieldId, v) =>
    set({ overrideValues: { ...get().overrideValues, [fieldId]: v } }),

  clearOverrides: () =>
    set({ targetIssueTypeId: null, overrideValues: {}, resolvedTargetFields: [] }),

  confirmCopy: async (sourceBaseUrl, cloudBaseUrl) => {
    const state = get();
    if (!state.sourceKey || !state.cloudMeta) return;

    set({
      phase: 'copying',
      progressStep: 'Copying ticket with attachments, comments, and work log...',
    });

    try {
      const result = await invoke<CopyTicketResult>('copy_ticket_v2', {
        args: {
          sourceKey: state.sourceKey,
          sourceBaseUrl,
          targetBaseUrl: cloudBaseUrl,
          targetIssueTypeId: state.targetIssueTypeId ?? '',
          overrideValues: {
            summary: state.targetSummary,
            ...state.overrideValues,
          },
        },
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
