import type { ConnectionMeta } from './types';

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-green-600 dark:text-green-400 flex-shrink-0"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

interface ConnectionSummaryCardProps {
  label: string;
  connection: ConnectionMeta;
}

function ConnectionSummaryCard({ label, connection }: ConnectionSummaryCardProps) {
  return (
    <div className="flex items-start gap-3 bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
      <CheckIcon />
      <div>
        <p className="text-sm font-semibold leading-normal text-slate-950 dark:text-slate-50">
          {label}
        </p>
        <p className="text-sm font-normal leading-normal text-slate-500 dark:text-slate-400">
          {connection.baseUrl}
        </p>
        <p className="text-sm font-normal leading-normal text-slate-950 dark:text-slate-50">
          {connection.username}
        </p>
      </div>
    </div>
  );
}

interface SummaryStepProps {
  serverConnection: ConnectionMeta;
  cloudConnection: ConnectionMeta;
  onDone: () => void;
}

export function SummaryStep({ serverConnection, cloudConnection, onDone }: SummaryStepProps) {
  return (
    <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6 space-y-4">
      <p className="text-sm font-normal leading-normal text-slate-500 dark:text-slate-400">
        Both connections are configured and verified.
      </p>

      <div className="space-y-3">
        <ConnectionSummaryCard
          label="Source (Customer Jira)"
          connection={serverConnection}
        />
        <ConnectionSummaryCard
          label="Destination (Company Jira)"
          connection={cloudConnection}
        />
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onDone}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md py-2 px-6 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
        >
          Done
        </button>
      </div>
    </div>
  );
}
