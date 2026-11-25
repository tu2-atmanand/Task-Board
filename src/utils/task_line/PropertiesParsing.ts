import {
	DEFAULT_TASK_CACHE_KEYS,
	PropertyTypeConfig,
	taskPropertyFormatOptions,
} from "../../interfaces/Enums.js";
import {
	globalSettingsData,
	type CustomPriority,
	type SupportedPropertiesConfig,
} from "../../interfaces/GlobalSettings.js";
import { priorityEmojis } from "../../interfaces/Mapping.js";
import {
	CustomTaskPropertyValueType,
	coerceCustomTaskPropertyValue,
	taskItemWithCustomProperties,
} from "../../interfaces/TaskItem.js";
import { extractCheckboxSymbol } from "../CheckBoxUtils.js";
import { DATAVIEW_PLUGIN_DEFAULT_SYMBOLS } from "../regular_expressions/DataviewPluginRegularExpr.js";
import {
	TASKS_PLUGIN_DEFAULT_SYMBOLS,
	TaskRegularExpressions,
} from "../regular_expressions/TasksPluginRegularExpr.js";

/**
 * A single extraction function which can be used to extract default as well as
 * custom properties from an inline-task of a specific format.
 * This is specially designed to reduce the parsing time for long notes and huge
 * number of files. Makes use of the regular expressions to only scan the
 * properties from the inline-tasks for the format set by user in the setting.
 * Below are the supported formats :
 * - Tasks plugin Emoji
 * - Dataview
 * - Obsidian native
 *
 * Please note that, below DEFAULT_TASK_PROPERTIES will not be scanned by
 * this function and the dedicated functions can be used to extract these
 * properties :
 * - {@link DEFAULT_TASK_CACHE_KEYS.Body}
 * - {@link DEFAULT_TASK_CACHE_KEYS.Status}
 * - {@link DEFAULT_TASK_CACHE_KEYS.Tags}
 *
 * @param line - The inline-task line.
 * @param settings - All settings of this plugin.
 * @returns Extracted key value pair record.
 */
export function extractTaskPropertiesOfSingleFormat(
	line: string,
	settings: globalSettingsData,
): Record<string, CustomTaskPropertyValueType> {
	return extractConfiguredTaskProperties(line, settings, false);
}

/**
 * Extract all configured task properties from inline-task. This function
 * works similar to the {@link extractTaskPropertiesOfSingleFormat}, but
 * instead of scanning for single format, it will scan for all 3 supported
 * formats.
 *
 * @note This is a little expensive function as it looks for properties
 * which are in any of the 3 supported formats. Only use this function
 * if user has enabled the setting {@link scanForAllFormat}
 */
export function extractTaskPropertiesAllTYpe(
	line: string,
	settings: globalSettingsData,
): Record<string, CustomTaskPropertyValueType> {
	return extractConfiguredTaskProperties(line, settings, true);
}

const SPECIAL_TASK_PROPERTY_KEYS = new Set<string>([
	DEFAULT_TASK_CACHE_KEYS.Title,
	DEFAULT_TASK_CACHE_KEYS.Body,
	DEFAULT_TASK_CACHE_KEYS.Status,
	DEFAULT_TASK_CACHE_KEYS.Tags,
	DEFAULT_TASK_CACHE_KEYS.FilePath,
	DEFAULT_TASK_CACHE_KEYS.Priority,
	DEFAULT_TASK_CACHE_KEYS.Time,
]);

