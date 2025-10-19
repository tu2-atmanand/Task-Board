// Plugin view type identifiers
export const VIEW_TYPE_TASKBOARD = "task-board-view";
export const VIEW_TYPE_ADD_OR_EDIT_TASK = "add-or-edit-task-view";

// Local storage keys
// const LOCAL_STORAGE_KEY = "taskBoardCachedLang";
export const PENDING_SCAN_FILE_STACK = "taskBoard_file_stack";
export const LOCAL_STORAGE_TRANSLATIONS = "taskboard_cached_translations";
export const NODE_POSITIONS_STORAGE_KEY = "taskboard_map_node_positions"; // now stores board-wise
export const NODE_SIZE_STORAGE_KEY = "taskboard_map_node_sizes";
export const VIEWPORT_STORAGE_KEY = "taskboard_map_viewport";

export const TASK_NOTE_IDENTIFIER_TAG = "taskNote";

export const TASK_NOTE_FRONTMATTER_KEYS = {
	title: "title",
	id: "id",
	status: "status",
	tags: "tags",
	priority: "priority",
	createdDate: "created",
	startDate: "start",
	scheduledDate: "scheduled",
	dueDate: "due",
	time: "time",
	dependsOn: "dependsOn",
	reminder: "reminder",
	cancelledDate: "cancelled",
	completionDate: "completed",
};

// Default file names and paths
export const DEFAULT_TASKS_CACHE_FILE = "task-board-data.json";
export const DEFAULT_ARCHIVED_TASKS_FILE = "archived-tasks.json";
export const DEFAULT_PREDEFINED_NOTE = "Task_board_note.md";
export const DEFAULT_TASKS_FOLDER = "TaskNotes";
