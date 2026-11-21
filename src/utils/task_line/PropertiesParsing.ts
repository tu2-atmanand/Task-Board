import {
	DEFAULT_TASK_CACHE_KEYS,
	PropertyTypeConfig,
	taskPropertyFormatOptions,
} from "../../interfaces/Enums.js";
import { globalSettingsData } from "../../interfaces/GlobalSettings.js";
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
	// propertyKeys?: string[],
): Record<string, CustomTaskPropertyValueType> {
	const result: Record<string, CustomTaskPropertyValueType> = {};
	const specialHandledDefaultProperties = new Set([
		String(DEFAULT_TASK_CACHE_KEYS.Title),
		String(DEFAULT_TASK_CACHE_KEYS.Body),
		String(DEFAULT_TASK_CACHE_KEYS.Status),
		// String(DEFAULT_TASK_CACHE_KEYS.Priority),
		String(DEFAULT_TASK_CACHE_KEYS.Tags),
		String(DEFAULT_TASK_CACHE_KEYS.FilePath),
	]);
	const escapeRegExp = (value: string) =>
		value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

	// Step 1 - Handle all the default properties for which special parsing methods are needed.
	// DEFAULT_TASK_CACHE_KEYS.Time
	const timeFromLineStart = coerceCustomTaskPropertyValue(
		extractTimeFromLineStart(line)?.[0],
		PropertyTypeConfig.time,
	);
	if (timeFromLineStart !== undefined) result[DEFAULT_TASK_CACHE_KEYS.Time];

	// DEFAULT_TASK_CACHE_KEYS.Priority -- Only emoji format, for other formats the function will go below.
	const priorityValue = coerceCustomTaskPropertyValue(
		extractPriorityEmoji(line),
		PropertyTypeConfig.numeric,
	);
	if (priorityValue !== undefined)
		result[DEFAULT_TASK_CACHE_KEYS.Priority] = priorityValue;

	// Step 2 - Extract all the other properties default or custom, which can be extracted using a standard logic.
	for (const property of settings.taskProperties.filter(
		(property) => !property.id,
	)) {
		if (!property.id || specialHandledDefaultProperties.has(property.id))
			continue;
		let expression: RegExp | undefined;
		switch (settings.taskPropertyFormat) {
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
					expression = new RegExp(
						`(?:^|\\s)${escapeRegExp(property.emoji)}\\s+("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|[^\\s]+)`,
					);
				}
		}
		const match = expression?.exec(line);
		if (!match) continue;
		let raw: unknown = match[1].trim();
		if (
			typeof raw === "string" &&
			raw.startsWith('"') &&
			raw.endsWith('"')
		) {
			try {
				raw = JSON.parse(raw) as string;
			} catch {
				raw = match[1].trim().slice(1, -1);
			}
		} else if (
			typeof raw === "string" &&
			raw.startsWith("'") &&
			raw.endsWith("'")
		) {
			raw = raw.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
		}
		const value = coerceCustomTaskPropertyValue(raw, property.type);
		if (value !== undefined) result[property.key] = value;
	}
	return result;
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
	const result: Record<string, CustomTaskPropertyValueType> = {};
	const specialHandledDefaultProperties = new Set([
		String(DEFAULT_TASK_CACHE_KEYS.Title),
		String(DEFAULT_TASK_CACHE_KEYS.Body),
		String(DEFAULT_TASK_CACHE_KEYS.Status),
		// String(DEFAULT_TASK_CACHE_KEYS.Priority),
		String(DEFAULT_TASK_CACHE_KEYS.Tags),
		String(DEFAULT_TASK_CACHE_KEYS.FilePath),
	]);
	const escapeRegExp = (value: string) =>
		value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

	// Step 1 - Handle all the default properties for which special parsing methods are needed.
	// DEFAULT_TASK_CACHE_KEYS.Time
	const timeFromLineStart = coerceCustomTaskPropertyValue(
		extractTimeFromLineStart(line)?.[0],
		PropertyTypeConfig.time,
	);
	if (timeFromLineStart !== undefined) result[DEFAULT_TASK_CACHE_KEYS.Time];

	// DEFAULT_TASK_CACHE_KEYS.Priority -- Only emoji format, for other formats the function will go below.
	const priorityValue = coerceCustomTaskPropertyValue(
		extractPriorityEmoji(line),
		PropertyTypeConfig.numeric,
	);
	if (priorityValue !== undefined)
		result[DEFAULT_TASK_CACHE_KEYS.Priority] = priorityValue;

	// Step 2 - Extract all the other properties default or custom, which can be extracted using a standard logic.
	for (const property of settings.taskProperties.filter(
		(property) => !property.id,
	)) {
		if (!property.id || specialHandledDefaultProperties.has(property.id))
			continue;
		let expression: RegExp | undefined;
		switch (settings.taskPropertyFormat) {
			case taskPropertyFormatOptions.dataviewPlugin:
				break;
			case taskPropertyFormatOptions.obsidianNative:
				break;
			default:
				if (property.emoji) {
				}
		}

		let match: RegExpExecArray | null = null;

		// Try with DATAVIEW format
		const dataViewFormatRegExp = (expression = new RegExp(
			`\\[${escapeRegExp(property.id)}::\\s*([^\\]]*)\\]`,
		));
		match = dataViewFormatRegExp?.exec(line);
		if (!match) {
			// Try with EMOJI format
			const emojiFormatRegExp = new RegExp(
				`(?:^|\\s)${escapeRegExp(property.emoji)}\\s+("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|[^\\s]+)`,
			);
			match = emojiFormatRegExp?.exec(line);
			if (!match) {
				// Try with KANBAN PLUGIN format
				const kanbanPluginFormatRegExp = new RegExp(
					`@${escapeRegExp(property.id)}\\(([^)]*)\\)`,
				);
				match = kanbanPluginFormatRegExp?.exec(line);
			}
		}

		if (!match) continue;
		let raw: unknown = match[1].trim();
		if (
			typeof raw === "string" &&
			raw.startsWith('"') &&
			raw.endsWith('"')
		) {
			try {
				raw = JSON.parse(raw) as string;
			} catch {
				raw = match[1].trim().slice(1, -1);
			}
		} else if (
			typeof raw === "string" &&
			raw.startsWith("'") &&
			raw.endsWith("'")
		) {
			raw = raw.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
		}
		const value = coerceCustomTaskPropertyValue(raw, property.type);
		if (value !== undefined) result[property.key] = value;
	}
	return result;
}