function extractConfiguredTaskProperties(
	line: string,
	settings: globalSettingsData,
	allFormats: boolean,
): Record<string, CustomTaskPropertyValueType> {
	const result: Record<string, CustomTaskPropertyValueType> = {};

	// Manually handling the defalt property "Time" as it requires a special parsing.
	const timeProperty = settings.taskProperties.find(
		(property) => property.key === String(DEFAULT_TASK_CACHE_KEYS.Time),
	);
	if (timeProperty) {
		const match = extractTime(
			line,
			settings.taskProperties,
			allFormats ? undefined : settings.taskPropertyFormat,
		);
		const value = coerceCustomTaskPropertyValue(
			match?.[2],
			timeProperty.type,
			settings.dateTimeFormat,
		);
		if (value !== undefined) result[timeProperty.key] = value;
	}

	// Manually handling the defalt property "Priority" as it requires a special parsing.
	const priorityProperty = settings.taskProperties.find(
		(property) => property.key === String(DEFAULT_TASK_CACHE_KEYS.Priority),
	);
	if (priorityProperty) {
		const priority = extractPriority(
			line,
			settings.taskProperties,
			settings.customPriorities,
			allFormats ? undefined : settings.taskPropertyFormat,
		);
		if (priority.value > 0) result[priorityProperty.key] = priority.value;
	}

	for (const property of settings.taskProperties) {
		if (!property.id || SPECIAL_TASK_PROPERTY_KEYS.has(property.key)) {
			continue;
		}
		const match = matchTaskProperty(
			line,
			property,
			allFormats ? undefined : settings.taskPropertyFormat,
		);
		if (!match?.[1]) continue;

		let raw = match[1].trim();
		if (raw.startsWith('"') && raw.endsWith('"')) {
			try {
				raw = JSON.parse(raw) as string;
			} catch {
				raw = raw.slice(1, -1);
			}
		} else if (raw.startsWith("'") && raw.endsWith("'")) {
			raw = raw.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
		}
		const value = coerceCustomTaskPropertyValue(
			raw,
			property.type,
			property.type === PropertyTypeConfig.date
				? settings.dateFormat
				: settings.dateTimeFormat,
			settings.dateFormat,
		);
		if (value !== undefined) result[property.key] = value;
	}
	return result;
}

export function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPropertyFormatOrder(
	format?: taskPropertyFormatOptions,
): taskPropertyFormatOptions[] {
	if (format === taskPropertyFormatOptions.dataviewPlugin) return [format];
	if (format === taskPropertyFormatOptions.obsidianNative) return [format];
	if (
		format === taskPropertyFormatOptions.default ||
		format === taskPropertyFormatOptions.tasksPlugin
	) {
		return [format];
	}
	return [
		taskPropertyFormatOptions.dataviewPlugin,
		taskPropertyFormatOptions.tasksPlugin,
		taskPropertyFormatOptions.obsidianNative,
	];
}

function matchTaskProperty(
	text: string,
	property: SupportedPropertiesConfig,
	format?: taskPropertyFormatOptions,
): RegExpMatchArray | null {
	if (!property.id) return null;
	for (const currentFormat of getPropertyFormatOrder(format)) {
		let expression: RegExp | undefined;
		switch (currentFormat) {
			case taskPropertyFormatOptions.dataviewPlugin:
				expression = new RegExp(
					`\\[${escapeRegExp(property.id)}::\\s*([^\\]]*)\\]`,
				);
				break;
			case taskPropertyFormatOptions.obsidianNative:
				expression = new RegExp(
					`@${escapeRegExp(property.id)}\\(([^)]*)\\)`,
				);
				break;
			default:
				if (property.emoji) {
					// expression = new RegExp(
					// 	`(?:^|\\s)${escapeRegExp(property.emoji)} ?([^\\s]+)`,
					// );
					expression = RegExp(
						`(?<=^|\\s)${escapeRegExp(property.emoji)} ([^\\s]+)`,
						"u",
					);
				}
		}
		const match = expression?.exec(text);
		if (match) return match;
	}
	return null;
}

export function getTaskProperty(
	taskProperties: SupportedPropertiesConfig[] | undefined,
	key: DEFAULT_TASK_CACHE_KEYS,
): SupportedPropertiesConfig | undefined {
	return taskProperties?.find((property) => property.key === String(key));
}

/**
 * @todo - Move this function inside VaultScanner manager and avoid 
 * calling individual extract functions for the default properties 
 * other than the special default properties.
 * 
 * Function to build a task from raw content
 * @param rawTaskContent - The raw content of the task ONLY.
 * @param filePath - Optional file path where the task is located
 * @returns A partial taskItem object with extracted properties
 */
