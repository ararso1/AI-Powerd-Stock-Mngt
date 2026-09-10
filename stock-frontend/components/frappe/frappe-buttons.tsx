import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const frappePrimary =
  "h-8 rounded-md border-0 bg-[var(--frappe-primary)] px-3 text-xs font-medium text-[var(--primary-foreground)] shadow-sm hover:bg-[var(--frappe-primary-hover)]";

const frappeSecondary =
  "csolve-btn-secondary h-8 rounded-md border px-3 text-xs font-medium shadow-none";

const frappeGhost =
  "h-8 rounded-md border-0 bg-transparent px-3 text-xs font-medium text-[var(--frappe-text-muted)] shadow-none hover:bg-[var(--csolve-honey-soft)] hover:text-[var(--csolve-espresso)]";

export function FrappeButtonPrimary({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return <Button className={cn(frappePrimary, className)} {...props} />;
}

export function FrappeButtonSecondary({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="outline" className={cn(frappeSecondary, className)} {...props} />
  );
}

export function FrappeButtonLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button variant="outline" className={cn(frappeSecondary, className)} asChild>
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export function FrappeButtonGhost({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="ghost" className={cn(frappeGhost, className)} {...props} />
  );
}
