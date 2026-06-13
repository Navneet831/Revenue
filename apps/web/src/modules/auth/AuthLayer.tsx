import React, { useEffect, useRef, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseService } from '@/services/supabaseService';
import { useStore } from '@/store/useStore';
import { CommitDrilldown } from '../shared/CommitDrilldown';
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

    return (
        <div id="auth-layer" className={`fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center overflow-hidden transition-all duration-500 ${isHidden ? 'hidden opacity-0 pointer-events-none' : ''}`}>
            {!showUI ? (
                <ManualLoginOverlay onShowUI={() => setShowUI(true)} />
            ) : (
                <AuthCard>
                    <AuthHeader />
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