export function buildTaskFromRawContent(
	rawTaskContent: string,
	indentationString: string,
	filePath?: string,
	settings?: globalSettingsData,
): Partial<taskItemWithCustomProperties> {
	const lines = rawTaskContent.split("\n");
	const firstLine = lines[0] || "";
	const taskProperties = settings?.taskProperties;

	// Default Task Properties
	const taskStatus = extractCheckboxSymbol(lines[0]);
	const title = firstLine;
	const time = extractTime(firstLine, taskProperties);
	const createdDate = extractCreatedDate(firstLine, taskProperties);
	const startDate = extractStartDate(firstLine, taskProperties);
	const scheduledDate = extractScheduledDate(firstLine, taskProperties);
	const due = extractDueDate(firstLine, taskProperties);
	const priority = extractPriority(
		firstLine,
		taskProperties,
		settings?.customPriorities,
	);
	const tags = extractTags(firstLine);
	const completionDate = extractCompletionDate(firstLine, taskProperties);
	const cancelledDate = extractCancelledDate(firstLine, taskProperties);
	const body = extractBody(lines, 1, indentationString);

	// Helper functions
	const parseDateProperty = (
		value: string | undefined,
		key: DEFAULT_TASK_CACHE_KEYS,
	): number | undefined => {
		if (!value) return undefined;
		const property = settings?.taskProperties.find(
			(candidate) => candidate.key === key,
		);
		const type = property?.type ?? PropertyTypeConfig.dateTime;
		if (
			type !== PropertyTypeConfig.date &&
			type !== PropertyTypeConfig.dateTime
		) {
			return undefined;
		}
		const convertedValue = coerceCustomTaskPropertyValue(
			value,
			type,
			type === PropertyTypeConfig.date
				? settings?.dateFormat
				: settings?.dateTimeFormat,
		);
		return typeof convertedValue === "number" ? convertedValue : undefined;
	};

	return {
		...(settings ? extractTaskPropertiesAllTYpe(firstLine, settings) : {}),
		title: title,
		status: taskStatus ?? " ",
		body: body,
		time: time?.[1] ?? "",
		createdDate: parseDateProperty(
			createdDate?.[1],
			DEFAULT_TASK_CACHE_KEYS.CreatedDate,
		),
		startDate: parseDateProperty(
			startDate?.[1],
			DEFAULT_TASK_CACHE_KEYS.StartDate,
		),
		scheduledDate: parseDateProperty(
			scheduledDate?.[1],
			DEFAULT_TASK_CACHE_KEYS.ScheduledDate,
		),
		dueDate: parseDateProperty(due?.[1], DEFAULT_TASK_CACHE_KEYS.DueDate),
		tags: tags,
		priority: priority.value,
		completionDate: parseDateProperty(
			completionDate?.[1],
			DEFAULT_TASK_CACHE_KEYS.CompletionDate,
		),
		cancelledDate: parseDateProperty(
			cancelledDate?.[1],
			DEFAULT_TASK_CACHE_KEYS.CancelledDate,
		),
		filePath: filePath || "",
	};
}

// ------------------------------------------------------------------
// Below helper functions are required to extract few of the default
// task properties which requires some special parsing mechanism.
// ------------------------------------------------------------------

/**
 * Extracts the body of a task from an array of lines. The body is considered as the lines
 * that have indentation (either with '>' or '\t'). Blank lines are kept when more indented
 * content follows them, so multi-paragraph task descriptions stay together; the extraction
 * stops at the first line that does not belong to the task.
 * @param {string[]} lines - The array of lines to extract the body from.
 * @param {number} startLineIndex - The index of the line where the body starts.
 * @param {string} indentationString - The string used to indent the lines.
 * @returns {string[]} An array of strings representing the body of the task. If the body is empty, an empty array is returned.
 */
export function extractBody(
	lines: string[],
	startLineIndex: number,
	indentationString: string,
): string[] {
	const bodyLines: string[] = [];
	const prevLine = lines[startLineIndex - 1];

	let requiredIndent = indentationString;
	if (prevLine?.startsWith(indentationString)) {
		let n = 0;
		let tempLine = prevLine;
		while (tempLine.startsWith(indentationString)) {
			n++;
			tempLine = tempLine.slice(indentationString.length);
		}
		requiredIndent = indentationString.repeat(n + 1);
	}

	// A line belongs to the task body when it is indented one level deeper than
	// the task line itself. Blockquote markers ('> ') are ignored while checking.
	const isBodyLine = (line: string): boolean => {
		const sanitizedLine = line.replace(/^>\s?/, "");
		return (
			sanitizedLine.startsWith(requiredIndent) ||
			sanitizedLine.startsWith("\t")
		);
	};

	for (let index = startLineIndex; index < lines.length; index++) {
		const line = lines[index];

		// Blank lines inside a list item are part of the body as long as more
		// indented content follows them (multi-paragraph task descriptions).
		if (line.trim() === "") {
			let nextNonBlankIndex = index + 1;
			while (
				nextNonBlankIndex < lines.length &&
				lines[nextNonBlankIndex].trim() === ""
			) {
				nextNonBlankIndex++;
			}

			if (
				nextNonBlankIndex < lines.length &&
				isBodyLine(lines[nextNonBlankIndex])
			) {
				bodyLines.push(line);
				continue;
			}
			break;
		}

		if (isBodyLine(line)) {
			bodyLines.push(line);
		} else {
			break;
		}
	}

	// Ignore an all-blank body, but keep leading blank lines so that the number
	// of body lines stays in sync with the physical lines of the file.
	return bodyLines.some((line) => line.trim() !== "") ? bodyLines : [];
}

