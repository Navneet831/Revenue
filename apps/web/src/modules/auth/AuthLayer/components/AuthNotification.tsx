import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface AuthNotificationProps {
    notification: { text: string; type: 'success' | 'error' } | null;
}

export const AuthNotification: React.FC<AuthNotificationProps> = ({ notification }) => {
    if (!notification) return null;
    
    return (
        <div className={`border p-4 rounded-xl mt-4 flex items-start gap-3 animate-in ${
            notification.type === 'success' 
                ? 'border-emerald-500/20 bg-emerald-950/20 text-emerald-400' 
                : 'border-rose-500/20 bg-rose-950/20 text-rose-400'
        }`}>
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-[10px] font-medium leading-relaxed">{notification.text}</p>
        </div>
    );
};
