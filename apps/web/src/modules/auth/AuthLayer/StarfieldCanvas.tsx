import React, { useEffect, useRef } from 'react';

export const StarfieldCanvas: React.FC = () => {
    const spaceCanvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = spaceCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let mouse = { x: 0, y: 0 };
        const onMouseMove = (e: MouseEvent) => {
            mouse = {
                x: (e.clientX - window.innerWidth / 2) / 50,
                y: (e.clientY - window.innerHeight / 2) / 50
            };
        };
        window.addEventListener('mousemove', onMouseMove);

        const resize = () => {
            if (canvas) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
        };
        window.addEventListener('resize', resize);
        resize();

        const stars = Array.from({ length: 150 }).map(() => ({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            size: Math.random() * 1.5,
            alpha: Math.random(),
            fs: Math.random() * 0.02 + 0.005
        }));

        let animationFrameId: number;
        const anim = () => {
            if (!canvas || !ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            stars.forEach((s) => {
                const x = (s.x + mouse.x * s.size) % canvas.width;
                const y = (s.y + mouse.y * s.size) % canvas.height;
                s.alpha += s.fs;
                if (s.alpha > 1 || s.alpha < 0) s.fs *= -1;
                ctx.beginPath();
                ctx.arc(x < 0 ? x + canvas.width : x, y < 0 ? y + canvas.height : y, s.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, Math.min(1, s.alpha))})`;
                ctx.fill();
            });
            animationFrameId = requestAnimationFrame(anim);
        };
        anim();

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return <canvas ref={spaceCanvasRef} className="absolute inset-0 z-0 bg-[#05070A] pointer-events-none" />;
};
