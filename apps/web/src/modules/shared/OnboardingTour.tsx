import React, { useState, useEffect, useCallback } from 'react';
import {
    Sparkles,
    ChevronRight,
    ChevronLeft,
    X,
    CheckCircle,
    Zap,
} from 'lucide-react';
import { useStore } from '../../store/useStore';

export interface TourStep {
    id: string;
    targetSelector: string;
    title: string;
    description: string;
    badge?: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    actionHint?: string;
}

export const TOUR_STEPS: TourStep[] = [
    {
        id: 'welcome',
        targetSelector: '#sidebar',
        title: 'Welcome to Grew Revenue Intelligence',
        description: 'Explore executive revenue pacing, realization analytics, governance KPIs, and predictive trends with complete data drilldowns.',
        badge: 'Step 1 of 6',
        position: 'right',
        actionHint: 'Your navigation command center lives in this left bar.'
    },
    {
        id: 'fy-shortcuts',
        targetSelector: '[data-tour="fy-shortcuts"]',
        title: 'Fiscal Period & Dynamic Date Range',
        description: 'Quickly toggle Fiscal Year targets (FY24, FY25, FY26) or filter custom date intervals with instant recalculation.',
        badge: 'Step 2 of 6',
        position: 'bottom',
        actionHint: 'Click any FY button to zoom into that fiscal year.'
    },
    {
        id: 'metric-selector',
        targetSelector: '[data-tour="metric-selector"]',
        title: 'Multi-Dimensional Metric Selector',
        description: 'Switch the entire revenue matrix between Gross Amount (₹), Megawatt Capacity (MW), and Sales Volume (Qty).',
        badge: 'Step 3 of 6',
        position: 'bottom',
        actionHint: 'Shortcut: Alt+A for Amount, Alt+M for MW, Alt+Q for Qty.'
    },
    {
        id: 'kpi-governance',
        targetSelector: '[data-tour="kpi-grid"]',
        title: 'KPI Governance Grid',
        description: 'Live MTD, QTD, and YTD performance vs budget with YoY pacing variances and automatic status flags.',
        badge: 'Step 4 of 6',
        position: 'bottom',
        actionHint: 'Click on any KPI card to isolate and inspect detailed trends.'
    },
    {
        id: 'velocity-matrix',
        targetSelector: '#w-master',
        title: 'Velocity & Matrix Projections',
        description: 'Visualize dispatch trajectories across Daily, Weekly, Monthly, or Quarterly intervals, or flip into tabular matrix mode.',
        badge: 'Step 5 of 6',
        position: 'top',
        actionHint: 'Toggle between Chart and Tabular Matrix using the top right icon.'
    },
    {
        id: 'executive-intelligence',
        targetSelector: '[data-tour="intelligence-btn"]',
        title: 'Intelligence Board & Executive Stories',
        description: 'Access algorithmic risk indicators, HHI customer concentrations, executive stories, and social commentary.',
        badge: 'Step 6 of 6',
        position: 'left',
        actionHint: 'Click to open the executive intelligence drawer anytime.'
    }
];

export const TOUR_STORAGE_KEY = 'grew_revenue_onboarding_completed_v1';
export const TOUR_STEP_KEY = 'grew_revenue_onboarding_step_v1';

