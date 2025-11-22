import React, { createContext, useContext, ReactNode } from 'react';
import type TaskBoard from '../../main';

const PluginContext = createContext<TaskBoard | null>(null);

export const PluginProvider: React.FC<{ plugin: TaskBoard; children: ReactNode }> = ({ plugin, children }) => {
    return (
        <PluginContext.Provider value={plugin}>
            {children}
        </PluginContext.Provider>
    );
};

export function useTaskBoardPlugin(): TaskBoard {
    const ctx = useContext(PluginContext);
    if (!ctx) throw new Error('useTaskBoardPlugin must be used within a PluginProvider');
    return ctx;
}

export default PluginContext;
