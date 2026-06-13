# Implementation Plan: UI Enhancements and Bug Fixes

## Phase 1: Environment & Dependencies
1. **Agentation Package:**
   - Execute `npm install agentation` to restore the missing dependency.

## Phase 2: AppFooter Updates
1. **File:** `apps/web/src/modules/shared/AppFooter.tsx`
2. **Changes:**
   - Replace the left text with "Last Update: {formattedDate}" where `{formattedDate}` is derived from the `latestDate` in the store (representing the most recent invoice date).
   - Replace the right text with a static "© Grew Energy Private Limited", removing the easter egg animation to match the requested minimalistic style.

## Phase 3: FY Shortcuts Validation & Testing
1. **Files:** `apps/web/src/modules/shared/Header/FYShortcuts.tsx`, `tests/e2e/fy_dynamic.spec.js` (new)
2. **Changes:**
   - Verify `FYShortcuts` is using `allYears` from the store (which is dynamically populated based on the invoice dates in `RevenueDashboard.tsx`).
   - Create a new Playwright E2E test `fy_dynamic.spec.js` to ensure the rendered FY shortcuts match the expected dynamic values derived from the dataset, ensuring no hardcoding.

## Phase 4: Minimalism & Light Theme Conversion
1. **Files:** `apps/web/index.html`, `apps/web/src/App.tsx`, `apps/web/src/modules/auth/AuthLayer.tsx`, `apps/web/src/modules/auth/AuthLayer/components/*`
2. **Changes:**
   - Remove `StarfieldCanvas` and wobble effects from `AuthLayer`.
   - Simplify the `AuthCard` to remove heavy backdrop blur and glassmorphism in favor of a clean, flat design.
   - Update `index.html` body classes from `bg-[#0b101e] text-slate-400` to `bg-white text-slate-900`.
   - Update major container backgrounds (e.g., `bg-[#111620]`, `bg-[#0F1219]`) across the application to light theme equivalents (`bg-slate-50`, `bg-white`).
   - Update typography to be darker for readability on white backgrounds.

## Phase 5: Sidebar Layout Adjustments
1. **File:** `apps/web/src/modules/shared/GlobalSidebar.tsx`
2. **Changes:**
   - Compress the primary (first) sidebar by reducing its width from `w-16` to `w-14` or `w-12`.
   - Move the Logout button (`<LogOut />`) from the secondary sidebar's bottom section into the primary sidebar's bottom section.
   - Apply light theme colors to the sidebar borders and backgrounds.

## Phase 6: KPI Tooltips
1. **File:** `apps/web/src/modules/revenue/KpiCard.tsx`
2. **Changes:**
   - Add a `title` attribute to the main metric value element (`<span>`) that dynamically describes the logic (e.g., "Sum of Values" or "Calculated Metric based on filters") so users can hover to see the derivation logic.

## Phase 7: Revenue Matrix Header Fix & Testing
1. **Files:** `apps/web/src/modules/revenue/RevenueMatrix.tsx`, `tests/e2e/improvements.spec.js`
2. **Changes:**
   - Ensure the `<thead>` and its `<th>` elements have the correct sticky classes (`sticky top-0`, `z-40`, etc.) and background colors so they remain fixed and opaque when scrolling through the months/rows.
   - Add a test case to `improvements.spec.js` or create a new test file to verify that the Matrix table headers are visible and correctly sticky.