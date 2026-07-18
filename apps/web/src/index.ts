// Re-export App component
export { App } from './App';

// Re-export theme and constants
export * from './theme';
export * from './constants';

// Re-export store
export * from './store/useStore';

// Re-export services
export * from './services/analyticsService';
export * from './services/apiClient';
export * from './services/cacheService';
export * from './services/activityService';
export * from './services/dbService';
export * from './services/featureService';
export * from './services/revenueService';
export * from './services/gitService';

// Re-export hooks
export * from './hooks/useSectionData';
export * from './hooks/useKeyboardShortcuts';

// GlobalProvider is a no-op wrapper for now (can be extended later for context)
import React from 'react';

export const GlobalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return React.createElement(React.Fragment, null, children);
};
