import path from "path";

export const VIEW_TYPE_TASKBOARD = "task-board-view";

export const TaskBoardIcon = "lucide-file-check";

const basePath = (window as any).app.vault.adapter.basePath;
export const tasksPath = path.join(
	basePath,
	".obsidian",
	"plugins",
	"task-board",
	"tasks.json"
);

export const dataFilePath = path.join(
	basePath,
	".obsidian",
	"plugins",
	"task-board",
	"data.json"
);
