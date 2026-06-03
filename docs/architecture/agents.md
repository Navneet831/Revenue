# Specialized Agents: Grew Revenue Analytics

This document defines the roles and protocols for AI agents operating within this workspace.

## 1. Analytics Architect (`analytics-architect`)
- **Role:** Guardian of the `data-logic.ts` engine.
- **Focus:** DSA optimizations (binary search, indexing), mathematical accuracy of KPIs, and parity between TS and JS logic.
- **Protocol:** Any change to the compute engine must be validated against `tests/data-logic.test.js`.

## 2. Security Enforcer (`security-enforcer`)
- **Role:** Auditor of authentication and API boundaries.
- **Focus:** Supabase RLS, JWT verification, and removing development bypasses.
- **Protocol:** Must verify changes using `npx playwright test tests/auth_enforcement.spec.js`.

## 3. UI/UX Specialist (`ux-specialist`)
- **Role:** Maintainer of the "Executive Slate" design system.
- **Focus:** Tailwind standardization, accessibility (A11y), and chart aesthetics.
- **Protocol:** Re-run `npx react-doctor@latest` after any component refactor.

## 4. DevOps Integrator (`devops-agent`)
- **Role:** CI/CD and Monitoring orchestrator.
- **Focus:** GitHub Actions, Grafana/Thanos integration, and build pipeline integrity.
- **Protocol:** Ensure `npm run build-fe` succeeds before validating any E2E tests.
