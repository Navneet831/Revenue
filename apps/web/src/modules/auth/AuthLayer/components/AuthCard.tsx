import React from 'react';

interface AuthCardProps {
    children: React.ReactNode;
}

export const AuthCard: React.FC<AuthCardProps> = ({ children }) => (
    <div className="relative z-20 w-full max-w-sm">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
            <div className="relative z-10">
                {children}
            </div>
        </div>
    </div>
);
