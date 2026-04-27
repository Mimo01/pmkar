import { X } from 'lucide-react';
import { useConnectionStore } from './connectionStore';

export default function ProbeStatusBanner() {
  const probeStatus = useConnectionStore((s) => s.probeStatus);
  const probeError = useConnectionStore((s) => s.probeError);
  const probeEndpointUrl = useConnectionStore((s) => s.probeEndpointUrl);
  const probeStatusCode = useConnectionStore((s) => s.probeStatusCode);
  const probeBannerDismissed = useConnectionStore((s) => s.probeBannerDismissed);
  const dismissProbeBanner = useConnectionStore((s) => s.dismissProbeBanner);

  if (probeStatus !== 'failed' || probeBannerDismissed) {
    return null;
  }

  const detail = [
    probeEndpointUrl ? `Endpoint: ${probeEndpointUrl}` : null,
    probeStatusCode != null ? `HTTP ${probeStatusCode}` : null,
    probeError ?? null,
  ]
    .filter(Boolean)
    .join(' — ');

  return (
    <div
      className="relative mx-4 mt-3 rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3 pr-10"
      role="alert"
      data-testid="probe-status-banner"
    >
      <p className="text-sm text-red-400">Required-field detection unavailable on Cloud target.</p>
      <p className="text-xs text-brand-muted mt-1 break-all">{detail}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismissProbeBanner}
        className="absolute right-2 top-2 rounded p-1 text-brand-muted hover:bg-red-400/10"
        data-testid="probe-status-banner-dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
