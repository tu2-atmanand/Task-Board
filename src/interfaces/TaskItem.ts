import { FrontMatterCache } from "obsidian";
import { DEFAULT_TASK_CACHE_KEYS, PropertyTypeConfig } from "./Enums.js";
import { robustDateParser } from "../utils/DateTimeCalculations.js";
import {
	DEFAULT_DATE_FORMAT,
	DEFAULT_DATE_TIME_FORMAT,
} from "./Constants.js";

export interface taskLocation {
	startLine: number; // The line number where the task starts
	startCharIndex: number; // The character position where the task starts
	endLine: number; // The line number where the task ends
	endCharIndex: number; // The character position where the task ends
}

export type CustomTaskPropertyValueType = string | number | boolean | string[];

/**
 * Coerce a configured custom-property value without changing built-in task fields.
 *
 * Date and date-time values are stored as epoch milliseconds. Unparseable
 * dates return undefined so invalid source values do not enter the task cache.
 *
 * @param value Any value you want to type check against its configured type.
 * @param type The data-type in which format the value of the property should be stored.
 */
export function coerceCustomTaskPropertyValue(
	value: unknown,
	type: PropertyTypeConfig,
	preferredDateFormat?: string,
	fallbackDateFormat?: string,
): CustomTaskPropertyValueType | undefined {
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
			return typeof value === "string" ? value : JSON.stringify(value);
		case PropertyTypeConfig.date:
		case PropertyTypeConfig.dateTime: {
			if (value instanceof Date) {
				return Number.isFinite(value.getTime())
					? value.getTime()
					: undefined;
			}
			if (typeof value === "number") {
				return Number.isFinite(value) &&
					Number.isFinite(new Date(value).getTime())
					? value
					: undefined;
			}
			if (typeof value !== "string" || value.trim() === "") {
				return undefined;
			}

			const includesTime = /(?:T|\s)\d{1,2}:\d{2}/.test(value);
			const formatsToTry =
				type === PropertyTypeConfig.dateTime && !includesTime
					? [
							fallbackDateFormat ?? DEFAULT_DATE_FORMAT,
							preferredDateFormat ?? DEFAULT_DATE_TIME_FORMAT,
						]
					: [
							preferredDateFormat ??
								(type === PropertyTypeConfig.date
									? DEFAULT_DATE_FORMAT
									: DEFAULT_DATE_TIME_FORMAT),
							fallbackDateFormat ?? DEFAULT_DATE_FORMAT,
						];
			let date: Date | null = null;
			for (const dateFormat of new Set(formatsToTry)) {
				date = robustDateParser(value, dateFormat);
				if (date) break;
			}
			return date && Number.isFinite(date.getTime())
				? date.getTime()
				: undefined;
		}
		default:
			return undefined;
	}
}

export interface oldTaskItem {
	[DEFAULT_TASK_CACHE_KEYS.ID]: string;
	[DEFAULT_TASK_CACHE_KEYS.LegacyID]: string; // Legacy ID to support Tasks plugin id property
	[DEFAULT_TASK_CACHE_KEYS.Title]: string;
	[DEFAULT_TASK_CACHE_KEYS.Body]?: string[];
	[DEFAULT_TASK_CACHE_KEYS.Status]: string;
	[DEFAULT_TASK_CACHE_KEYS.Priority]?: number;
	[DEFAULT_TASK_CACHE_KEYS.Tags]?: string[];
	[DEFAULT_TASK_CACHE_KEYS.FrontMatterTags]?: string[]; // Tags extracted from frontmatter
	[DEFAULT_TASK_CACHE_KEYS.Time]?: string;
	[DEFAULT_TASK_CACHE_KEYS.CreatedDate]?: number;
	[DEFAULT_TASK_CACHE_KEYS.StartDate]?: number;
	[DEFAULT_TASK_CACHE_KEYS.ScheduledDate]?: number;
	[DEFAULT_TASK_CACHE_KEYS.DueDate]?: number;
	[DEFAULT_TASK_CACHE_KEYS.CompletionDate]?: number;
	[DEFAULT_TASK_CACHE_KEYS.CancelledDate]?: number;
	[DEFAULT_TASK_CACHE_KEYS.Reminder]?: number; // Epoch milliseconds.
	[DEFAULT_TASK_CACHE_KEYS.Dependencies]?: string[]; // Array of task IDs that this task depends on
	[DEFAULT_TASK_CACHE_KEYS.FilePath]: string;
	[DEFAULT_TASK_CACHE_KEYS.TaskLocation]: taskLocation; // Only for inline-task.
	// onCompletion?: number;
}

/**
 * An interface to build a cache for a task object with default
 * properties as well as user's custom properties.
 *
 * Date and date-time cache fields use epoch milliseconds.
 */
export type taskItem = oldTaskItem &
	Record<string, CustomTaskPropertyValueType | taskLocation | undefined>;

/**
 * An interface to build a cache for a task object with default
 * properties as well as user's custom properties.
 */
export type taskItemWithCustomProperties = oldTaskItem &
	Record<string, CustomTaskPropertyValueType | taskLocation | undefined>;

export interface customFrontmatterCache extends FrontMatterCache {
	title?: string;
	status?: string;
	priority?: string | number;
	tags?: string[] | string;
	"created-date"?: string | number | Date;
	"start-date"?: string | number | Date;
	"schedule-date"?: string | number | Date;
	"due-date"?: string | number | Date;
	"cancelled-date"?: string | number | Date;
	"completion-date"?: string | number | Date;
	reminder?: string | number | Date;
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
		[filePath: string]: taskItemWithCustomProperties[]; // Maps file paths to arrays of pending tasks
	};
	Completed: {
		[filePath: string]: taskItemWithCustomProperties[]; // Maps file paths to arrays of completed tasks
	};
	// Notes: noteItem[]; -- @deprecated v1.9.0
}

export interface tasksJsonData {
	Pending: {
		[filePath: string]: taskItemWithCustomProperties[]; // Maps file paths to arrays of pending tasks
	};
	Completed: {
		[filePath: string]: taskItemWithCustomProperties[]; // Maps file paths to arrays of completed tasks
	};
}

export interface taskJsonMerged {
	Pending: taskItemWithCustomProperties[];
	Completed: taskItemWithCustomProperties[];
}

export interface cursorLocationInterface {
	lineNumber: number;
	charIndex: number;
}

export interface UpdateTaskEventData {
	taskID: string;
	state: boolean;
}
