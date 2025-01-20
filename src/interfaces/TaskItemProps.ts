import { App } from "obsidian";
import { Board } from "./BoardConfigs";
import TaskBoard from "main";
import { t } from "src/utils/lang/helper";

export interface TaskProps {
	key: number;
	plugin: TaskBoard;
	taskKey: number;
	task: taskItem;
	columnIndex: number;
	activeBoardSettings: Board;
}

export interface taskItem {
	id: number;
	title: string;
	body: string[];
	due: string;
	tags: string[];
	time: string;
	priority: number;
	completion?: string;
	status: string;
	filePath: string;
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
	{ value: 0, text: t("none") },
	{ value: 1, text: t("highest") + " : 🔺" },
	{ value: 2, text: t("high") + " : ⏫" },
	{ value: 3, text: t("medium") + " : 🔼" },
	{ value: 4, text: t("low") + " : 🔽" },
	{ value: 5, text: t("lowest") + " : ⏬" },
];
