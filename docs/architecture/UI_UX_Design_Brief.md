# UI/UX Design Brief: Executive Slate

## 1. Visual Language
The interface follows the **"Executive Slate"** standard—a design language intended for high-stakes financial environments. It emphasizes density, clarity, and hardware-inspired tactility.

*   **Color Palette:**
    *   `Base`: #0b101e (Deep Navy Slate)
    *   `Card`: #111620 (Dark Charcoal)
    *   `Brand`: #10b981 (Emerald Matrix Green)
    *   `Accent`: #0ea5e9 (Cyan Sky), #FFC000 (Amber Insight)
*   **Typography:** Inter (Sans-serif) for high legibility; JetBrains Mono (Monospace) for financial figures and tabular data.

## 2. Key Visual Components
*   **The Matrix Pattern:** A quantitative background grid (`bg-grid-pattern`) used to create a sense of mathematical precision.
*   **Fractal Noise Overlay:** A custom SVG noise filter applied to charts and cards to provide a "premium hardware" texture, reducing flat-screen digital fatigue.
*   **3D Tactility:** Cards and buttons use precision gradients (160deg/145deg) and subtle inner shadows to simulate high-end tactile hardware controls.
*   **Kinetic Hover States:** Every interactive element provides immediate, glow-based feedback (emerald/amber) to confirm the system's "live" response.

## 3. Interaction Design
*   **Sub-100ms Mandate:** The UI must feel instantaneous. All heavy data transformations occur on background threads to ensure the main UI thread remains fluid.
*   **Keyboard-First Navigation:** For power users (Executives), the system is fully controllable via shortcuts (F1, Arrows, Alt-key combinations), enabling fast "scrubbing" through months and years of data.
*   **Glass Tooltips:** Contextual information is delivered via high-fidelity, backdrop-blurred tooltips that follow the mouse precisely.

## 4. Design Parity Rules
*   **Grid Consistency:** Must strictly adhere to the 12x12 grid system. No arbitrary component widths are allowed.
*   **SVG Integrity:** Always use the custom hand-crafted SVGs for Solar, Internal, and RM segments rather than generic library icons.
*   **Dark-Mode Absolute:** The system is exclusively dark-mode to reduce eye strain during extended analytical review sessions.
