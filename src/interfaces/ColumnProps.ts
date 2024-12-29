import { taskItem, taskJsonMerged } from "./TaskItemProps";

import { App } from "obsidian";
import TaskBoard from "main";

export interface ColumnProps {
	key: number;
	app: App;
	plugin: TaskBoard;
	columnIndex: number;
	activeBoardIndex: number;
	collapsed?: boolean;
	columnData: {
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
	tasksForThisColumn: taskItem[];
}