/**
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
	const taskStatus = extractCheckboxSymbol(lines[0]);
	const firstLine = lines[0] || "";
	const title = firstLine; // extractTitle(lines[0]);
	const time = extractTime(firstLine);
	const createdDate = extractCreatedDate(firstLine);
	const startDate = extractStartDate(firstLine);
	const scheduledDate = extractScheduledDate(firstLine);
	const due = extractDueDate(firstLine);
	const priority = extractPriority(firstLine);
	const tags = extractTags(firstLine);
	const completionDate = extractCompletionDate(firstLine);
	const cancelledDate = extractCancelledDate(firstLine);
	const body = extractBody(lines, 1, indentationString);

	return {
		...(settings ? extractTaskPropertiesAllTYpe(firstLine, settings) : {}),
		title: title,
		status: taskStatus ?? " ",
		body: body,
		time: time?.[1] ?? "",
		createdDate: createdDate?.[1] ?? "",
		startDate: startDate?.[1] ?? "",
		scheduledDate: scheduledDate?.[1] ?? "",
		dueDate: due?.[1] ?? "",
		tags: tags,
		priority: priority.value,
		completionDate: completionDate?.[1] ?? "",
		cancelledDate: cancelledDate?.[1] ?? "",
		filePath: filePath || "",
	};
}

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
export function extractPriorityEmoji(text: string): string {
	// Execute the regex to find all priority emoji matches
	const matches =
		text.match(
			TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
				.priorityRegex,
		) || [];

	// Filter out any empty or incorrect values
	const validMatches = matches
		.map((match) => match.trim()) // Trim spaces
		.filter((match) => match.length > 0 && match !== "0"); // Remove empty or zero values

	// Default priority if no emoji is found
	return validMatches[0];
}

// Extract tags from task title
export function extractTags(text: string): string[] {
	text = text.replace(/<(mark|font).*?>/g, ""); // TODO : this might not required, try removing this.
	const matches = text.match(TaskRegularExpressions.hashTagsRegex);
	return matches ? matches.map((tag) => tag.trim().replace("#", "")) : [];
}

// ================================================================
//                         NOTE
// For now keeping all the below functions active, but they need
// to be replaced with a better solution or probably a globalized
// function like {@link extractTaskPropertiesAllTYpe}. Becuase the
// below functions have hard-coded property.id values and do not
// fetch it from the user configured ids from setting.
// ================================================================

// TODO : Update all the below function to accept the property configuration 
// to update the regular expression as per the id and emoji set by the user 
// in settings for that specific property.

/**
 * Extracts the task id from a task string by matching the id regex.
 * Supports both Task's plugin and Dataview plugin id formats.
 * @param {string} text - The task string.
 * @returns {RegExpMatchArray} A regular expression array, where [0] is the extracted string and [1] is the value of the id.
 */
export function extractTaskId(text: string): RegExpMatchArray | null {
	// const combinedIdRegex = new RegExp(
	// 	`(?:${TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions.idRegex.source})|(?:${DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.idRegex.source})`,
	// 	"g" // add the 'g' flag if you want to match all occurrences
	// );
	// let idMatch = text.match(combinedIdRegex);
	// console.log("ID match while scanning :", idMatch);
	// if (idMatch && idMatch[1]) {
	// 	return idMatch;
	// }

	let idMatch = text.match(
		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions.idRegex,
	);
	if (idMatch && idMatch[1]) {
		return idMatch;
	}

	idMatch = text.match(
		DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.idRegex,
	);
	if (idMatch && idMatch[1]) {
		return idMatch;
	}

	idMatch = text.match(/@id\(\s*(.*?)\)/);
	if (idMatch && idMatch[1]) {
		return idMatch;
	}

	return null;
}

