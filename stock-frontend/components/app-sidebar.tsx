"use client";

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

  return (
    <SidebarMenu>
      {visible.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
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

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();

  return (
    <Sidebar collapsible="offcanvas" {...props}>
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
                  <span className="block truncate text-[10px] font-medium tracking-wide text-sidebar-foreground/60">
                    Coffee stock · AI
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="gap-1 pt-1">
        <NavSection label="Insights" items={insightsNav} user={user} />
        <NavSection label="Operations" items={operationsNav} user={user} />
        <NavSection label="Finance" items={financeNav} user={user} />
        <NavSection label="Master data" items={masterNav} user={user} />
        <NavSection label="Administration" items={adminNav} user={user} />
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
