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
  MapPin,
  Truck,
  Users,
  Shield,
  UserCog,
  BarChart3,
  Layers,
  Workflow,
  Ship,
  Flame,
  Sparkles,
  LineChart,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  permissions?: string[];
}

/** Overview: dashboard, advice, reports */
export const insightsNav: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permissions: ["insights.read", "dashboard.read"],
  },
  {
    title: "AI advice",
    href: "/insights",
    icon: Sparkles,
    permissions: ["ai.read", "insights.read"],
  },
  {
    title: "Market prices",
    href: "/market-prices",
    icon: LineChart,
    permissions: ["market_prices.read", "insights.read", "dashboard.read"],
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
    permission: "reports.read",
  },
];

/** Day-to-day coffee stock & trading */
export const operationsNav: NavItem[] = [
  {
    title: "Coffee lots",
    href: "/lots",
    icon: Layers,
    permission: "lot.read",
  },
  {
    title: "Processing",
    href: "/process-runs",
    icon: Workflow,
    permission: "process.read",
  },
  {
    title: "Roast recipes",
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
    title: "Stock",
    href: "/inventory",
    icon: Package,
    permission: "inventory.read",
  },
  {
    title: "Move stock",
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
    title: "Outstanding",
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
    title: "Cash & bank",
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
