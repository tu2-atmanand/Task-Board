import { FrontMatterCache } from "obsidian";

export interface taskLocation {
	startLine: number; // The line number where the task starts
	startCharIndex: number; // The character position where the task starts
	endLine: number; // The line number where the task ends
	endCharIndex: number; // The character position where the task ends
}

export interface taskItem {
	id: number;
	legacyId: string; // Legacy ID to support Tasks plugin id property
	title: string;
	body: string[];
	status: string;
	priority: number;
	tags: string[];
	frontmatterTags: string[]; // Tags extracted from frontmatter
	time: string;
	createdDate: string;
	startDate: string;
	scheduledDate: string;
	due: string;
	filePath: string;
	taskLocation: taskLocation;
	dependsOn?: string[]; // Array of task IDs that this task depends on
	reminder?: string; // A date-time value.
	completion?: string;
	cancelledDate?: string;
}

export interface customFrontmatterCache extends FrontMatterCache {
	tags?: string[] | string;
	title?: string;
	"created-date"?: string;
	"start-date"?: string;
	"schedule-date"?: string;
	"due-date"?: string;
	"cancelled-date"?: string;
	"completion-date"?: string;
	priority?: string | number;
	status?: string;
	reminder?: string;
}

export interface noteItem {
	filePath: string;
	frontmatter: any; // The frontmatter of the note
	reminder: string; // A date-time value.
}

export interface jsonCacheData {
	VaultName: string; // Name of the vault
	Modified_at: string; // Last modified date of the JSON file
	Pending: {
		[filePath: string]: taskItem[]; // Maps file paths to arrays of pending tasks
	};
	Completed: {
		[filePath: string]: taskItem[]; // Maps file paths to arrays of completed tasks
	};
	Notes: noteItem[];
}

export interface tasksJsonData {
	Pending: {
		[filePath: string]: taskItem[]; // Maps file paths to arrays of pending tasks
	};
	Completed: {
		[filePath: string]: taskItem[]; // Maps file paths to arrays of completed tasks
	};
}

export interface taskJsonMerged {
	Pending: taskItem[];
	Completed: taskItem[];
}

export interface cursorLocation {
	lineNumber: number;
	charIndex: number;
}
