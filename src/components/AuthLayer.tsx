import React, { useEffect, useRef, useState } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Mail, ShieldCheck, ShieldAlert, ArrowRight, User } from 'lucide-react';
import { useStore } from '../store/useStore';

interface AuthLayerProps {
    onAuthenticated: (email: string) => void;
    isHidden?: boolean;
}

export const AuthLayer: React.FC<AuthLayerProps> = ({ onAuthenticated, isHidden }) => {
    const { setUserEmail } = useStore();
    const [email, setEmail] = useState('');
    const [otpMode, setOtpMode] = useState(false);
    const [otpDigits, setOtpDigits] = useState<string[]>(Array(8).fill(''));
    const [loading, setLoading] = useState(false);
    const [showUI, setShowUI] = useState(false);
    const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const spaceCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const wobbleWrapperRef = useRef<HTMLDivElement | null>(null);
    const glassCardRef = useRef<HTMLDivElement | null>(null);
    const typewriterRef = useRef<HTMLSpanElement | null>(null);
    const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);

    // Bypass & Supabase Init Hook
    useEffect(() => {
        const queryParams = new URLSearchParams(window.location.search);
        const bypass = queryParams.get('bypass_auth') === 'true' || (window as any).__playwright_test__;

        if (bypass) {
            console.log('[Auth] Bypassing auth credentials for development/testing.');
            setUserEmail('tester@grew.power');
            onAuthenticated('tester@grew.power');
            return;
        }

        // Initialize Supabase
        const initSupabase = async () => {
            const timeout = setTimeout(() => {
                if (!showUI && !isHidden) {
                    console.warn('[AUTH] Handshake taking too long, forcing UI.');
                    setShowUI(true);
                }
            }, 4000);

            try {
                const configRes = await fetch('/api/v1/config');
                if (!configRes.ok) {
                    const errData = await configRes.json().catch(() => ({}));
                    throw new Error(errData.error || 'Security handshake failed.');
                }
                const { SUPABASE_URL, SUPABASE_ANON_KEY } = await configRes.json();

                if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Security credentials missing.');

                const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                setSupabaseClient(client);

                const { data: { session }, error: sessionError } = await client.auth.getSession();
                clearTimeout(timeout);

                if (sessionError) throw sessionError;

                if (session) {
                    await verifyWhitelist(client, session.user?.email || '');
                } else {
                    setShowUI(true);
                }

                client.auth.onAuthStateChange(async (event, newSession) => {
                    if (newSession && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
                        await verifyWhitelist(client, newSession.user?.email || '');
                    } else if (event === 'SIGNED_OUT') {
                        setShowUI(true);
                        setOtpMode(false);
                        setOtpDigits(Array(8).fill(''));
                    }
                });
            } catch (err: any) {
                clearTimeout(timeout);
                console.error('[AUTH ENGINE] Initialization Failure:', err);
                setNotification({ text: err.message || 'Critical Boot Error. Check Matrix Connection.', type: 'error' });
                setShowUI(true);
            }
        };

        initSupabase();
    }, []);

    // Whitelist Verification
    const verifyWhitelist = async (client: SupabaseClient, emailAddress: string) => {
        const cleanEmail = emailAddress.trim().toLowerCase();
        if (!cleanEmail) return;

        setLoading(true);
        try {
            const { data, error } = await client
                .from('whitelist')
                .select('email')
                .eq('email', cleanEmail)
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                await client.auth.signOut();
                setNotification({ text: `ACCESS DENIED. Your email (${cleanEmail}) is not authorized.`, type: 'error' });
                setShowUI(true);
                setOtpMode(false);
            } else {
                setUserEmail(cleanEmail);
                onAuthenticated(cleanEmail);
            }
        } catch (err: any) {
            console.error('[AUTH ENGINE] Whitelist exception:', err);
            setNotification({ text: 'Matrix Connection Error. Check Console for DB Policy issues.', type: 'error' });
            setShowUI(true);
        } finally {
            setLoading(false);
        }
    };

    // Space starfield Canvas Animation
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

    // 3D Card Wobble Mouse tracking
    useEffect(() => {
        const wrap = wobbleWrapperRef.current;
        const card = glassCardRef.current;
        if (!wrap || !card) return;

        const onMouseMove = (e: MouseEvent) => {
            const r = wrap.getBoundingClientRect();
            const rX = ((e.clientY - r.top - r.height / 2) / (r.height / 2)) * 10;
            const rY = ((e.clientX - r.left - r.width / 2) / (r.width / 2)) * -10;
            wrap.style.transform = `rotateX(${rX}deg) rotateY(${rY}deg)`;

            const cR = card.getBoundingClientRect();
            card.style.setProperty('--x', `${e.clientX - cR.left}px`);
            card.style.setProperty('--y', `${e.clientY - cR.top}px`);
        };

        const onMouseLeave = () => {
            wrap.style.transform = `rotateX(0deg) rotateY(0deg)`;
        };

        wrap.addEventListener('mousemove', onMouseMove);
        wrap.addEventListener('mouseleave', onMouseLeave);

        return () => {
            wrap.removeEventListener('mousemove', onMouseMove);
            wrap.removeEventListener('mouseleave', onMouseLeave);
        };
    }, [showUI]);

    // Typewriter effect React port
    useEffect(() => {
        const words = ['Executive', 'Revenue', 'Analytics'];
        let idx = 0;
        let sub = 0;
        let rev = false;
        let timeoutId: number;

        const type = () => {
            const el = typewriterRef.current;
            if (!el) return;
            const cur = words[idx];

            if (sub === cur.length + 1 && !rev) {
                rev = true;
                timeoutId = window.setTimeout(type, 1500);
                return;
            }
            if (sub === 0 && rev) {
                rev = false;
                idx = (idx + 1) % words.length;
                timeoutId = window.setTimeout(type, 500);
                return;
            }

            sub += rev ? -1 : 1;
            el.innerText = cur.substring(0, sub);
            timeoutId = window.setTimeout(type, Math.max(rev ? 75 : 120, Math.random() * 50));
        };

        if (showUI) {
            type();
        }

        return () => clearTimeout(timeoutId);
    }, [showUI]);

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading || !supabaseClient) return;

        setLoading(true);
        setNotification(null);

        const cleanEmail = email.trim().toLowerCase();

        try {
            // Verify whitelist first
            const { data: whitelistData, error: whitelistError } = await supabaseClient
                .from('whitelist')
                .select('email')
                .eq('email', cleanEmail)
                .maybeSingle();

            if (whitelistError) throw whitelistError;

            if (!whitelistData) {
                setNotification({ text: `ACCESS DENIED. ${cleanEmail} is not in the executive whitelist.`, type: 'error' });
                setLoading(false);
                return;
            }

            const { error } = await supabaseClient.auth.signInWithOtp({
                email: cleanEmail,
                options: { emailRedirectTo: window.location.origin + '/auth/callback' }
            });

            if (error) throw error;

            setOtpMode(true);
            setNotification({ text: `Security code dispatched to ${cleanEmail}`, type: 'success' });
            setTimeout(() => {
                otpInputRefs.current[0]?.focus();
            }, 100);
        } catch (err: any) {
            console.error('[AUTH ENGINE] OTP Request Failure:', err);
            setNotification({ text: err.message || 'Unable to dispatch code.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (index: number, val: string) => {
        const cleaned = val.replace(/\D/g, '');
        if (!cleaned) return;

        const newOtp = [...otpDigits];

        if (cleaned.length > 1) {
            // Bulk paste
            const digits = cleaned.slice(0, 8).split('');
            const filled = [...newOtp];
            digits.forEach((digit, i) => {
                if (i < 8) filled[i] = digit;
            });
            setOtpDigits(filled);

            const nextFocus = Math.min(digits.length, 7);
            otpInputRefs.current[nextFocus]?.focus();

            if (digits.length === 8) {
                submitOTP(filled.join(''));
            }
            return;
        }

        newOtp[index] = cleaned;
        setOtpDigits(newOtp);

        if (index < 7) {
            otpInputRefs.current[index + 1]?.focus();
        } else if (index === 7) {
            submitOTP(newOtp.join(''));
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace') {
            if (otpDigits[index] === '' && index > 0) {
                const newOtp = [...otpDigits];
                newOtp[index - 1] = '';
                setOtpDigits(newOtp);
                otpInputRefs.current[index - 1]?.focus();
            } else {
                const newOtp = [...otpDigits];
                newOtp[index] = '';
                setOtpDigits(newOtp);
            }
        }
    };

    const submitOTP = async (otpValue: string) => {
        if (!supabaseClient) return;
        setLoading(true);
        setNotification(null);

        try {
            const { data, error } = await supabaseClient.auth.verifyOtp({
                email: email.trim().toLowerCase(),
                token: otpValue,
                type: 'email'
            });

            if (error) throw error;
        } catch (err: any) {
            console.error('[AUTH ENGINE] OTP Verification Failure:', err);
            setNotification({ text: 'Code rejected or expired.', type: 'error' });
            setOtpDigits(Array(8).fill(''));
            otpInputRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        if (!supabaseClient) return;
        setLoading(true);
        try {
            const { error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin }
            });
            if (error) throw error;
        } catch (err: any) {
            console.error('[AUTH ENGINE] Google login failure:', err);
            setNotification({ text: err.message || 'Google authentication failed.', type: 'error' });
            setLoading(false);
        }
    };

    return (
        <div id="auth-layer" className={`fixed inset-0 z-[100] bg-[#05070A] flex flex-col items-center justify-center overflow-hidden transition-all duration-500 ${isHidden ? 'hidden opacity-0 pointer-events-none' : ''}`}>
            <canvas ref={spaceCanvasRef} className="absolute inset-0 z-0 bg-[#05070A] pointer-events-none" />

            {!showUI && (
                <div className="relative z-20 flex flex-col items-center">
                    <div className="auth-loader mb-4 w-10 h-10 border-[3px]" />
                    <p className="text-slate-400 text-xs font-medium tracking-widest uppercase animate-pulse mb-8">
                        Establishing Secure Matrix...
                    </p>
                    <button
                        onClick={() => setShowUI(true)}
                        className="group flex items-center gap-3 px-6 py-3 bg-gradient-to-b from-[#0F1219] to-[#05070A] hover:from-[#1e293b] hover:to-[#0f172a] border border-slate-800 hover:border-slate-600 rounded-full text-[10px] text-slate-400 hover:text-white font-bold uppercase tracking-[0.2em] transition-all duration-300 shadow-[0_4px_15px_rgba(0,0,0,0.5)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.15)]"
                    >
                        <User className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                        Manual Access Login
                    </button>
                </div>
            )}

            {showUI && (
                <div className="relative z-20 w-full max-w-sm perspective-1000">
                    <div ref={wobbleWrapperRef} className="transition-transform duration-200 ease-out">
                        <div
                            ref={glassCardRef}
                            id="glass-card"
                            className="group relative rounded-3xl p-[1px] overflow-hidden bg-slate-800/30 border-slate-700/50 shadow-2xl backdrop-blur-md"
                        >
                            <div className="relative h-full w-full bg-[#0A0C10]/95 rounded-[23px] overflow-hidden p-8 z-10">
                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0 bg-grid-pattern" />

                                <div className="relative z-10">
                                    <div className="text-center mb-8">
                                        <div className="inline-flex items-center justify-center mb-4">
                                            <svg className="w-12 h-12 text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M21 3l-18 7 7 4 4 7z" />
                                            </svg>
                                        </div>
                                        <h1 className="text-xl font-bold text-white tracking-tight flex flex-wrap justify-center gap-1.5 font-sans">
                                            Grew
                                            <span className="inline-flex items-center">
                                                <span ref={typewriterRef} className="text-emerald-400 font-extrabold" />
                                                <span className="ml-0.5 w-[2px] h-5 bg-emerald-400 type-cursor" />
                                            </span>
                                        </h1>
                                    </div>

                                    <form onSubmit={handleEmailSubmit} className="space-y-6">
                                        {!otpMode ? (
                                            <div className="relative group/input transition-all">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within/input:text-emerald-400 transition-colors" />
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    placeholder="Executive Email Address"
                                                    required
                                                    className="w-full bg-[#05070A]/50 border border-slate-800 rounded-xl py-3 pl-11 pr-4 text-xs text-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 outline-none transition-all placeholder:text-slate-600 shadow-inner"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center w-full space-y-4 animate-in">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center flex items-center justify-center gap-2">
                                                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                                    Authorization Array
                                                </p>
                                                <div className="flex justify-between w-full gap-2">
                                                    {otpDigits.map((digit, idx) => (
                                                        <input
                                                            key={idx}
                                                            ref={(el) => (otpInputRefs.current[idx] = el)}
                                                            type="text"
                                                            inputMode="numeric"
                                                            maxLength={1}
                                                            value={digit}
                                                            onChange={(e) => handleOtpChange(idx, e.target.value)}
                                                            onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                                            className="otp-digit w-full aspect-square bg-[#05070A]/80 border border-slate-800 rounded-xl text-center text-xl font-bold text-emerald-400 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/55 focus:-translate-y-0.5 outline-none transition-all shadow-inner"
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="auth-btn-primary w-full text-xs font-black py-3.5 rounded-xl flex items-center justify-center gap-2 uppercase tracking-widest cursor-pointer"
                                        >
                                            {loading ? (
                                                <div className="auth-loader w-4 h-4 border-[2px]" />
                                            ) : otpMode ? (
                                                'Verify Authorization Array'
                                            ) : (
                                                'Verify Email Access'
                                            )}
                                        </button>

                                        {!otpMode && (
                                            <>
                                                <div className="relative my-8">
                                                    <div className="absolute inset-0 flex items-center">
                                                        <span className="w-full border-t border-slate-800" />
                                                    </div>
                                                    <div className="relative flex justify-center text-[10px] uppercase">
                                                        <span className="bg-[#0A0C10] px-3 text-slate-600 font-medium tracking-widest">
                                                            Enterprise Auth
                                                        </span>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={handleGoogleLogin}
                                                    className="auth-btn-google w-full text-xs font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                                                >
                                                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                                                        <path
                                                            fill="#4285F4"
                                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                                        />
                                                        <path
                                                            fill="#34A853"
                                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                                        />
                                                        <path
                                                            fill="#FBBC05"
                                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                                        />
                                                        <path
                                                            fill="#EA4335"
                                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                                        />
                                                    </svg>
                                                    Continue with Google
                                                </button>
                                            </>
                                        )}
                                    </form>

                                    {notification && (
                                        <div
                                            className={`border p-4 rounded-xl mt-4 flex items-start gap-3 animate-in ${
                                                notification.type === 'success'
                                                    ? 'border-emerald-500/20 bg-emerald-950/20 text-emerald-400'
                                                    : 'border-rose-500/20 bg-rose-950/20 text-rose-400'
                                            }`}
                                        >
                                            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                                            <p className="text-[10px] font-medium leading-relaxed">
                                                {notification.text}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