/**
 * Extracts the time from a task string.
 * Supports three formats: [time:: 12:00-13:00], @time(12:00-13:00) and ⏰ 12:00-13:00.
 * If time is at the start of the task, it is also extracted.
 * @param {string} text - The task string.
 * @returns {string} The extracted time string, or an empty string if no match.
 */
export function extractTime(text: string): RegExpMatchArray | null {
	let match = text.match(/\[time::\s*(.*?)\]/);
	if (match && match[1]) {
		return match;
	}

	match = text.match(
		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions.durationRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(/@time\((.*?)\)/);
	if (match && match[1]) {
		return match;
	}

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

// Extract Created date from task title
export function extractCreatedDate(text: string): RegExpMatchArray | null {
	let match = text.match(
		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
			.createdDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(
		DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.createdDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(/@created\(\s*([^ ]+)\)/);
	if (match && match[1]) {
		return match;
	}

	return null;
}

// Extract Start date from task title
export function extractStartDate(text: string): RegExpMatchArray | null {
	let match = text.match(
		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
			.startDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(
		DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.startDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(/@start\(\s*([^ ]+)\)/);
	if (match && match[1]) {
		return match;
	}

	return null;
}

// Extract Scheduled date from task title
export function extractScheduledDate(text: string): RegExpMatchArray | null {
	let match = text.match(
		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
			.scheduledDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(
		DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr
			.scheduledDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(/@scheduled\(\s*([^ ]+)\)/);
	if (match && match[1]) {
		return match;
	}

	return null;
}

// Extract Due date from task title
export function extractDueDate(text: string): RegExpMatchArray | null {
	let match = text.match(
		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions.dueDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(
		DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.dueDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(/@due\(\s*([^ ]+)\)/);
	if (match && match[1]) {
		return match;
	}

	return null;
}

// Extract priority from task title using RegEx
export function extractPriority(text: string): {
	parsedString: string;
	value: number;
} {
	// Execute the regex to find all priority emoji matches
	const matches =
		text.match(
			TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
				.priorityRegex,
		) || [];

	// Filter out any empty or incorrect values
	const validMatches = matches
		.map((match) => match.trim()) // Trim spaces
		.filter((match) => match.length > 0 && match !== "0"); // Remove empty or zero values

	// Find the first match in the priorityEmojis mapping
	for (const emoji of validMatches) {
		const priorityMatch = Object.entries(priorityEmojis).find(
			([, value]) => value === emoji,
		);
		if (priorityMatch) {
			return { parsedString: emoji, value: parseInt(priorityMatch[0]) }; // Return the first matching priority
		}
	}

	let match = text.match(
		DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.priorityRegex,
	);
	if (match) {
		return { parsedString: match[0], value: parseInt(match[1].trim()) };
	}

	match = text.match(/@priority\(\s*(\d{1,2})\s*\)/);
	if (match) {
		return { parsedString: match[0], value: parseInt(match[1].trim()) };
	}

	// Default priority if no emoji is found
	return { parsedString: "", value: 0 };
}

export function extractReminder(
	text: string,
	startDate?: string,
	scheduledDate?: string,
	dueDate?: string,
): {
	parsedString: string;
	value: string;
} {
	let match = text.match(/\[reminder::\s*(.*?)\]/);
	if (match) {
		return { parsedString: match[0], value: match[1].trim() };
	}

	match = text.match(/@reminder\(\s*(.*?)\s*\)/);
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
export function extractDependsOn(text: string): RegExpMatchArray | null {
	let match = text.match(
		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
			.dependsOnRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(/\[dependsOn::\s*(.*?)\]/);
	if (match && match[1]) {
		return match;
	}

	match = text.match(/@dependsOn\(\s*(.*?)\s*\)/);
	if (match && match[1]) {
		return match;
	}

	return null;
}

// Extract completion date-time value
export function extractCompletionDate(text: string): RegExpMatchArray | null {
	let match = text.match(
		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions.doneDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(
		DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.doneDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(/@completion\(\s*([^ ]+)\)/);
	if (match && match[1]) {
		return match;
	}

	return null;
}

export function extractCancelledDate(text: string): RegExpMatchArray | null {
	let match = text.match(
		TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
			.cancelledDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(
		DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr
			.cancelledDateRegex,
	);
	if (match && match[1]) {
		return match;
	}

	match = text.match(/@cancelled\(\s*([^ ]+)\)/);
	if (match && match[1]) {
		return match;
	}

	return null;
}
