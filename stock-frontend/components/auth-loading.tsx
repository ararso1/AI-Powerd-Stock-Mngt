/** Shared loading shell for auth — CSS-only spinner to avoid icon hydration issues. */
export function AuthLoading() {
  return (
    <div
      className="csolve-login-bg flex min-h-svh items-center justify-center"
      suppressHydrationWarning
    >
      <div
        className="size-8 animate-spin rounded-full border-2 border-[var(--csolve-caramel)]/40 border-t-[var(--csolve-roast)]"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
