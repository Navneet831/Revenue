import { useState, useReducer } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

interface AuthState {
    email: string;
    otpMode: boolean;
    otpDigits: string[];
    loading: boolean;
    showUI: boolean;
    notification: { text: string; type: 'success' | 'error' } | null;
    supabaseClient: SupabaseClient | null;
}

type AuthAction =
    | { type: 'SET_EMAIL'; payload: string }
    | { type: 'SET_OTP_MODE'; payload: boolean }
    | { type: 'SET_OTP_DIGITS'; payload: string[] }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_SHOW_UI'; payload: boolean }
    | { type: 'SET_NOTIFICATION'; payload: { text: string; type: 'success' | 'error' } | null }
    | { type: 'SET_SUPABASE_CLIENT'; payload: SupabaseClient | null }
    | { type: 'RESET_OTP' };

const initialState: AuthState = {
    email: '',
    otpMode: false,
    otpDigits: Array(8).fill(''),
    loading: false,
    showUI: false,
    notification: null,
    supabaseClient: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
    switch (action.type) {
        case 'SET_EMAIL':
            return { ...state, email: action.payload };
        case 'SET_OTP_MODE':
            return { ...state, otpMode: action.payload };
        case 'SET_OTP_DIGITS':
            return { ...state, otpDigits: action.payload };
        case 'SET_LOADING':
            return { ...state, loading: action.payload };
        case 'SET_SHOW_UI':
            return { ...state, showUI: action.payload };
        case 'SET_NOTIFICATION':
            return { ...state, notification: action.payload };
        case 'SET_SUPABASE_CLIENT':
            return { ...state, supabaseClient: action.payload };
        case 'RESET_OTP':
            return { ...state, otpMode: false, otpDigits: Array(8).fill('') };
        default:
            return state;
    }
}

export function useAuthLogic() {
    const [state, dispatch] = useReducer(authReducer, initialState);

    return {
        state,
        setEmail: (email: string) => dispatch({ type: 'SET_EMAIL', payload: email }),
        setOtpMode: (mode: boolean) => dispatch({ type: 'SET_OTP_MODE', payload: mode }),
        setOtpDigits: (digits: string[]) => dispatch({ type: 'SET_OTP_DIGITS', payload: digits }),
        setLoading: (loading: boolean) => dispatch({ type: 'SET_LOADING', payload: loading }),
        setShowUI: (show: boolean) => dispatch({ type: 'SET_SHOW_UI', payload: show }),
        setNotification: (notif: { text: string; type: 'success' | 'error' } | null) => dispatch({ type: 'SET_NOTIFICATION', payload: notif }),
        setSupabaseClient: (client: SupabaseClient | null) => dispatch({ type: 'SET_SUPABASE_CLIENT', payload: client }),
        resetOtp: () => dispatch({ type: 'RESET_OTP' }),
    };
}
