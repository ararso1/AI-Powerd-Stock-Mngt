"use client";

import { useEffect, useRef, type RefObject } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CsolveMark } from "@/components/brand/csolve-mark";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import {
  adminNav,
  financeNav,
  insightsNav,
  masterNav,
  operationsNav,
  type NavItem,
} from "@/lib/navigation";

function filterNav(
  items: NavItem[],
  user: ReturnType<typeof useAuth>["user"]
) {
  return items.filter((item) => {
    if (item.permission) return hasPermission(user, item.permission);
    if (item.permissions) return hasAnyPermission(user, item.permissions);
    return true;
  });
}

function isNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItems({
  items,
  user,
}: {
  items: NavItem[];
  user: ReturnType<typeof useAuth>["user"];
}) {
  const pathname = usePathname();
  const visible = filterNav(items, user);

  if (visible.length === 0) return null;

  // Prefer the most specific matching href when paths nest.
  const activeHref = visible
    .filter((item) => isNavActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <SidebarMenu>
      {visible.map((item) => {
        const Icon = item.icon;
        const active = item.href === activeHref;
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
              <Link href={item.href}>
                <Icon />
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function NavSection({
  label,
  items,
  user,
}: {
  label: string;
  items: NavItem[];
  user: ReturnType<typeof useAuth>["user"];
}) {
  const visible = filterNav(items, user);
  if (visible.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-sidebar-foreground/55">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <NavItems items={items} user={user} />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function useScrollActiveNavIntoView(
  contentRef: RefObject<HTMLDivElement | null>
) {
  const pathname = usePathname();
  const { openMobile, isMobile, state } = useSidebar();

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    if (isMobile && !openMobile) return;

    const frame = requestAnimationFrame(() => {
      const active = root.querySelector<HTMLElement>(
        '[data-sidebar="menu-button"][data-active="true"]'
      );
      active?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, openMobile, isMobile, state, contentRef]);
}

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();
  const contentRef = useRef<HTMLDivElement>(null);
  useScrollActiveNavIntoView(contentRef);

  return (
    <Sidebar collapsible="offcanvas" className="csolve-sidebar border-r-0" {...props}>
      <SidebarHeader className="border-b border-sidebar-border/80 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="h-auto gap-0 py-2 data-[slot=sidebar-menu-button]:p-2!"
            >
              <Link href="/dashboard" className="flex items-center gap-2.5">
                <CsolveMark size="sm" />
                <div className="min-w-0 leading-tight">
                  <span className="block text-base font-bold tracking-tight text-sidebar-foreground">
                    Csolve
                  </span>
                  <span className="block truncate text-[10px] font-medium tracking-wide text-sidebar-primary">
                    Coffee stock & sales
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent ref={contentRef} className="gap-1 pt-1">
        <NavSection label="Overview" items={insightsNav} user={user} />
        <NavSection label="Coffee & stock" items={operationsNav} user={user} />
        <NavSection label="Money" items={financeNav} user={user} />
        <NavSection label="Partners" items={masterNav} user={user} />
        <NavSection label="Admin" items={adminNav} user={user} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/80">
        {user ? (
          <NavUser
            user={{
              name: user.fullName,
              email: user.email,
              role: user.role.name,
            }}
          />
        ) : null}
      </SidebarFooter>
    </Sidebar>
  );
}
