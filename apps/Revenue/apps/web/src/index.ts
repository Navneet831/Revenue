// Re-export App component
export { App } from './App';

// GlobalProvider is a no-op wrapper for now (can be extended later for context)
import React from 'react';

export const GlobalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return React.createElement(React.Fragment, null, children);
};