/**
 * Extracts the time from a checkbox/inline-task line of the note.
 * The time value must be right after the checkbox symbol with the
 * format MM:SS - MM:SS. Spaces are not an issue.
 *
 * @param {string} text - The task string.
 * @returns {string} The extracted time string, or an empty string if no match.
 */
export function extractTimeFromLineStart(
	text: string,
): RegExpMatchArray | null {
	// Check if time is at the start of the task
	const timeAtStartMatch = text
		.trim()
		.match(/^- \[.\]\s*(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})/);

	if (timeAtStartMatch && timeAtStartMatch[1]) {
		// If time is at the start, extract it
		return timeAtStartMatch;
	}

	return null;
}

// Extract priority from task title using RegEx
export function extractPriorityEmoji(
	text: string,
	customPriorities?: CustomPriority[],
): number | undefined {
	const priorities =
		customPriorities ??
		Object.entries(priorityEmojis).map(([rank, emoji]) => ({
			rank: Number(rank),
			emoji,
		}));
	const matches = priorities
		.filter((priority) => priority.emoji)
		.map((priority) => {
			const match = new RegExp(
				`(?:^|\\s)${escapeRegExp(priority.emoji)}(?=\\s|$)`,
			).exec(text);
			return match
				? {
						rank: priority.rank,
						emoji: priority.emoji,
						index: match.index,
					}
				: undefined;
		})
		.filter(
			(match): match is { rank: number; emoji: string; index: number } =>
				match !== undefined,
		)
		.sort((left, right) => left.index - right.index);
	return matches[0]?.rank;
}

// Extract tags from task title
export function extractTags(text: string): string[] {
	text = text.replace(/<(mark|font).*?>/g, ""); // TODO : this might not required, try removing this.
	const matches = text.match(TaskRegularExpressions.hashTagsRegex);
	return matches ? matches.map((tag) => tag.trim().replace("#", "")) : [];
}

/**
 * Extracts the time from a task string.
 * Supports three formats: [time:: 12:00-13:00], @time(12:00-13:00) and ⏰ 12:00 - 13:00.
 * If time is at the start of the task, it is also extracted.
 * @param {string} text - The task string.
 * @returns {string} The extracted time string, or an empty string if no match.
 */
export function extractTime(
	text: string,
	taskProperties?: SupportedPropertiesConfig[],
	format?: taskPropertyFormatOptions,
): RegExpMatchArray | null {
	// First try to find if the time is present at the begining of
	// the task title in the Dayplanner format.
	const timeAtStartMatch = extractTimeFromLineStart(text);
	if (timeAtStartMatch) return timeAtStartMatch;
	const property = getTaskProperty(
		taskProperties,
		DEFAULT_TASK_CACHE_KEYS.Time,
	);

	// NOTE - Not using the universal parsing feature because only time property's
	// value has spaces in them. Hence custom RegExp is required.
	// // If time is not present at the start try parsing using the three formats.
	// const configuredMatch = property
	// 	? matchTaskProperty(text, property, format)
	// 	: null;
	// if (configuredMatch) return configuredMatch;

	return (
		text.match(
			`\\[${escapeRegExp(property?.id ?? "time")}::\\s*(.*?)\\]`,
		) ??
		text.match(
			`\\s*(${property?.emoji ?? TASKS_PLUGIN_DEFAULT_SYMBOLS.duration}\\s*(\\[.*?\\]|(\\d{2}:\\d{2}\\s*-\\s*\\d{2}:\\d{2}))`,
		) ??
		text.match(`@${escapeRegExp(property?.id ?? "time")}\\(([^)]*)\\)`)
	);
}

