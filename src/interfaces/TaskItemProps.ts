import { App } from "obsidian";

export interface TaskProps {
	app: App;
	task: taskItem;
	onEdit: () => void;
	onDelete: () => void;
	onCheckboxChange: (task: taskItem) => void;
	onSubTasksChange: (task: taskItem) => void;
}

export interface taskItem {
	id?: number;
	title: string;
	body: string[];
	due: string;
	tag: string;
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
	{ value: 0, text: "NONE" },
	{ value: 1, text: "Highest : 🔺" },
	{ value: 2, text: "High : ⏫" },
	{ value: 3, text: "Medium : 🔼" },
	{ value: 4, text: "Low : 🔽" },
	{ value: 5, text: "Lowest : ⏬" },
];
