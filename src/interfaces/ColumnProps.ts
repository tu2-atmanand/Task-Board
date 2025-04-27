import { taskItem, taskJsonMerged } from "./TaskItemProps";

import { App } from "obsidian";
import TaskBoard from "main";
import { ColumnData } from "./BoardConfigs";

export interface ColumnProps {
	key: number;
	plugin: TaskBoard;
	columnIndex: number;
	activeBoardIndex: number;
	collapsed?: boolean;
	columnData: ColumnData;
	tasksForThisColumn: taskItem[];
}