// Extract priority from task title using RegEx
export function extractPriority(
	text: string,
	taskProperties?: SupportedPropertiesConfig[],
	customPriorities?: CustomPriority[],
	format?: taskPropertyFormatOptions,
): { parsedString: string; value: number } {
	const isEmojiFormat =
		format === undefined ||
		format === taskPropertyFormatOptions.default ||
		format === taskPropertyFormatOptions.tasksPlugin;
	const emojiRank = isEmojiFormat
		? extractPriorityEmoji(text, customPriorities)
		: undefined;
	if (emojiRank !== undefined) {
		const emoji =
			customPriorities?.find((priority) => priority.rank === emojiRank)
				?.emoji ?? priorityEmojis[emojiRank];
		if (emoji) return { parsedString: emoji, value: emojiRank };
	}

	const property = getTaskProperty(
		taskProperties,
		DEFAULT_TASK_CACHE_KEYS.Priority,
	);
	if (property) {
		for (const currentFormat of getPropertyFormatOrder(format)) {
			if (
				currentFormat === taskPropertyFormatOptions.default ||
				currentFormat === taskPropertyFormatOptions.tasksPlugin
			) {
				continue;
			}
			const match = matchTaskProperty(text, property, currentFormat);
			const value = Number(match?.[1]);
			if (match && Number.isFinite(value)) {
				return { parsedString: match[0], value };
			}
		}
	} else {
		const match =
			text.match(
				DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr
					.priorityRegex,
			) ?? text.match(/@priority\(\s*(\d{1,2})\s*\)/);
		if (match) {
			return { parsedString: match[0], value: Number(match[1].trim()) };
		}
	}
	return { parsedString: "", value: 0 };
}

// ------------------------------------------------------------------
// TODO : Below functions are not required, as this same operation 
// can be done using the universal function matchTaskProperty()
// ------------------------------------------------------------------

/**
 * Extracts the task id from a task string by matching the id regex.
 * Supports both Task's plugin and Dataview plugin id formats.
 * @param {string} text - The task string.
 * @returns {RegExpMatchArray} A regular expression array, where [0] 
 * is the extracted string and [1] is the value of the id.
 */
export function extractTaskId(
	text: string,
	taskProperties?: SupportedPropertiesConfig[],
	format?: taskPropertyFormatOptions,
): RegExpMatchArray | null {
	const property = getTaskProperty(
		taskProperties,
		DEFAULT_TASK_CACHE_KEYS.ID,
	);
	if (property) return matchTaskProperty(text, property, format);

	// Fallback to hard-coded property id.
	return (
		text.match(
			TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions.idRegex,
		) ??
		text.match(
			DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.idRegex,
		) ??
		text.match(/@id\(\s*(.*?)\)/)
	);
}

// Extract Created date from task title
export function extractCreatedDate(
	text: string,
	taskProperties?: SupportedPropertiesConfig[],
	format?: taskPropertyFormatOptions,
): RegExpMatchArray | null {
	const property = getTaskProperty(
		taskProperties,
		DEFAULT_TASK_CACHE_KEYS.CreatedDate,
	);
	if (property) return matchTaskProperty(text, property, format);
	return (
		text.match(
			TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
				.createdDateRegex,
		) ??
		text.match(
			DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr
				.createdDateRegex,
		) ??
		text.match(/@created\(\s*([^ ]+)\)/)
	);
}

// Extract Start date from task title
export function extractStartDate(
	text: string,
	taskProperties?: SupportedPropertiesConfig[],
	format?: taskPropertyFormatOptions,
): RegExpMatchArray | null {
	const property = getTaskProperty(
		taskProperties,
		DEFAULT_TASK_CACHE_KEYS.StartDate,
	);
	if (property) return matchTaskProperty(text, property, format);
	return (
		text.match(
			TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
				.startDateRegex,
		) ??
		text.match(
			DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr
				.startDateRegex,
		) ??
		text.match(/@start\(\s*([^ ]+)\)/)
	);
}

// Extract Scheduled date from task title
export function extractScheduledDate(
	text: string,
	taskProperties?: SupportedPropertiesConfig[],
	format?: taskPropertyFormatOptions,
): RegExpMatchArray | null {
	const property = getTaskProperty(
		taskProperties,
		DEFAULT_TASK_CACHE_KEYS.ScheduledDate,
	);
	if (property) return matchTaskProperty(text, property, format);
	return (
		text.match(
			TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
				.scheduledDateRegex,
		) ??
		text.match(
			DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr
				.scheduledDateRegex,
		) ??
		text.match(/@scheduled\(\s*([^ ]+)\)/)
	);
}

