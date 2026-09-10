export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--csolve-border)] bg-[var(--csolve-parchment)] py-16 text-center">
      <div
        className="mb-3 size-10 rounded-full bg-[var(--csolve-section)] ring-1 ring-[var(--csolve-border)]"
        aria-hidden
      />
      <p className="text-sm font-medium text-[var(--csolve-text)]">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-xs text-[var(--csolve-text-muted)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}
