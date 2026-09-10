"use client";

import { AppShell } from "@/components/app-shell";
import { AiInsightsPanel } from "@/components/insights/ai-insights-panel";
import { PermissionGate } from "@/components/permission-gate";

export default function InsightsPage() {
  return (
    <AppShell
      title="AI Insights"
      subtitle="Forecast, readiness, quality, blend & pricing — confirm before acting"
      layout="default"
      breadcrumbs={[{ label: "Insights" }, { label: "AI Insights" }]}
    >
      <PermissionGate
        permissions={["ai.read", "insights.read"]}
        fallback={
          <p className="text-muted-foreground">
            You do not have permission to view AI insights.
          </p>
        }
      >
        <AiInsightsPanel />
      </PermissionGate>
    </AppShell>
  );
}
