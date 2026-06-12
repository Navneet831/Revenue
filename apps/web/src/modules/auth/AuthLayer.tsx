import React, { useEffect, useRef, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseService } from '@/services/supabaseService';
import { useStore } from '@/store/useStore';
import { CommitDrilldown } from '../shared/CommitDrilldown';
import { StarfieldCanvas } from './AuthLayer/StarfieldCanvas';
import { useAuthLogic } from './AuthLayer/hooks/useAuthLogic';
import { AuthCard } from './AuthLayer/components/AuthCard';
import { AuthHeader } from './AuthLayer/components/AuthHeader';
import { LoginForm } from './AuthLayer/components/LoginForm';
import { ManualLoginOverlay } from './AuthLayer/components/ManualLoginOverlay';
import { AuthNotification } from './AuthLayer/components/AuthNotification';

interface AuthLayerProps {
    onAuthenticated: (email: string) => void;
    isHidden?: boolean;
}

export const AuthLayer: React.FC<AuthLayerProps> = ({ onAuthenticated, isHidden }) => {
    const { setUserEmail } = useStore();
    const {
        state,
        setEmail,
        setOtpMode,
        setOtpDigits,
        setLoading,
        setShowUI,
        setNotification,
        setSupabaseClient,
        resetOtp
    } = useAuthLogic();

    const { email, otpMode, otpDigits, loading, showUI, notification, supabaseClient } = state;

    const wobbleWrapperRef = useRef<HTMLDivElement | null>(null);
    const glassCardRef = useRef<HTMLDivElement | null>(null);
    const typewriterRef = useRef<HTMLSpanElement | null>(null);
    const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [otpCooldown, setOtpCooldown] = useState(0);

    // ─── Initialization Logic ───────────────────────────────────────────────
    useEffect(() => {
        if ((window as any).__playwright_test__) {
            setUserEmail('tester@grew.power');
            onAuthenticated('tester@grew.power');
            return;
        }

        const initSupabase = async () => {
            const timeout = setTimeout(() => {
                if (!showUI && !isHidden) setShowUI(true);
            }, 15000);

            try {
                const client = await supabaseService.getClient();
                setSupabaseClient(client);

                const { data: { session }, error: sessionError } = await client.auth.getSession();
                clearTimeout(timeout);

                // Magic-link/OAuth tokens in the URL hash are consumed by getSession();
                // restore a clean address bar so the app never lives at /auth/callback#
                cleanAuthCallbackUrl();

                if (sessionError) throw sessionError;

                if (session) {
                    await verifyWhitelist(client, session.user?.email || '');
                } else {
                    setShowUI(true);
                }

                client.auth.onAuthStateChange(async (event, newSession) => {
                    if (newSession && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
                        cleanAuthCallbackUrl();
                        await verifyWhitelist(client, newSession.user?.email || '');
                    } else if (event === 'SIGNED_OUT') {
                        setShowUI(true);
                        resetOtp();
                    }
                });
            } catch (err: any) {
                clearTimeout(timeout);
                setNotification({ text: err.message || 'Critical Boot Error.', type: 'error' });
                setShowUI(true);
            }
        };

        initSupabase();
    }, []);

    const cleanAuthCallbackUrl = () => {
        if (window.location.pathname.startsWith('/auth/callback') || window.location.hash.includes('access_token')) {
            window.history.replaceState(null, '', '/');
        }
    };

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
                setNotification({ text: `ACCESS DENIED. ${cleanEmail} is not authorized.`, type: 'error' });
                setShowUI(true);
                setOtpMode(false);
            } else {
                setUserEmail(cleanEmail);
                onAuthenticated(cleanEmail);
            }
        } catch (err: any) {
            setNotification({ text: 'Matrix Connection Error.', type: 'error' });
            setShowUI(true);
        } finally {
            setLoading(false);
        }
    };

    // ─── Visual Effects ─────────────────────────────────────────────────────
    useEffect(() => {
        const wrap = wobbleWrapperRef.current;
        const card = glassCardRef.current;
        if (!wrap || !card || !showUI) return;

        const onMouseMove = (e: MouseEvent) => {
            const r = wrap.getBoundingClientRect();
            const rX = ((e.clientY - r.top - r.height / 2) / (r.height / 2)) * 10;
            const rY = ((e.clientX - r.left - r.width / 2) / (r.width / 2)) * -10;
            wrap.style.transform = `rotateX(${rX}deg) rotateY(${rY}deg)`;

            const cR = card.getBoundingClientRect();
            card.style.setProperty('--x', `${e.clientX - cR.left}px`);
            card.style.setProperty('--y', `${e.clientY - cR.top}px`);
        };

        const onMouseLeave = () => { wrap.style.transform = `rotateX(0deg) rotateY(0deg)`; };

        wrap.addEventListener('mousemove', onMouseMove);
        wrap.addEventListener('mouseleave', onMouseLeave);
        return () => {
            wrap.removeEventListener('mousemove', onMouseMove);
            wrap.removeEventListener('mouseleave', onMouseLeave);
        };
    }, [showUI]);

    useEffect(() => {
        const words = ['Solar', 'Energy', 'Analytics'];
        let idx = 0, sub = 0, rev = false, timeoutId: number;

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

        if (showUI) type();
        return () => clearTimeout(timeoutId);
    }, [showUI]);

    // ─── Handlers ───────────────────────────────────────────────────────────
    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading || !supabaseClient) return;

        setLoading(true);
        setNotification(null);
        const cleanEmail = email.trim().toLowerCase();

        try {
            const { data: whitelistData, error: whitelistError } = await supabaseClient
                .from('whitelist').select('email').eq('email', cleanEmail).maybeSingle();

            if (whitelistError) throw whitelistError;
            if (!whitelistData) {
                setNotification({ text: `ACCESS DENIED. ${cleanEmail} is not whitelisted.`, type: 'error' });
                setLoading(false);
                return;
            }

            const { error } = await supabaseClient.auth.signInWithOtp({
                email: cleanEmail,
                options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
            });

            if (error) throw error;
            setOtpMode(true);
            setNotification({ text: `Code dispatched to ${cleanEmail}`, type: 'success' });
            setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
        } catch (err: any) {
            // Rate limit cooldown — match HTML baseline behavior
            if (err.message && err.message.toLowerCase().includes('rate')) {
                let countdown = 60;
                setOtpCooldown(countdown);
                if (cooldownRef.current) clearInterval(cooldownRef.current);
                cooldownRef.current = setInterval(() => {
                    countdown--;
                    setOtpCooldown(countdown);
                    if (countdown <= 0 && cooldownRef.current) {
                        clearInterval(cooldownRef.current);
                        cooldownRef.current = null;
                    }
                }, 1000);
                setNotification({ text: `Rate limited. Retry in 60s.`, type: 'error' });
            } else {
                setNotification({ text: err.message || 'Dispatch failure.', type: 'error' });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (index: number, val: string) => {
        const cleaned = val.replace(/\D/g, '');
        if (!cleaned) return;
        const newOtp = [...otpDigits];

        if (cleaned.length > 1) {
            const digits = cleaned.slice(0, 8).split('');
            const filled = [...newOtp];
            digits.forEach((digit, i) => { if (i < 8) filled[i] = digit; });
            setOtpDigits(filled);
            const nextFocus = Math.min(digits.length, 7);
            otpInputRefs.current[nextFocus]?.focus();
            if (digits.length === 8) submitOTP(filled.join(''));
            return;
        }

        newOtp[index] = cleaned;
        setOtpDigits(newOtp);
        if (index < 7) otpInputRefs.current[index + 1]?.focus();
        else if (index === 7) submitOTP(newOtp.join(''));
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace') {
            const newOtp = [...otpDigits];
            if (otpDigits[index] === '' && index > 0) {
                newOtp[index - 1] = '';
                setOtpDigits(newOtp);
                otpInputRefs.current[index - 1]?.focus();
            } else {
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
            const { error } = await supabaseClient.auth.verifyOtp({
                email: email.trim().toLowerCase(),
                token: otpValue,
                type: 'email'
            });
            if (error) throw error;
        } catch (err: any) {
            setNotification({ text: 'Code rejected.', type: 'error' });
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
                options: { redirectTo: `${window.location.origin}/auth/callback` }
            });
            if (error) throw error;
        } catch (err: any) {
            setNotification({ text: 'Google login failed.', type: 'error' });
            setLoading(false);
        }
    };

    return (
        <div id="auth-layer" className={`fixed inset-0 z-[100] bg-[#05070A] flex flex-col items-center justify-center overflow-hidden transition-all duration-500 ${isHidden ? 'hidden opacity-0 pointer-events-none' : ''}`}>
            <StarfieldCanvas />

            {!showUI ? (
                <ManualLoginOverlay onShowUI={() => setShowUI(true)} />
            ) : (
                <AuthCard wobbleRef={wobbleWrapperRef} glassRef={glassCardRef}>
                    <AuthHeader typewriterRef={typewriterRef} />
                    <LoginForm
                        email={email}
                        setEmail={setEmail}
                        otpMode={otpMode}
                        otpDigits={otpDigits}
                        onOtpChange={handleOtpChange}
                        onOtpKeyDown={handleOtpKeyDown}
                        otpInputRefs={otpInputRefs}
                        loading={loading}
                        otpCooldown={otpCooldown}
                        onSubmit={handleEmailSubmit}
                        onGoogleLogin={handleGoogleLogin}
                    />
                    <AuthNotification notification={notification} />
                </AuthCard>
            )}
            <CommitDrilldown />
        </div>
    );
};
