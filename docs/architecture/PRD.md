# Product Requirements Document (PRD): Grew Revenue Analytics

## 1. Executive Summary
Grew Revenue Analytics is a high-performance, real-time dashboard designed for executive-level monitoring of revenue velocity, SKU performance, and customer concentration. It provides a mission-critical "Command Center" for financial decision-making, emphasizing speed, data integrity, and sophisticated visual clarity.

## 2. Target Audience
*   **Executives (CXOs):** Need high-level cumulative views (MTD/QTD/YTD) and growth pacing.
*   **Sales Managers:** Need to track manager-specific performance and client-level drill-downs.
*   **Operations:** Need real-time visibility into SKU-level transaction velocity.

## 3. Core Features (Parity Mandate)
*   **Revenue Matrix:** A 12-month fiscal grid showing SKU-level performance across the financial year.
*   **Revenue Velocity Chart:** A dynamic, stacked SKU-segmented chart supporting Daily, Weekly, Monthly, and Quarterly views.
*   **Chronological Scrubbing:** Keyboard-based navigation (Left/Right arrows) for day-by-day historical reviews.
*   **Executive KPIs:** Real-time calculation of MTD, QTD, and YTD metrics with equivalent-day pacing (MoM, QoQ, YoY).
*   **Intelligence Board:** Statistical concentration models (HHI) and automated trend detection.
*   **Security Gateway:** Strict Supabase Auth/OTP with executive whitelist enforcement.

## 4. User Experience (UX) Standards
*   **Executive Slate Aesthetics:** Dark-mode, high-contrast UI with fractal noise overlays for visual texture.
*   **Kinetic Interactions:** Sub-100ms response times for all filters, achieved via background Web Workers.
*   **Hardware Tactility:** 3D-effect cards and buttons mirroring high-end hardware interfaces.

## 5. Success Metrics
*   **Performance:** All analytical re-computations must complete in <100ms.
*   **Integrity:** Zero mock data leakage; explicit failure if DB connection is lost.
*   **Accuracy:** 100% logic parity with the original monolithic spreadsheet-based engine.
*   **Financial Standard:** All currency amounts MUST be displayed in **Crores (₹ Cr)** with exactly **2 decimal places** (e.g., ₹ 1.25 Cr), adhering to the `en-IN` locale format.

