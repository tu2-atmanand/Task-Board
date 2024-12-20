import { createContext, useContext } from "react";

import TaskBoard from "main";

export const PluginContext = createContext<TaskBoard | undefined>(undefined);

export const usePlugin = (): TaskBoard | undefined => {
	return useContext(PluginContext);
};
