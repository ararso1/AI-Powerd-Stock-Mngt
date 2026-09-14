"use client";

import { AppShell } from "@/components/app-shell";
import { AiInsightsPanel } from "@/components/insights/ai-insights-panel";
import { PermissionGate } from "@/components/permission-gate";

export default function InsightsPage() {
  return (
    <AppShell
      title="AI Insights"
      subtitle="Stock trends, forecasts, and tips — confirm before acting"
      layout="default"
      breadcrumbs={[{ label: "Overview" }, { label: "AI advice" }]}
    >
      <PermissionGate
        permissions={["ai.read", "insights.read"]}
        fallback={
          <p className="text-muted-foreground">
            You do not have permission to view AI advice.
          </p>
        }
      >
        <AiInsightsPanel />
      </PermissionGate>
    </AppShell>
  );
}
