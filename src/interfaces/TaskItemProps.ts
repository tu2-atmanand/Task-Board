import { App } from "obsidian";
import { Board } from "./BoardConfigs";
import TaskBoard from "main";
import { t } from "src/utils/lang/helper";

export interface TaskProps {
	key: number;
	app: App;
	plugin: TaskBoard;
	taskKey: number;
	task: taskItem;
	columnIndex: number;
	activeBoardSettings: Board;
	onEdit: () => void;
	onDelete: () => void;
	onCheckboxChange: (task: taskItem) => void;
	onSubTasksChange: (task: taskItem) => void;
}

export interface taskItem {
	id: number;
	title: string;
	body: string[];
	due: string;
	tags: string[];
	time: string;
	priority: number;
	completed?: string;
	filePath: string; // Include filePath since it's in the tasks
}

export interface tasksInFile {
	taskItem: taskItem;
}

export interface taskJsonMerged {
	Pending: taskItem[];
	Completed: taskItem[];
}

export interface tasksJson {
	Pending: {
		[filePath: string]: taskItem[]; // Maps file paths to arrays of pending tasks
	};
	Completed: {
		[filePath: string]: taskItem[]; // Maps file paths to arrays of completed tasks
	};
}

export const priorityEmojis: { [key: number]: string } = {
	0: "0",
	1: "🔺",
	2: "⏫",
	3: "🔼",
	4: "🔽",
	5: "⏬",
};

// Priority Options
export const priorityOptions = [
	{ value: 0, text: t(160) },
	{ value: 1, text: t(161) + " : 🔺" },
	{ value: 2, text: t(162) + " : ⏫" },
	{ value: 3, text: t(163) + " : 🔼" },
	{ value: 4, text: t(164) + " : 🔽" },
	{ value: 5, text: t(165) + " : ⏬" },
];
