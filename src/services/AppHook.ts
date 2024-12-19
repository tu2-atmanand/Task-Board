import { createContext, useContext } from "react";

import TaskBoard from "main";

export const AppContext = createContext<TaskBoard | undefined>(undefined);

export const useApp = (): TaskBoard | undefined => {
	return useContext(AppContext);
};
