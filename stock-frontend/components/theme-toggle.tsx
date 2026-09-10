"use client";

import { useTheme } from "next-themes";
import { useIsClient } from "@/hooks/use-is-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  className,
  variant = "outline",
  size = "icon",
}: {
  className?: string;
  variant?: "outline" | "ghost";
  size?: "icon" | "sm";
}) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isClient = useIsClient();

  const Icon =
    !isClient || resolvedTheme === "dark"
      ? MoonIcon
      : resolvedTheme === "light"
        ? SunIcon
        : MonitorIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={cn("shrink-0", className)}
          aria-label="Toggle theme"
        >
          <Icon className="size-4" />
          {size === "sm" ? (
            <span className="sr-only sm:not-sr-only sm:ml-1">Theme</span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={theme ?? "system"}
          onValueChange={setTheme}
        >
          <DropdownMenuRadioItem value="light">
            <SunIcon className="size-4" />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <MoonIcon className="size-4" />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <MonitorIcon className="size-4" />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
