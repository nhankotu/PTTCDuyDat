# Finra Financial Dashboard — Design System (`MASTER.md`)

**Version**: 2.0 (Blue & White Left-Sidebar Redesign)
**Product**: Finra Financial Dashboard (PTTC Duy Đạt)
**Stack**: React 19 · TypeScript · Vite · Tailwind CSS v4 · Lucide React · Apache ECharts

---

## 1. Color Tokens

| Token Name | Hex Value | Tailwind / CSS Usage | Purpose |
| :--- | :--- | :--- | :--- |
| `--finra-canvas` | `#F5F8FC` | `bg-[#F5F8FC]` | Primary workspace canvas |
| `--finra-surface` | `#FFFFFF` | `bg-white` | Sidebar, cards, top bar, tables, modals |
| `--finra-surface-subtle` | `#F8FAFC` | `bg-slate-50` | Table headers, secondary tracks, input fills |
| `--finra-border` | `#E2E8F0` | `border-slate-200` | Default hairline dividers and card borders |
| `--finra-border-accent` | `#DBEAFE` | `border-blue-100` | Blue-tinted borders for active badges/cards |
| `--finra-primary` | `#1D4ED8` | `bg-[#1D4ED8]` / `text-[#1D4ED8]` | Primary CTA, active nav text/bar, key icons |
| `--finra-primary-hover` | `#1E40AF` | `hover:bg-[#1E40AF]` | Primary CTA hover & pressed state |
| `--finra-primary-bright` | `#2563EB` | `bg-blue-600` | Focus rings, chart primary bar top stop |
| `--finra-primary-tint` | `#EFF6FF` | `bg-[#EFF6FF]` | Active sidebar item, blue icon containers, filter chips |
| `--finra-navy` | `#0F294A` | `text-[#0F294A]` | Headings, KPI hero numbers, table emphasis |
| `--finra-text` | `#334155` | `text-slate-700` | Standard body text & table cells |
| `--finra-text-muted` | `#64748B` | `text-slate-500` | Subtitles, metadata, axis labels |
| `--finra-success` | `#059669` | `text-emerald-600` | Positive indicators, cleared status, as-of balance |
| `--finra-danger` | `#DC2626` | `text-red-600` | Validation errors, destructive actions, access denied |
| `--finra-warning` | `#B45309` | `text-amber-700` / `bg-amber-50` | Unapplied notice & Ghost contract (`isGhost`) highlight |

---

## 2. Typography & Scale

- **Primary Font**: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Numeric Figures**: `.tabular-nums` (`font-variant-numeric: tabular-nums`) on all monetary amounts, contract counts, KPI figures, pivot tables, and chart tooltips.
- **Type Scale**:
  - Page Title (TopContextBar): `16px–18px`, `font-bold`, `text-[#0F294A]`, tracking `-0.015em`
  - Section Title: `15px–16px`, `font-bold`, `text-[#0F294A]`
  - KPI Hero Value: `20px–22px`, `font-extrabold`, `tabular-nums`, `text-[#0F294A]`
  - Body / Table Cell: `13px–14px`, `font-normal`/`font-medium`, `text-slate-700`
  - Table Header / Micro Label: `11px–12px`, `font-semibold`, `text-slate-500`

---

## 3. Application Shell Architecture

```
+-------------------+----------------------------------------------------+
|  LEFT SIDEBAR     | TOP CONTEXT BAR (Sticky White, h-14)               |
|  White (#FFFFFF)  | [Menu] Page Title | [Date (T)] [Scope (S)] [F] [↻] |
|  252px / 72px     +----------------------------------------------------+
|                   |                                                    |
|  [F] Finra        |  MAIN WORKSPACE (#F5F8FC)                          |
|  Báo cáo KD       |  - Quick Smart Rules & Active Filter Chips         |
|                   |  - Active View Content (KPI / Trend / Table / ...) |
|  Báo cáo          |                                                    |
|  ▪ 7 Chỉ Số KPI   |                                                    |
|    Xu Hướng       |                                                    |
|    Tra Cứu HĐ     |                                                    |
|    Chứng Khoán    |                                                    |
|    Cây Nhân Sự    |                                                    |
|                   |                                                    |
|  Quản trị (Admin) |                                                    |
|    Người Dùng     |                                                    |
|    Phân Quyền     |                                                    |
|  [+ Import DL]    |                                                    |
|                   |                                                    |
|  ---------------  |                                                    |
|  User · Hướng dẫn |                                                    |
|  Đăng xuất        |                                                    |
+-------------------+----------------------------------------------------+
```

### Shell Rules
1. **Left Sidebar (`Sidebar.tsx`)**:
   - Expanded width `252px`, collapsed width `72px` (`lg:` desktop).
   - White background (`#FFFFFF`), `border-r border-slate-200/90`.
   - Active tab: `bg-[#EFF6FF] text-[#1D4ED8] font-semibold` with `w-1 bg-[#1D4ED8]` left accent strip.
   - Mobile (`< 1024px`): slide-over drawer with `bg-slate-900/35 backdrop-blur-[1px]` overlay.
2. **Top Context Bar (`TopContextBar.tsx`)**:
   - Replaces the old dark top header and dark bottom dock.
   - Displays current screen title, `asOfDate`, quick-trigger pills for Time (`T`), Scope (`S`), Full Filters (`F`), conditional `Áp dụng` CTA when pending edits exist, and `Làm mới`.
3. **Login Screen (`LoginPage.tsx`)**:
   - Split-screen (`lg:grid-cols-12`): left institutional Royal Blue brand column (`from-[#0F3D7A] via-[#1D4ED8] to-[#2563EB]`), right clean white form panel (`bg-white`).

---

## 4. Component Mapping

| Component | Redesign Scope |
| :--- | :--- |
| `index.css` & `index.html` | Tailwind v4 `@theme`, light scrollbar, `tabular-nums`, remove dark boilerplate |
| `Sidebar.tsx` *(new)* | Left white/blue navigation rail + mobile slide-over drawer |
| `TopContextBar.tsx` *(new)* | Sticky white workspace context bar with `T`/`S`/`F` filter pills |
| `App.tsx` | Left-sidebar layout shell, smart filter bar, light modals |
| `LoginPage.tsx` | Blue & White split-screen institutional login |
| `KpiCardsV1.tsx` | Unified Blue & White KPI cards (hero #1-#2 emphasized), Lucide icons, `tabular-nums` |
| `TrendAndPivotSection.tsx` | Blue-series ECharts theme + light tooltip + tabular pivot table |
| `UnifiedFilterScopePanel.tsx`, `ReportFilterPanel.tsx`, `SavedReportViews.tsx` | Blue & White scope/filter UI + Lucide icons |
| `ContractsTableV1.tsx` | High-density white ledger table, right-aligned numbers, amber ghost row preserved |
| `StocksSection.tsx`, `OrgTreeSection.tsx` | Blue & White cards, hierarchy badges, and tree/list controls |
| `UserManagement.tsx`, `PermissionsPage.tsx`, `ImportV2Modal.tsx` | Blue & White admin tables, preset cards, modals, and badges |
