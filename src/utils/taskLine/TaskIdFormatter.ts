// /src/utils/taskLine/TaskIdFormatter.ts

import { taskPropertyFormatOptions } from "src/interfaces/Enums";

/**
 * Builds the unique ID property snippet in the format configured by the user.
 * @param id - The unique ID to render
 * @param format - The configured task property format
 * @returns The ID property snippet, e.g. `🆔 12`, `[id:: 12]` or `@id(12)`
 */
export const getTaskIdProperty = (id: string, format: string): string => {
	switch (format) {
		case taskPropertyFormatOptions.dataviewPlugin:
			return `[id:: ${id}]`;

		case taskPropertyFormatOptions.obsidianNative:
			return `@id(${id})`;

		case taskPropertyFormatOptions.tasksPlugin:
		case taskPropertyFormatOptions.default:
		default:
			return `🆔 ${id}`;
	}
};

/**
 * Appends the unique ID property at the end of the first line of the given
 * task content. Used by both the interactive editing flows and the bulk
 * ID-injection performed after scanning.
 * @param formattedTaskContent - The task content, whose first line is the task line
 * @param id - The unique ID to append
 * @param format - The configured task property format
 * @returns The task content with the ID property appended
 */
export const appendTaskIdToContent = (
	formattedTaskContent: string,
	id: string,
	format: string,
): string => {
	const property = getTaskIdProperty(id, format);
	return formattedTaskContent.replace(/^(.*?)(\n|$)/, `$1 ${property} $2`);
};
