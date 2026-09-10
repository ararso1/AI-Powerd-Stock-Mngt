import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  ShoppingCart,
  Receipt,
  CreditCard,
  Wallet,
  Landmark,
  TrendingUp,
  MapPin,
  Truck,
  Users,
  Shield,
  UserCog,
  BarChart3,
  ClipboardList,
  Factory,
  Layers,
  Scale,
  Workflow,
  Ship,
  Flame,
  Sparkles,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  permissions?: string[];
}

/** Real-time pulse & decision-support surfaces */
export const insightsNav: NavItem[] = [
  {
    title: "Command Center",
    href: "/dashboard",
    icon: LayoutDashboard,
    permissions: ["insights.read", "dashboard.read"],
  },
  {
    title: "AI Insights",
    href: "/insights",
    icon: Sparkles,
    permissions: ["ai.read", "insights.read"],
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
    permission: "reports.read",
  },
  {
    title: "Profit & Loss",
    href: "/profit-loss",
    icon: TrendingUp,
    permission: "profit_loss.read",
  },
];

/** Day-to-day stock & trading */
export const operationsNav: NavItem[] = [
  {
    title: "Lots",
    href: "/lots",
    icon: Layers,
    permission: "lot.read",
  },
  {
    title: "Collection",
    href: "/collections",
    icon: Scale,
    permission: "collection.read",
  },
  {
    title: "Processing",
    href: "/process-runs",
    icon: Workflow,
    permission: "process.read",
  },
  {
    title: "Roast profiles",
    href: "/roast-profiles",
    icon: Flame,
    permission: "process.read",
  },
  {
    title: "Exports",
    href: "/exports",
    icon: Ship,
    permission: "export.read",
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: Package,
    permission: "inventory.read",
  },
  {
    title: "BOMs",
    href: "/boms",
    icon: ClipboardList,
    permission: "bom.read",
  },
  {
    title: "Production",
    href: "/production-orders",
    icon: Factory,
    permission: "production.read",
  },
  {
    title: "Stock Transfers",
    href: "/stock-transfers",
    icon: ArrowLeftRight,
    permission: "stock_transfer.read",
  },
  {
    title: "Purchases",
    href: "/purchases",
    icon: ShoppingCart,
    permission: "purchase.read",
  },
  {
    title: "Sales",
    href: "/sales",
    icon: Receipt,
    permission: "sales.read",
  },
];

/** Cash, credit, banking */
export const financeNav: NavItem[] = [
  {
    title: "Credits",
    href: "/credits",
    icon: CreditCard,
    permission: "credit.read",
  },
  {
    title: "Expenses",
    href: "/expenses",
    icon: Wallet,
    permission: "expense.read",
  },
  {
    title: "Bank",
    href: "/banks",
    icon: Landmark,
    permission: "bank.read",
  },
];

export const masterNav: NavItem[] = [
  {
    title: "Locations",
    href: "/locations",
    icon: MapPin,
    permission: "locations.read",
  },
  {
    title: "Suppliers",
    href: "/suppliers",
    icon: Truck,
    permission: "suppliers.read",
  },
  {
    title: "Customers",
    href: "/customers",
    icon: Users,
    permission: "customers.read",
  },
];

export const adminNav: NavItem[] = [
  {
    title: "Users",
    href: "/users",
    icon: UserCog,
    permissions: ["users.read", "users.write"],
  },
  {
    title: "Roles",
    href: "/roles",
    icon: Shield,
    permissions: ["roles.read", "roles.write"],
  },
];

/** @deprecated Use insightsNav + operationsNav + financeNav */
export const mainNav: NavItem[] = [
  ...insightsNav.slice(0, 1),
  ...operationsNav,
  ...financeNav,
  ...insightsNav.slice(1),
];
