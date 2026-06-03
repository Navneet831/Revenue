import React from 'react';

/**
 * CUSTOM EXECUTIVE ICONOGRAPHY
 * Replicated from the original index.html monolithic application.
 */

export const SolarModuleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 540 540" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
            <linearGradient id="solarFrameGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff"/>
                <stop offset="40%" stopColor="#dce1e6"/>
                <stop offset="100%" stopColor="#9ba3ab"/>
            </linearGradient>
            <linearGradient id="solarCellGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#182e54"/>
                <stop offset="100%" stopColor="#0a1529"/>
            </linearGradient>
            <symbol id="solarCell_sym">
                <polygon points="12,1 88,1 99,12 99,88 88,99 12,99 1,88 1,12" fill="url(#solarCellGrad)" stroke="#223a63" strokeWidth="0.5"/>
                <line x1="20" y1="1" x2="20" y2="99" stroke="#ffffff" strokeWidth="1.2" opacity="0.45"/>
                <line x1="40" y1="1" x2="40" y2="99" stroke="#ffffff" strokeWidth="1.2" opacity="0.45"/>
                <line x1="60" y1="1" x2="60" y2="99" stroke="#ffffff" strokeWidth="1.2" opacity="0.45"/>
                <line x1="80" y1="1" x2="80" y2="99" stroke="#ffffff" strokeWidth="1.2" opacity="0.45"/>
            </symbol>
        </defs>
        <g id="solarModuleIcon_g">
            <polygon points="260,50 50,420 50,436 260,66" fill="#889098" />
            <polygon points="50,420 280,460 280,476 50,436" fill="#6c737a" />
            <g transform="matrix(0.5227, 0.0909, -0.2234, 0.3936, 260, 50)">
                <rect x="0" y="0" width="440" height="940" fill="url(#solarFrameGrad)" rx="4" ry="4" />
                <rect x="19" y="19" width="402" height="902" fill="#f8f9fa" />
                {[0, 100, 200, 300].map(x => [0, 100, 200, 300, 400, 500, 600, 700, 800].map(y => (
                    <use key={`${x}-${y}`} href="#solarCell_sym" x={x + 21} y={y + 21} />
                )))}
            </g>
        </g>
    </svg>
);

export const InternalIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={className}>
        <g fill="#11B994" stroke="#11B994">
            <path d="M 79.54 55.21 A 30 30 0 0 0 24.02 35" fill="none" strokeWidth="16" strokeLinecap="butt" />
            <circle cx="79.54" cy="55.21" r="8" stroke="none" />
            <path d="M -1 -20 L 30 0 L -1 20 Z" transform="translate(24.02, 35) rotate(120)" strokeWidth="5" strokeLinejoin="round" />
            <g transform="rotate(180 50 50)">
                <path d="M 79.54 55.21 A 30 30 0 0 0 24.02 35" fill="none" strokeWidth="16" strokeLinecap="butt" />
                <circle cx="79.54" cy="55.21" r="8" stroke="none" />
                <path d="M -1 -20 L 30 0 L -1 20 Z" transform="translate(24.02, 35) rotate(120)" strokeWidth="5" strokeLinejoin="round" />
            </g>
        </g>
    </svg>
);

export const RMIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className={className}>
        <g id="rocks-back">
            <path fill="#6B6B6B" stroke="#000000" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" d="M375,125 L430,160 L455,205 L115,205 L150,150 L200,120 Z"/>
        </g>
        <g id="rocks-front">
            <path fill="#888888" stroke="#000000" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" d="M125,205 L175,100 L240,90 L290,140 L380,110 L445,205 Z"/>
            <path stroke="#000000" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" d="M180,150 L240,110 L280,160 L380,145" fill="none"/>
            <circle cx="215" cy="130" r="4" fill="#000"/>
            <circle cx="270" cy="160" r="4" fill="#000"/>
            <circle cx="395" cy="140" r="4" fill="#000"/>
            <circle cx="150" cy="175" r="4" fill="#000"/>
        </g>
        <path fill="#444444" stroke="#000000" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" d="M120,205 L450,205 L460,215 L110,215 Z"/>
        <g id="cart-main-body">
            <path fill="#E09F1C" stroke="#000000" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" d="M110,215 L460,215 L440,380 L130,380 Z"/>
            <path fill="#F8B62B" d="M118,220 L452,220 L448,260 L122,260 Z" stroke="none"/>
            <path stroke="#000000" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" d="M118,255 L452,255" fill="none"/>
        </g>
        <g id="wheels">
            <circle fill="#888888" stroke="#000000" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" cx="130" cy="420" r="45"/>
            <circle fill="#888888" stroke="#000000" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" cx="420" cy="420" r="45"/>
        </g>
    </svg>
);

export const ScrapIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className}>
        <mask id="cutout_m" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
            <rect x="0" y="0" width="200" height="200" fill="white" />
            <g fill="black">
                <path id="recycle-arrow-def_p" d="M -13 -13 L -18 -18 A 26 26 0 0 1 13 -23 L 15 -26 L 25 -12 L 7 -10 L 9 -16 A 18 18 0 0 0 -13 -13 Z" transform="translate(100, 110)" />
                <use href="#recycle-arrow-def_p" transform="rotate(120, 100, 110)" />
                <use href="#recycle-arrow-def_p" transform="rotate(240, 100, 110)" />
            </g>
        </mask>
        <g fill="currentColor">
            <rect x="35" y="60" width="130" height="14" rx="4" />
            <path d="M 45 74 L 55 142 A 6 6 0 0 0 61 147 L 139 147 A 6 6 0 0 0 145 142 L 155 74 Z" mask="url(#cutout_m)" />
        </g>
    </svg>
);

export const IntelligenceBoardIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <line x1="50" y1="6" x2="50" y2="16" />
        <line x1="50" y1="6" x2="50" y2="16" transform="rotate(45 50 42)" />
        <line x1="50" y1="6" x2="50" y2="16" transform="rotate(90 50 42)" />
        <line x1="50" y1="6" x2="50" y2="16" transform="rotate(-45 50 42)" />
        <line x1="50" y1="6" x2="50" y2="16" transform="rotate(-90 50 42)" />
        <path d="M 40 64 C 40 54, 30 56, 30 42 A 20 20 0 1 1 70 42 C 70 56, 60 54, 60 64" />
        <path d="M 36 40 A 14 14 0 0 1 44 30" />
        <line x1="38" y1="71" x2="62" y2="73" />
        <line x1="36" y1="79" x2="64" y2="81" />
        <line x1="38" y1="87" x2="62" y2="89" />
        <path d="M 46 88 C 46 95, 54 95, 54 88.5" />
    </svg>
);
