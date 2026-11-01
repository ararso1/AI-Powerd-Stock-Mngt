# Reporting Module Implementation Plan

Status: implemented (Phases 0–3).

## Goals

Modernize the Reporting Module with full module coverage, a hub + detail UI, and CSV + PDF export for every report.

## Current gaps addressed

- No CSV/PDF on Reports
- Crowded 13-tab UI
- Missing ops reports (lots, collections, process, transfers, exports, banks, approvals, HR, market)
- Summary vs P&L COGS mismatch
- Aging/credits date filters

## UX

- Hub at `/reports` with category cards
- Detail at `/reports/[reportId]` with filters, KPIs, table, Export CSV/PDF
- Legacy `?tab=` aliases redirected to new report IDs

## Export

- Server-side CSV (UTF-8 BOM) and branded PDF
- Shared query layer for JSON and exports
- Permission: `reports.read`

## Phases

0. Hub UI + export for existing finance reports  
1. Inventory, transfers, lots, collections, process  
2. Exports, banks, approvals  
3. HR, market snapshot, polish, docs  
