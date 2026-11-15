import { FrontMatterCache } from "obsidian";
import { DEFAULT_TASK_CACHE_KEYS, PropertyTypeConfig } from "./Enums.js";

export interface taskLocation {
	startLine: number; // The line number where the task starts
	startCharIndex: number; // The character position where the task starts
	endLine: number; // The line number where the task ends
	endCharIndex: number; // The character position where the task ends
}

export type CustomTaskPropertyValue = string | number | boolean | string[];

/** Coerce a configured custom-property value without changing built-in task fields. */
export function coerceCustomTaskPropertyValue(
	value: unknown,
	type: PropertyTypeConfig,
): CustomTaskPropertyValue | undefined {
	if (value === undefined || value === null || value === "") return undefined;
	switch (type) {
		case PropertyTypeConfig.boolean:
			if (typeof value === "boolean") return value;
			if (typeof value === "string") {
				if (value.toLowerCase() === "true") return true;
				if (value.toLowerCase() === "false") return false;
			}
			return undefined;
		case PropertyTypeConfig.numeric: {
			const numberValue =
				typeof value === "number" ? value : Number(value);
			return Number.isFinite(numberValue) ? numberValue : undefined;
		}
		case PropertyTypeConfig.list:
			return Array.isArray(value)
				? value.map(String)
				: typeof value === "string"
					? value
							.split(",")
							.map((item) => item.trim())
							.filter(Boolean)
					: undefined;
		case PropertyTypeConfig.text:
		case PropertyTypeConfig.time:
		case PropertyTypeConfig.date:
		case PropertyTypeConfig.dateTime:
			if (value instanceof Date && Number.isFinite(value.getTime())) {
				const isoValue = value.toISOString();
				return type === PropertyTypeConfig.date
					? isoValue.slice(0, 10)
					: isoValue;
			}
			return typeof value === "string" ? value : JSON.stringify(value);
		default:
			return undefined;
	}
}

export interface taskItem {
	[DEFAULT_TASK_CACHE_KEYS.ID]: string;
	[DEFAULT_TASK_CACHE_KEYS.LegacyID]: string; // Legacy ID to support Tasks plugin id property
	[DEFAULT_TASK_CACHE_KEYS.Title]: string;
	[DEFAULT_TASK_CACHE_KEYS.Body]: string[];
	[DEFAULT_TASK_CACHE_KEYS.Status]: string;
	[DEFAULT_TASK_CACHE_KEYS.Priority]: number;
	[DEFAULT_TASK_CACHE_KEYS.Tags]: string[];
	[DEFAULT_TASK_CACHE_KEYS.FrontMatterTags]: string[]; // Tags extracted from frontmatter
	[DEFAULT_TASK_CACHE_KEYS.Time]: string;
	[DEFAULT_TASK_CACHE_KEYS.CreatedDate]: string;
	[DEFAULT_TASK_CACHE_KEYS.StartDate]: string;
	[DEFAULT_TASK_CACHE_KEYS.ScheduledDate]: string;
	[DEFAULT_TASK_CACHE_KEYS.DueDate]: string;
	[DEFAULT_TASK_CACHE_KEYS.FilePath]: string;
	[DEFAULT_TASK_CACHE_KEYS.TaskLocation]: taskLocation;
	[DEFAULT_TASK_CACHE_KEYS.Dependencies]?: string[]; // Array of task IDs that this task depends on
	[DEFAULT_TASK_CACHE_KEYS.Reminder]?: string; // A date-time value.
	[DEFAULT_TASK_CACHE_KEYS.CompletionDate]?: string;
	[DEFAULT_TASK_CACHE_KEYS.CancelledDate]?: string;
	// onCompletion?: number;
}

/** A task plus configured custom properties keyed by their property IDs. */
export type taskItemWithCustomProperties = taskItem &
	Record<string, CustomTaskPropertyValue | taskLocation | undefined>;

export interface customFrontmatterCache extends FrontMatterCache {
	title?: string;
	status?: string;
	priority?: string | number;
	tags?: string[] | string;
	"created-date"?: string;
	"start-date"?: string;
	"schedule-date"?: string;
	"due-date"?: string;
	"cancelled-date"?: string;
	"completion-date"?: string;
	reminder?: string;
}

export interface noteItem {
	filePath: string;
	frontmatter: unknown; // The frontmatter of the note
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
	// Notes: noteItem[]; -- @deprecated v1.9.0
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

export interface cursorLocationInterface {
	lineNumber: number;
	charIndex: number;
}

export interface UpdateTaskEventData {
	taskID: string;
	state: boolean;
}
