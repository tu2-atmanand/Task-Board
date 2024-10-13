import { taskItem, taskJsonMerged } from "./TaskItemProps";

import { App } from "obsidian";
import TaskBoard from "main";

export interface ColumnProps {
	app: App;
	plugin: TaskBoard;
	activeBoard: number;
	colType: string;
	active?: boolean;
	collapsed?: boolean;
	data: {
		name: string;
		index: number;
		coltag?: string;
		range?: {
			tag: string;
			rangedata: {
				from: number;
				to: number;
			};
		};
		limit?: number;
	};
	tasks: taskItem[];
	allTasks: taskJsonMerged;
}
