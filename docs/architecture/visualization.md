# Codebase Visualisation Guide

To maintain a "senior engineer" level of oversight on this modular system, we recommend the following tools for visualisation and architectural auditing.

## 1. Dependency Mapping
*   **Dependency Cruiser:** (Highly Recommended) Visualises the real-time dependencies between `apps/`, `packages/`, and `modules/`.
    *   *Usage:* `npx depcruise src --output-type dot | dot -T svg > docs/architecture/dependency-graph.svg`
*   **Madge:** Generates visual dependency graphs from your JavaScript/TypeScript files.
    *   *Usage:* `npx madge --image docs/architecture/graph.png src`

## 2. Structural Exploration
*   **Sourcegraph:** Essential for "Palantir-level" cross-repo code exploration and relationship mapping.
*   **Github Graph:** Use the "Insights" > "Code frequency" and "Network" tabs on GitHub to see how the modular structure evolves over time.

## 3. Frontend Optimisation
*   **Vite Bundle Visualizer:** Essential for monitoring the size and dependencies of the `@revenue/web` app.
    *   *Usage:* `npm run build -w apps/web -- --visualizer`
*   **React Scan:** Visualises component re-renders to ensure the sub-100ms performance mandate is met.

## 4. Manual Architectural Diagrams
*   **Mermaid.js:** Integrated into GitHub Markdown. Use it in `docs/architecture/*.md` to define sequences and class diagrams.
*   **Excalidraw:** For high-level, hand-drawn architectural sketches during the "Plan" phase.

---

### Should we do this?
**Yes.** As a system grows beyond 10,000 lines, visualising the "Cascade" (the flow of data from Repo -> Service -> Controller -> UI) becomes the only way to catch **Circular Dependencies** and **Architectural Drift**.