// Extract Due date from task title
export function extractDueDate(
	text: string,
	taskProperties?: SupportedPropertiesConfig[],
	format?: taskPropertyFormatOptions,
): RegExpMatchArray | null {
	const property = getTaskProperty(
		taskProperties,
		DEFAULT_TASK_CACHE_KEYS.DueDate,
	);
	if (property) return matchTaskProperty(text, property, format);
	return (
		text.match(
			TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
				.dueDateRegex,
		) ??
		text.match(
			DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.dueDateRegex,
		) ??
		text.match(/@due\(\s*([^ ]+)\)/)
	);
}

export function extractReminder(
	text: string,
	startDate?: string,
	scheduledDate?: string,
	dueDate?: string,
	taskProperties?: SupportedPropertiesConfig[],
	format?: taskPropertyFormatOptions,
): {
	parsedString: string;
	value: string;
} {
	const property = getTaskProperty(
		taskProperties,
		DEFAULT_TASK_CACHE_KEYS.Reminder,
	);
	let match = property
		? matchTaskProperty(text, property, format)
		: (text.match(/\[reminder::\s*(.*?)\]/) ??
			text.match(/@reminder\(\s*(.*?)\s*\)/));
	if (match) {
		return { parsedString: match[0], value: match[1].trim() };
	}

	// This will be enabled, after Tasks plugin will support the reminder property.
	// match = text.match(/🔔\s*(.*?)(?=\s|$)/);
	// if (match) {
	// 	return match[0].replace("🔔", "").trim();
	// }

	// New patterns
	// match = text.match(/\(@(\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?)\)/);
	// if (match) {
	// 	const dateStr = match[1];
	// 	if (dateStr.includes(" ")) {
	// 		const [date, time] = dateStr.split(" ");
	// 		return `${date}T${time}`;
	// 	} else {
	// 		return `${dateStr}T09:00`;
	// 	}
	// }

	match = text.match(/\(@(\d{2}:\d{2})\)/);
	if (match) {
		const baseDate = startDate || scheduledDate || dueDate;
		if (baseDate) {
			return { parsedString: match[0], value: `${baseDate}T${match[1]}` };
		}
	}

	return { parsedString: "", value: "" };
}

/**
 * Extract the dependsOn value from the task title.
 * It will first try to match the regex defined in the Tasks plugin.
 * If not found, it will try to match the [dependsOn:: ...] format.
 * If not found, it will try to match the @dependsOn ... format.
 * If none of the above are found, it will return null.
 * @param {string} text - The task title from which to extract the dependsOn value.
 * @returns {RegExpMatchArray | null} - The extracted dependsOn value, or null if not found.
 */
export function extractDependsOn(
	text: string,
	taskProperties?: SupportedPropertiesConfig[],
	format?: taskPropertyFormatOptions,
): RegExpMatchArray | null {
	const property = getTaskProperty(
		taskProperties,
		DEFAULT_TASK_CACHE_KEYS.Dependencies,
	);
	if (property) return matchTaskProperty(text, property, format);
	return (
		text.match(
			TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
				.dependsOnRegex,
		) ??
		text.match(/\[dependsOn::\s*(.*?)\]/) ??
		text.match(/@dependsOn\(\s*(.*?)\s*\)/)
	);
}

// Extract completion date-time value
export function extractCompletionDate(
	text: string,
	taskProperties?: SupportedPropertiesConfig[],
	format?: taskPropertyFormatOptions,
): RegExpMatchArray | null {
	const property = getTaskProperty(
		taskProperties,
		DEFAULT_TASK_CACHE_KEYS.CompletionDate,
	);
	if (property) return matchTaskProperty(text, property, format);
	return (
		text.match(
			TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
				.doneDateRegex,
		) ??
		text.match(
			DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.doneDateRegex,
		) ??
		text.match(/@completion\(\s*([^ ]+)\)/)
	);
}

export function extractCancelledDate(
	text: string,
	taskProperties?: SupportedPropertiesConfig[],
	format?: taskPropertyFormatOptions,
): RegExpMatchArray | null {
	const property = getTaskProperty(
		taskProperties,
		DEFAULT_TASK_CACHE_KEYS.CancelledDate,
	);
	if (property) return matchTaskProperty(text, property, format);
	return (
		text.match(
			TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
				.cancelledDateRegex,
		) ??
		text.match(
			DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr
				.cancelledDateRegex,
		) ??
		text.match(/@cancelled\(\s*([^ ]+)\)/)
	);
}