export const OnboardingTour: React.FC<{ isOpen?: boolean; onClose?: () => void }> = () => {
    const { tourOpen, tourStep, setTourOpen, setTourStep } = useStore();
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const currentStep = TOUR_STEPS[tourStep] || TOUR_STEPS[0];
    const isLastStep = tourStep === TOUR_STEPS.length - 1;

    // Check first-time user status on initial mount
    useEffect(() => {
        const isCompleted = localStorage.getItem(TOUR_STORAGE_KEY);
        if (!isCompleted) {
            const savedStep = parseInt(localStorage.getItem(TOUR_STEP_KEY) || '0', 10);
            const timer = setTimeout(() => {
                setTourStep(savedStep < TOUR_STEPS.length ? savedStep : 0);
                setTourOpen(true);
            }, 1200);
            return () => clearTimeout(timer);
        }
    }, [setTourOpen, setTourStep]);

    // Measure target element position
    const updateTargetPosition = useCallback(() => {
        if (!tourOpen) return;

        const targetEl = document.querySelector(currentStep.targetSelector);
        if (targetEl) {
            const rect = targetEl.getBoundingClientRect();
            // Scroll target into view if outside viewport
            if (
                rect.top < 0 ||
                rect.bottom > window.innerHeight ||
                rect.left < 0 ||
                rect.right > window.innerWidth
            ) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
            setTargetRect(targetEl.getBoundingClientRect());
        } else {
            setTargetRect(null);
        }
    }, [currentStep.targetSelector, tourOpen]);

    useEffect(() => {
        if (!tourOpen) return;

        updateTargetPosition();
        const handleResize = () => updateTargetPosition();
        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', updateTargetPosition, true);

        const pollTimer = setInterval(updateTargetPosition, 350);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', updateTargetPosition, true);
            clearInterval(pollTimer);
        };
    }, [tourOpen, updateTargetPosition, tourStep]);

    const handleNext = () => {
        setIsTransitioning(true);
        if (isLastStep) {
            setTourOpen(false);
            localStorage.setItem(TOUR_STORAGE_KEY, 'true');
            localStorage.removeItem(TOUR_STEP_KEY);
        } else {
            const nextIdx = tourStep + 1;
            setTourStep(nextIdx);
            localStorage.setItem(TOUR_STEP_KEY, String(nextIdx));
        }
        setTimeout(() => setIsTransitioning(false), 200);
    };

    const handleBack = () => {
        if (tourStep > 0) {
            setIsTransitioning(true);
            const prevIdx = tourStep - 1;
            setTourStep(prevIdx);
            localStorage.setItem(TOUR_STEP_KEY, String(prevIdx));
            setTimeout(() => setIsTransitioning(false), 200);
        }
    };

    const handleSkip = () => {
        setTourOpen(false);
        localStorage.setItem(TOUR_STORAGE_KEY, 'true');
        localStorage.removeItem(TOUR_STEP_KEY);
    };

    if (!tourOpen) return null;

    // Compute Popover Position relative to target element
    const tooltipStyle = (() => {
        if (!targetRect) {
            return {
                position: 'fixed' as const,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 100000,
            };
        }

        const padding = 16;
        const popoverWidth = Math.min(380, window.innerWidth - 32);
        let top = targetRect.bottom + padding;
        let left = targetRect.left + (targetRect.width / 2) - (popoverWidth / 2);

        if (currentStep.position === 'top' && targetRect.top > 250) {
            top = targetRect.top - 230 - padding;
        } else if (currentStep.position === 'right' && targetRect.right + popoverWidth + padding < window.innerWidth) {
            top = Math.max(20, targetRect.top + (targetRect.height / 2) - 100);
            left = targetRect.right + padding;
        } else if (currentStep.position === 'left' && targetRect.left - popoverWidth - padding > 0) {
            top = Math.max(20, targetRect.top + (targetRect.height / 2) - 100);
            left = targetRect.left - popoverWidth - padding;
        }

        // Clamp boundaries to viewport
        left = Math.max(16, Math.min(left, window.innerWidth - popoverWidth - 16));
        top = Math.max(16, Math.min(top, window.innerHeight - 260));

        return {
            position: 'fixed' as const,
            top: `${top}px`,
            left: `${left}px`,
            width: `${popoverWidth}px`,
            zIndex: 100000,
        };
    })();

    return (
        <div className="fixed inset-0 z-[99990] select-none pointer-events-auto">
            {/* SVG Spotlight Mask */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none transition-all duration-300">
                <defs>
                    <mask id="tour-spotlight-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {targetRect && (
                            <rect
                                x={targetRect.left - 6}
                                y={targetRect.top - 6}
                                width={targetRect.width + 12}
                                height={targetRect.height + 12}
                                rx="16"
                                fill="black"
                            />
                        )}
                    </mask>
                </defs>
                <rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    fill="rgba(5, 7, 10, 0.75)"
                    mask="url(#tour-spotlight-mask)"
                />
            </svg>

            {/* Glowing Border Box around the target element */}
            {targetRect && (
                <div
                    className="fixed pointer-events-none rounded-2xl border-2 border-emerald-400/80 shadow-[0_0_25px_rgba(52,211,153,0.4)] transition-all duration-300 z-[99992]"
                    style={{
                        top: targetRect.top - 6,
                        left: targetRect.left - 6,
                        width: targetRect.width + 12,
                        height: targetRect.height + 12,
                    }}
                />
            )}

            {/* Floating Popover Card */}
            <div
                style={tooltipStyle}
                className={`bg-slate-900 border border-slate-700/80 text-slate-100 rounded-2xl shadow-2xl p-5 flex flex-col gap-3.5 backdrop-blur-xl transition-all duration-200 ${
                    isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                }`}
            >
                {/* Header with Step Badge & Dismiss Button */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                            <Sparkles className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                            {currentStep.badge}
                        </span>
                    </div>

                    <button
                        onClick={handleSkip}
                        className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Skip Tour"
                        aria-label="Skip Tour"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="space-y-1.5">
                    <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                        {currentStep.title}
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                        {currentStep.description}
                    </p>
                </div>

                {/* Action Hint */}
                {currentStep.actionHint && (
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2 text-[11px] text-sky-300">
                        <Zap className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="leading-tight">{currentStep.actionHint}</span>
                    </div>
                )}

                {/* Progress Bar & Footer Navigation */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    {/* Segmented Dots */}
                    <div className="flex items-center gap-1.5">
                        {TOUR_STEPS.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                    idx === tourStep
                                        ? 'w-5 bg-emerald-400'
                                        : idx < tourStep
                                        ? 'w-1.5 bg-emerald-600/70'
                                        : 'w-1.5 bg-slate-700'
                                }`}
                            />
                        ))}
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex items-center gap-2">
                        {tourStep > 0 && (
                            <button
                                onClick={handleBack}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-all"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" /> Back
                            </button>
                        )}

                        <button
                            onClick={handleNext}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all"
                        >
                            {isLastStep ? (
                                <>
                                    Complete Tour <CheckCircle className="w-3.5 h-3.5" />
                                </>
                            ) : (
                                <>
                                    Next <ChevronRight className="w-3.5 h-3.5" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
