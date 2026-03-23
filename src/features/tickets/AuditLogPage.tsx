interface AuditLogPageProps {
  onClose: () => void;
}

export function AuditLogPage({ onClose }: AuditLogPageProps) {
  return (
    <div className="flex-1 flex items-center justify-center text-brand-muted text-sm">
      <button type="button" onClick={onClose} className="underline">Close audit log placeholder</button>
    </div>
  );
}
