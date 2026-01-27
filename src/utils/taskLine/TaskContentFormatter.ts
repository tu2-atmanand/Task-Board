// /src/utils/TaskContentFormatter.ts

import TaskBoard from "main";
import {
	extractDependsOn,
	extractPriority,
	extractTaskId,
} from "../../managers/VaultScanner";
import {
	TaskRegularExpressions,
	TASKS_PLUGIN_DEFAULT_SYMBOLS,
} from "src/regularExpressions/TasksPluginRegularExpr";
import { DATAVIEW_PLUGIN_DEFAULT_SYMBOLS } from "src/regularExpressions/DataviewPluginRegularExpr";
import {
	taskPropertyFormatOptions,
	NotificationService,
	taskPropertiesNames,
	UniversalDateOptions,
	statusTypeNames,
} from "src/interfaces/Enums";
import { globalSettingsData } from "src/interfaces/GlobalSettings";
import { priorityEmojis } from "src/interfaces/Mapping";
import { taskItem } from "src/interfaces/TaskItem";
import { cursorLocation } from "src/interfaces/TaskItem";
import { generateTaskId } from "../TaskItemUtils";
import { moment as _moment } from "obsidian";
import { bugReporterManagerInsatance } from "src/managers/BugReporter";

/**
 * Function to get the formatted task content. The content will look similar to how it goes into your notes.
 * @param task - The task item to format.
 * @returns The formatted task content as a string.
 */
export const getFormattedTaskContent = async (
	task: taskItem,
): Promise<string> => {
	if (!task || !task.title) {
		return "";
	}

	// const checkBoxStat = `- [${task.status}]`;
	// let taskLine = `${checkBoxStat} ${task.title}`;

	// Replace the status checkbox in the title with the current status. But only the first occurrence of the /\[(.)\]/ pattern.
	let taskLine = task.title.replace(/\[(.)\]/, `[${task.status}]`);

	// Add the body content, indent each line with a tab (or 4 spaces) for proper formatting
	const bodyLines = task.body
		.map((line: string) => {
			// if (line.startsWith("\t")) {
			// 	return line;
			// } else {
			// 	return `\t${line}`;
			// }
			return line;
		})
		.join("\n");

	const completeTask = `${taskLine}${
		bodyLines.trim() ? `\n${bodyLines}` : ""
	}`;

	return completeTask;
};

/**
 * Add a unique ID to the task content if it doesn't already have one.
 * This function will check if the task content already has an ID. If it does, it will return the same formatted task content.
 * If it doesn't, it will generate a new ID and add it to the task content based on the task format user has configured and return the new formatted task content.
 * @param Plugin - The Taskboard plugin instance.
 * @param formattedTaskContent - The formatted task content to add the ID to.
 * @param forceAddId - If true, force the addition of a new ID even if the task content already has one.
 * @returns A promise that resolves with an object containing the formatted task content and the new ID.
 */
export const addIdToTaskContent = async (
	Plugin: TaskBoard,
	formattedTaskContent: string,
	forcefullyAddId?: boolean,
): Promise<{ formattedTaskContent: string; newId: string | undefined }> => {
	const taskId = extractTaskId(formattedTaskContent);
	let newId = undefined;
	if (
		(!taskId && Plugin.settings.data.globalSettings.autoAddUniqueID) ||
		forcefullyAddId
	) {
		newId = generateTaskId(Plugin);
		const format = Plugin.settings.data.globalSettings.taskPropertyFormat;
		switch (format) {
			case taskPropertyFormatOptions.tasksPlugin:
			case taskPropertyFormatOptions.default:
				formattedTaskContent = formattedTaskContent.replace(
					/^(.*?)(\n|$)/,
					`$1 🆔 ${newId} $2`,
				);
				break;

			case taskPropertyFormatOptions.dataviewPlugin:
				formattedTaskContent = formattedTaskContent.replace(
					/^(.*?)(\n|$)/,
					`$1 [id:: ${newId}] $2`,
				);
				break;

			case taskPropertyFormatOptions.obsidianNative:
				formattedTaskContent = formattedTaskContent.replace(
					/^(.*?)(\n|$)/,
					`$1 @id(${newId}) $2`,
				);
				break;

			default:
				formattedTaskContent = formattedTaskContent.replace(
					/^(.*?)(\n|$)/,
					`$1 🆔 ${newId} $2`,
				);
				break;
		}
	}
	return { formattedTaskContent, newId };
};

/**
 * Returns a formatted task content as a string.
 * If the task is null or has no title, returns an empty string.
 * Replaces the status checkbox in the title with the current status. But only the first occurrence of the /\[(.)\]/ pattern.
 * Adds the body content, indent each line with a tab (or 4 spaces) for proper formatting.
 * @param task - The taskItem object representing the task to format.
 * @returns A string containing the formatted task content.
 */
export const getFormattedTaskContentSync = (task: taskItem): string => {
	if (!task || !task.title) {
		return "";
	}

	// const checkBoxStat = `- [${task.status}]`;
	// let taskLine = `${checkBoxStat} ${task.title}`;

	// Replace the status checkbox in the title with the current status. But only the first occurrence of the /\[(.)\]/ pattern.
	let taskLine = task.title.replace(/\[(.)\]/, `[${task.status}]`);

	// Add the body content, indent each line with a tab (or 4 spaces) for proper formatting
	const bodyLines = task.body
		.map((line: string) => {
			// if (line.startsWith("\t")) {
			// 	return line;
			// } else {
			// 	return `\t${line}`;
			// }
			return line;
		})
		.join("\n");

	const completeTask = `${taskLine}${
		bodyLines.trim() ? `\n${bodyLines}` : ""
	}`;

	return completeTask;
};

/**
 * Function to get the sanitized task content.
 * This function will format the task content based on the latest properties of the task.
 * It will also ensure that the task content is in the correct format and does not contain any old or invalid properties.
 * Do not use this function in batches. It does a lot of regex operations and can be slow for large number of tasks at once.
 * @param plugin - The TaskBoard plugin instance.
 * @param updatedTask - The updated task item.
 * @return The sanitized task content as a string.
 */
export const getSanitizedTaskContent = (
	plugin: TaskBoard,
	updatedTask: taskItem,
): string => {
	// if (updatedTask.title === "") {
	// 	return "";
	// }

	const globalSettings = plugin.settings.data.globalSettings;
	const checkBoxStat = `- [${updatedTask.status}]`;

	// TODO : Sanitizations not only correcting the format and replacing the old content with the latest one, but also very important is to clean if any old properties are there.

	// Sanitize all the properties from the task title
	let updatedTitle = updatedTask.title;
	updatedTitle = sanitizePriority(
		globalSettings,
		updatedTitle,
		updatedTask.priority,
	);

	updatedTitle = sanitizeTime(globalSettings, updatedTitle, updatedTask.time);

	updatedTitle = sanitizeCreatedDate(
		globalSettings,
		updatedTitle,
		updatedTask.createdDate,
	);

	updatedTitle = sanitizeStartDate(
		globalSettings,
		updatedTitle,
		updatedTask.startDate,
	);

	updatedTitle = sanitizeScheduledDate(
		globalSettings,
		updatedTitle,
		updatedTask.scheduledDate,
	);

	updatedTitle = sanitizeDueDate(
		globalSettings,
		updatedTitle,
		updatedTask.due,
	);

	updatedTitle = sanitizeTags(
		updatedTitle,
		updatedTask.tags,
		updatedTask.tags || [],
	);

	updatedTitle = sanitizeReminder(
		globalSettings,
		updatedTitle,
		updatedTask?.reminder || "",
	);

	updatedTitle = sanitizeCompletionDate(
		globalSettings,
		updatedTitle,
		updatedTask.completion || "",
	);

	updatedTitle = sanitizeCancelledDate(
		globalSettings,
		updatedTitle,
		updatedTask.cancelledDate || "",
	);

	// Build the formatted string for the main task
	let formattedTask = `${checkBoxStat} ${updatedTitle}`;

	// Add the body content, indent each line with a tab (or 4 spaces) for proper formatting
	const bodyLines = updatedTask.body
		.map((line: string) => {
			// if (line.startsWith("\t")) {
			// 	return line;
			// } else {
			// 	return `\t${line}`;
			// }
			return line;
		})
		.join("\n");

	const completeTask = `${formattedTask}${
		bodyLines.trim() ? `\n${bodyLines}` : ""
	}`;

	return completeTask;
};

/**
 * Sanitizes the status value of a task by replacing the old status value with a new one.
 * If there is an issue with extracting the old status value, the old title value is returned as it is.
 * @param {string} oldTitle - The old task title.
 * @param {string} newStatusSymbol - The new status value to replace with.
 * @param {string} newStatusType - Based on this type, will decide whether to add a completion and cancelled date or remove it from the title.
 * @returns {string} The sanitized task title with the new status value.
 */
export const sanitizeStatus = (
	globalSettings: globalSettingsData,
	oldTitle: string,
	newStatusSymbol: string,
	newStatusType: string,
): string => {
	const oldStatusValuematch = oldTitle.match(/\[(.)\]/); // Extract the symbol inside [ ]
	let newTitle = oldTitle;
	if (!oldStatusValuematch || oldStatusValuematch.length < 2) {
		bugReporterManagerInsatance.addToLogs(
			106,
			`Status symbol not found in the following oldTtitle : ${oldTitle}`,
			"TaskContentFormatter.ts/sanitizeStatus",
		);
		return oldTitle;
	}

	newTitle = oldTitle.replace(oldStatusValuematch[0], `[${newStatusSymbol}]`);

	if (newStatusType === statusTypeNames.DONE) {
		const moment = _moment as unknown as typeof _moment.default;
		const currentDateValue = moment().format(
			globalSettings?.taskCompletionDateTimePattern,
		);
		newTitle = sanitizeCompletionDate(
			globalSettings,
			newTitle,
			currentDateValue,
		);
	} else if (newStatusType === statusTypeNames.CANCELLED) {
		const moment = _moment as unknown as typeof _moment.default;
		const currentDateValue = moment().format(
			globalSettings?.taskCompletionDateTimePattern,
		);
		newTitle = sanitizeCancelledDate(
			globalSettings,
			newTitle,
			currentDateValue,
		);
	} else {
		newTitle = sanitizeCancelledDate(globalSettings, newTitle, "");
		newTitle = sanitizeCompletionDate(globalSettings, newTitle, "");
	}

	return newTitle;
};

/**
 * Function to sanitize the created date inside the task title.
 * @param globalSettings - The global settings data.
 * @param title  - The title of the task.
 * @param createdDate - The new created date. Only single format supported right now. (YYYY-MM-dd)
 * @param cursorLocation - (Optional) The cursor location to insert the created date at a specific position.
 * @returns The sanitized created date string to be used in the task title.
 */
export const sanitizeCreatedDate = (
	globalSettings: globalSettingsData,
	title: string,
	createdDate: string,
	cursorLocation?: cursorLocation,
): string => {
	const createdDateRegex =
		/➕\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[created::\s*?\d{4}-\d{2}-\d{2}\]|@created\(\d{4}-\d{2}-\d{2}\)/;
	const extractedCreatedDateMatch = title.match(createdDateRegex);

	// If user has removed the created date, remove it from the title inside the note.
	if (!createdDate) {
		if (extractedCreatedDateMatch) {
			// If created date is empty, remove any existing due date
			return title.replace(extractedCreatedDateMatch[0], "").trim();
		}
		return title;
	}

	let createdDateWithFormat: string = "";
	if (createdDate) {
		if (globalSettings?.taskPropertyFormat === "1") {
			createdDateWithFormat = createdDate ? `➕${createdDate}` : "";
		} else if (globalSettings?.taskPropertyFormat === "2") {
			createdDateWithFormat = createdDate ? `➕ ${createdDate}` : "";
		} else if (globalSettings?.taskPropertyFormat === "3") {
			createdDateWithFormat = createdDate
				? `[created:: ${createdDate}]`
				: "";
		} else {
			createdDateWithFormat = createdDate
				? `@created(${createdDate})`
				: "";
		}
	}

	if (!extractedCreatedDateMatch) {
		if (cursorLocation?.lineNumber === 1) {
			// Insert createdDateWithFormat at the specified charIndex with spaces
			const spaceBefore =
				title.slice(0, cursorLocation.charIndex).trim() + " ";
			const spaceAfter =
				" " + title.slice(cursorLocation.charIndex).trim();
			return `${spaceBefore}${createdDateWithFormat}${spaceAfter}`;
		}
		// No existing created date found, append new one at the end
		return `${title} ${createdDateWithFormat}`;
	}

	const extractedCreatedDate = extractedCreatedDateMatch[0];

	if (extractedCreatedDate.includes(createdDateWithFormat)) {
		// If extracted created date matches the new one, no need to change
		return title;
	}

	// Replace the old created date with the updated one
	return title.replace(createdDateRegex, createdDateWithFormat);
};

/**
 * Function to sanitize the start date inside the task title.
 * @param globalSettings - The global settings data.
 * @param title  - The title of the task.
 * @param startDate - The start date of the task.
 * @param cursorLocation - (Optional) The cursor location to insert the start date at a specific position.
 * @returns The sanitized start date string to be used in the task title.
 */
export const sanitizeStartDate = (
	globalSettings: globalSettingsData,
	title: string,
	startDate: string,
	cursorLocation?: cursorLocation,
): string => {
	const startDateRegex =
		/🛫\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[start::\s*?\d{4}-\d{2}-\d{2}\]|@start\(\d{4}-\d{2}-\d{2}\)/;
	const extractedStartDateMatch = title.match(startDateRegex);

	// If user has removed the created date, remove it from the title inside the note.
	if (!startDate) {
		if (extractedStartDateMatch) {
			// If created date is empty, remove any existing due date
			return title.replace(extractedStartDateMatch[0], "").trim();
		}
		return title;
	}

	let startDateWithFormat: string = "";
	if (startDate) {
		if (globalSettings?.taskPropertyFormat === "1") {
			startDateWithFormat = startDate ? `🛫${startDate}` : "";
		} else if (globalSettings?.taskPropertyFormat === "2") {
			startDateWithFormat = startDate ? `🛫 ${startDate}` : "";
		} else if (globalSettings?.taskPropertyFormat === "3") {
			startDateWithFormat = startDate ? `[start:: ${startDate}]` : "";
		} else {
			startDateWithFormat = startDate ? `@start(${startDate})` : "";
		}
	}

	if (!extractedStartDateMatch) {
		if (cursorLocation?.lineNumber === 1) {
			// Insert startDateWithFormat at the specified charIndex with spaces
			const spaceBefore =
				title.slice(0, cursorLocation.charIndex).trim() + " ";
			const spaceAfter =
				" " + title.slice(cursorLocation.charIndex).trim();
			return `${spaceBefore}${startDateWithFormat}${spaceAfter}`;
		}
		// No existing created date found, append new one at the end
		return `${title} ${startDateWithFormat}`;
	}

	const extractedStartDate = extractedStartDateMatch[0];

	if (extractedStartDate.includes(startDateWithFormat)) {
		// If extracted created date matches the new one, no need to change
		return title;
	}

	// Replace the old created date with the updated one
	return title.replace(startDateRegex, startDateWithFormat);
};

/**
 * Function to sanitize the tags inside the task title.
 * @param globalSettings - The global settings data.
 * @param title - The title of the task.
 * @param scheduledDate - The scheduled date of the task.
 * @param cursorLocation - (Optional) The cursor location to insert the scheduled date at a specific position.
 * @returns The sanitized scheduled date string to be used in the task title.
 */
export const sanitizeScheduledDate = (
	globalSettings: globalSettingsData,
	title: string,
	scheduledDate: string,
	cursorLocation?: cursorLocation,
): string => {
	const scheduledDateRegex =
		/⏳\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[scheduled::\s*?\d{4}-\d{2}-\d{2}\]|@scheduled\(\d{4}-\d{2}-\d{2}\)/;
	const extractedScheduledDateMatch = title.match(scheduledDateRegex);

	// If user has removed the scheduled date, remove it from the title inside the note.
	if (!scheduledDate) {
		if (extractedScheduledDateMatch) {
			// If scheduled date is empty, remove any existing due date
			return title.replace(extractedScheduledDateMatch[0], "").trim();
		}
		return title;
	}

	let scheduledDateWithFormat: string = "";
	if (scheduledDate) {
		if (globalSettings?.taskPropertyFormat === "1") {
			scheduledDateWithFormat = scheduledDate ? `⏳${scheduledDate}` : "";
		} else if (globalSettings?.taskPropertyFormat === "2") {
			scheduledDateWithFormat = scheduledDate
				? `⏳ ${scheduledDate}`
				: "";
		} else if (globalSettings?.taskPropertyFormat === "3") {
			scheduledDateWithFormat = scheduledDate
				? `[scheduled:: ${scheduledDate}]`
				: "";
		} else {
			scheduledDateWithFormat = scheduledDate
				? `@scheduled(${scheduledDate})`
				: "";
		}
	}

	if (!extractedScheduledDateMatch) {
		if (cursorLocation?.lineNumber === 1) {
			// Insert scheduledDateWithFormat at the specified charIndex with spaces
			const spaceBefore =
				title.slice(0, cursorLocation.charIndex).trim() + " ";
			const spaceAfter =
				" " + title.slice(cursorLocation.charIndex).trim();
			return `${spaceBefore}${scheduledDateWithFormat}${spaceAfter}`;
		}
		// No existing scheduled date found, append new one at the end
		return `${title} ${scheduledDateWithFormat}`;
	}

	const extractedScheduledDate = extractedScheduledDateMatch[0];

	if (extractedScheduledDate.includes(scheduledDateWithFormat)) {
		// If extracted scheduled date matches the new one, no need to change
		return title;
	}

	// Replace the old scheduled date with the updated one
	return title.replace(scheduledDateRegex, scheduledDateWithFormat);
};

/**
 * Function to sanitize the tags inside the task title.
 * @param globalSettings - The global settings data.
 * @param title - The title of the task.
 * @param dueDate - The due date of the task. Only one format supported right now. (YYYY-mm-dd)
 * @param cursorLocation - (Optional) The cursor location to insert the due date at a specific position.
 * @returns The sanitized due date string to be used in the task title.
 */
export const sanitizeDueDate = (
	globalSettings: globalSettingsData,
	title: string,
	dueDate: string,
	cursorLocation?: cursorLocation,
): string => {
	const dueDateRegex =
		/📅\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[due::\s*?\d{4}-\d{2}-\d{2}\]|@due\(\d{4}-\d{2}-\d{2}\)/;
	const extractedDueDateMatch = title.match(dueDateRegex);
	// console.log("extractedDueDateMatch", extractedDueDateMatch);

	// If user has removed the due date, remove it from the title inside the note.
	if (!dueDate) {
		if (extractedDueDateMatch) {
			// If due date is empty, remove any existing due date
			return title.replace(extractedDueDateMatch[0], "").trim();
		}
		return title;
	}

	let dueDateWithFormat: string = "";
	if (dueDate) {
		if (globalSettings?.taskPropertyFormat === "1") {
			dueDateWithFormat = dueDate ? `📅${dueDate}` : "";
		} else if (globalSettings?.taskPropertyFormat === "2") {
			dueDateWithFormat = dueDate ? `📅 ${dueDate}` : "";
		} else if (globalSettings?.taskPropertyFormat === "3") {
			dueDateWithFormat = dueDate ? `[due:: ${dueDate}]` : "";
		} else {
			dueDateWithFormat = dueDate ? `@due(${dueDate})` : "";
		}
	}

	if (!extractedDueDateMatch) {
		if (cursorLocation?.lineNumber === 1) {
			// Insert createdDateWithFormat at the specified charIndex with spaces
			const spaceBefore =
				title.slice(0, cursorLocation.charIndex).trim() + " ";
			const spaceAfter =
				" " + title.slice(cursorLocation.charIndex).trim();
			return `${spaceBefore}${dueDateWithFormat}${spaceAfter}`;
		}
		// No existing created date found, append new one at the end
		return `${title} ${dueDateWithFormat}`;
	}

	const extractedDueDate = extractedDueDateMatch[0];

	if (extractedDueDate.includes(dueDateWithFormat)) {
		// If extracted due date matches the new one, no need to change
		return title;
	}

	// Replace the old due date with the updated one
	return title.replace(dueDateRegex, dueDateWithFormat);
};

/**
 * Function to sanitize the completion date inside the task title.
 * @param globalSettings - The global settings data.
 * @param title - The title of the task.
 * @param completionDate - The completion date of the task. Only one format supported right now. (YYYY-mm-dd)
 * @param cursorLocation - (Optional) The cursor location to insert the completion date at a specific position.
 * @returns The sanitized completion date string to be used in the task title.
 */
export const sanitizeCompletionDate = (
	globalSettings: globalSettingsData,
	title: string,
	completionDate: string,
	cursorLocation?: cursorLocation,
): string => {
	const completionDateRegex =
		/\[completion::[^\]]+\]|\@completion\(.*?\)|✅\s*.*?(?=\s|$)/;
	const extractedCompletionDateMatch = title.match(completionDateRegex);

	if (!completionDate) {
		// If completion date is empty, remove any existing completion date
		if (extractedCompletionDateMatch) {
			return title.replace(extractedCompletionDateMatch[0], "").trim();
		}
		return title;
	}

	let completedWitFormat: string = "";
	if (completionDate) {
		if (globalSettings?.taskPropertyFormat === "1") {
			completedWitFormat = completionDate ? `✅${completionDate} ` : "";
		} else if (globalSettings?.taskPropertyFormat === "2") {
			completedWitFormat = completionDate ? `✅ ${completionDate} ` : "";
		} else if (globalSettings?.taskPropertyFormat === "3") {
			completedWitFormat = completionDate
				? `[completion:: ${completionDate}] `
				: "";
		} else {
			completedWitFormat = completionDate
				? `@completion(${completionDate}) `
				: "";
		}
	}

	if (!extractedCompletionDateMatch) {
		if (cursorLocation?.lineNumber === 1) {
			// Insert completedWitFormat at the specified charIndex with spaces
			const spaceBefore =
				title.slice(0, cursorLocation.charIndex).trim() + " ";
			const spaceAfter =
				" " + title.slice(cursorLocation.charIndex).trim();
			return `${spaceBefore}${completedWitFormat}${spaceAfter}`;
		}
		// No existing completion date found, append new one at the end
		return `${title} ${completedWitFormat}`;
	}

	const extractedCompletionDate = extractedCompletionDateMatch[0];

	if (extractedCompletionDate.includes(completedWitFormat)) {
		// If extracted completion date matches the new one, no need to change
		return title;
	}

	// Replace the old completion date with the updated one
	return title.replace(completionDateRegex, completedWitFormat);
};

/**
 * Function to sanitize the cancellation date inside the task title.
 * @param globalSettings - The global settings data.
 * @param title - The title of the task.
 * @param cancelledDate - The cancellation date of the task. Only one format supported right now. (YYYY-mm-dd)
 * @param cursorLocation - (Optional) The cursor location to insert the cancellation date at a specific position.
 * @returns The sanitized cancellation date string to be used in the task title.
 */
export const sanitizeCancelledDate = (
	globalSettings: globalSettingsData,
	title: string,
	cancelledDate: string,
	cursorLocation?: cursorLocation,
): string => {
	const cancellationDateRegex =
		/❌\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[cancelled::\s*?\d{4}-\d{2}-\d{2}\]|@cancelled\(\d{4}-\d{2}-\d{2}\)/;
	const extractedCancellationDateMatch = title.match(cancellationDateRegex);

	if (!cancelledDate) {
		// If cancellation date is empty, remove any existing cancellation date
		if (extractedCancellationDateMatch) {
			return title.replace(extractedCancellationDateMatch[0], "").trim();
		}
		return title;
	}

	let cancelledWithFormat: string = "";
	if (cancelledDate) {
		if (globalSettings?.taskPropertyFormat === "1") {
			cancelledWithFormat = cancelledDate ? `❌${cancelledDate}` : "";
		} else if (globalSettings?.taskPropertyFormat === "2") {
			cancelledWithFormat = cancelledDate ? `❌ ${cancelledDate}` : "";
		} else if (globalSettings?.taskPropertyFormat === "3") {
			cancelledWithFormat = cancelledDate
				? `[cancelled:: ${cancelledDate}]`
				: "";
		} else {
			cancelledWithFormat = cancelledDate
				? `@cancelled(${cancelledDate})`
				: "";
		}
	}

	if (!extractedCancellationDateMatch) {
		if (cursorLocation?.lineNumber === 1) {
			// Insert cancelledWithFormat at the specified charIndex with spaces
			const spaceBefore =
				title.slice(0, cursorLocation.charIndex).trim() + " ";
			const spaceAfter =
				" " + title.slice(cursorLocation.charIndex).trim();
			return `${spaceBefore}${cancelledWithFormat}${spaceAfter}`;
		}
		// No existing cancellation date found, append new one at the end
		return `${title} ${cancelledWithFormat}`;
	}

	const extractedCancellationDate = extractedCancellationDateMatch[0];

	if (extractedCancellationDate.includes(cancelledWithFormat)) {
		// If extracted cancellation date matches the new one, no need to change
		return title;
	}

	// Replace the old cancellation date with the updated one
	return title.replace(cancellationDateRegex, cancelledWithFormat);
};

/**
 * Function to sanitize the time inside the task title.
 * @param globalSettings - The global settings data.
 * @param title - The title of the task.
 * @param newTime - The new time to be sanitized and added to the title.
 * @param cursorLocation - (Optional) The cursor location to insert the time at a specific position.
 * @returns The sanitized title with updated time value.
 */
export const sanitizeTime = (
	globalSettings: globalSettingsData,
	title: string,
	newTime: string,
	cursorLocation?: cursorLocation,
): string => {
	const timeAtStartRegex = /]\s*(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})/;
	const timeFormatsRegex =
		/\s*(⏰\s*(\[.*?\]|(\d{2}:\d{2}\s*-\s*\d{2}:\d{2}))|\[time::(.*?)\]|@time\((.*?)\))/g; // Match all three formats

	// Match both the time formats
	const timeAtStartMatch = title.match(timeAtStartRegex);
	// const timeFormatMatch = title.match(timeFormatsRegex);

	let timeFormatMatch: string[] | null = null;
	let match = timeFormatsRegex.exec(title);
	if (match) {
		timeFormatMatch = [];
		timeFormatMatch.push(match[0].trim()); // original match
		timeFormatMatch.push(match[3] || match[4] || match[5]); // extracted time range
	}

	// If newtime is empty, that means, either time was not present from initially, or it has been removed now in the modal.
	if (newTime === "") {
		if (timeAtStartMatch) {
			return title.replace(timeAtStartMatch[1], "").trim();
		}

		if (timeFormatMatch) {
			return title.replace(timeFormatMatch[0], "").trim();
		}

		return title;
	}

	// If dayPlanner plugin compatibility is enabled then place the time value at the start of the title only.
	if (globalSettings.compatiblePlugins.dayPlannerPlugin) {
		if (timeAtStartMatch) {
			// If time is at the start of the title, replace it
			return title.replace(timeAtStartMatch[1], newTime);
		}

		if (timeFormatMatch) {
			// If time is present in any format, remove it and add this new time at the start
			title = title.replace(timeFormatsRegex, "").trim();
		}

		// If no time is present, add it at the start
		const beforePosition = title.slice(0, 5).trim();
		const afterPosition = title.slice(5).trim();
		return `${beforePosition} ${newTime} ${afterPosition}`;
	} else {
		let newTimeWithFormat: string = "";
		if (globalSettings.taskPropertyFormat === "1") {
			newTimeWithFormat = `⏰[${newTime}]`;
		} else if (globalSettings.taskPropertyFormat === "2") {
			newTimeWithFormat = `⏰ ${newTime}`;
		} else if (globalSettings.taskPropertyFormat === "3") {
			newTimeWithFormat = `[time:: ${newTime}]`;
		} else {
			newTimeWithFormat = `@time(${newTime})`;
		}

		// Remove the time from the beginning of the title
		if (timeAtStartMatch) {
			title.replace(timeAtStartMatch[1], "");
		}

		if (timeFormatMatch) {
			return title.replace(timeFormatMatch[0], newTimeWithFormat);
		}

		if (cursorLocation?.lineNumber === 1) {
			const titleWithStar =
				title.slice(0, cursorLocation.charIndex) +
				"*" +
				title.slice(cursorLocation.charIndex);
			// Insert newTimeWithFormat at the specified charIndex with spaces
			const spaceBefore = title.slice(0, cursorLocation.charIndex).trim();
			const spaceAfter = title.slice(cursorLocation.charIndex).trim();

			return `${spaceBefore} ${newTimeWithFormat} ${spaceAfter}`;
		}

		// If no time is present, append it at the end
		return `${title} ${newTimeWithFormat} `;
	}
};

// TODO : This is the only thing remaining, I might have to avoid sanitizing this, as it might create duplicates. Just adding it as the property of the task which will be only visible in the task board.
/**
 * Function to sanitize the priority inside the task title.
 * @param globalSettings - The global settings data.
 * @param title - The title of the task.
 * @param newPriority - The new priority to be sanitized and added to the title.
 * @param cursorLocation - (Optional) The cursor location to insert the priority at a specific position.
 * @returns The sanitized priority string to be used in the task title.
 */
export const sanitizePriority = (
	globalSettings: globalSettingsData,
	title: string,
	newPriority: number,
	cursorLocation?: cursorLocation,
): string => {
	// // Create a regex pattern to match any priority emoji
	// const emojiPattern = new RegExp(
	// 	`(${Object.values(priorityEmojis)
	// 		.map((emoji) => `\\s*${emoji}\\s*`)
	// 		.join("|")})`,
	// 	"g"
	// );

	// // Execute the regex to find all emojis in the text
	// const extractedPriorityMatch = title.match(emojiPattern);
	// console.log("extractedPriorityMatch", extractedPriorityMatch);

	// // If no priority emoji exists, append the new priority at the end
	// if (!extractedPriorityMatch) {
	// 	return newPriority > 0
	// 		? `${title} ${priorityEmojis[newPriority]}`
	// 		: title;
	// }

	// // Check if all extracted values are zero ("0")
	// const allZero = extractedPriorityMatch.every((item) => item.trim() === "0");

	// if (allZero) {
	// 	// If all elements are zero, append new priority emoji at the end
	// 	return newPriority > 0
	// 		? `${title} ${priorityEmojis[newPriority]}`
	// 		: title;
	// }

	// // Find the first **non-zero** valid priority emoji from extracted matches
	// const extractedPriority = extractedPriorityMatch.find((emoji) =>
	// 	Object.values(priorityEmojis).includes(emoji.trim())
	// );
	// console.log(
	// 	"extractedPriority : first **non-zero** valid priority emoji",
	// 	extractedPriority
	// );

	// // If no valid priority emoji is found, append the new one
	// if (!extractedPriority) {
	// 	return newPriority > 0
	// 		? `${title} ${priorityEmojis[newPriority]}`
	// 		: title;
	// }

	// // If extracted priority matches the new one, return the title as is
	// if (extractedPriority.trim() === priorityEmojis[newPriority]) {
	// 	return title;
	// }

	// // Replace the old priority emoji with the new one
	// return title
	// 	.replace(
	// 		extractedPriority,
	// 		newPriority > 0 ? priorityEmojis[newPriority] : ""
	// 	)
	// 	.trim();

	const extractedPriorityMatch = extractPriority(title);

	if (extractedPriorityMatch === 0) {
		if (newPriority > 0) {
			let priorityWithFormat: string = "";
			if (globalSettings?.taskPropertyFormat === "3") {
				priorityWithFormat = `[priority:: ${newPriority}]`;
			} else if (globalSettings?.taskPropertyFormat === "4") {
				priorityWithFormat = `@priority(${newPriority})`;
			} else {
				priorityWithFormat = priorityEmojis[newPriority];
			}

			if (cursorLocation?.lineNumber === 1) {
				// Insert priorityWithFormat at the specified charIndex with spaces
				const spaceBefore =
					title.slice(0, cursorLocation.charIndex).trim() + " ";
				const spaceAfter =
					" " + title.slice(cursorLocation.charIndex).trim();
				return `${spaceBefore}${priorityWithFormat}${spaceAfter}`;
			}

			return `${title} ${priorityWithFormat}`;
		}
		return title;
	}

	let match = title.match(
		new RegExp(`\\[priority::\\s*${extractedPriorityMatch}\\s*\\]`),
	);
	if (match) {
		return newPriority > 0
			? title.replace(match[0], `[priority:: ${newPriority}]`)
			: title.replace(match[0], "");
	}

	match = title.match(
		new RegExp(`@priority\\(\\s*${extractedPriorityMatch}\\s*\\)`),
	);
	if (match) {
		return newPriority > 0
			? title.replace(match[0], `@priority(${newPriority})`)
			: title.replace(match[0], "");
	}

	// This part is where only the last left format of emojies will be handled.
	if (extractedPriorityMatch === newPriority) {
		return title;
	} else {
		return title.replace(
			priorityEmojis[extractedPriorityMatch],
			priorityEmojis[newPriority],
		);
	}
};

/**
 * Function to sanitize tags inside the task title.
 * @param title - The title of the task.
 * @param oldTagsList - The list of old tags currently present (with #).
 * @param newTagsList - The updated list of tags that should exist (with #).
 * @param cursorLocation - (Optional) Cursor location for insertion.
 * @returns The sanitized title with correct tags.
 */
export const sanitizeTags = (
	title: string,
	oldTagsList: string[],
	newTagsList: string[],
	cursorLocation?: cursorLocation,
): string => {
	console.log(
		"sanitizeTags...\ntitle: ",
		title,
		"\noldTagsList: ",
		oldTagsList,
		"\nnewTagsList: ",
		newTagsList,
		"\ncursorLocation: ",
		cursorLocation,
	);
	// Remove <mark> and <font> tags before processing
	let updatedTitle = title;
	const tempTitle = title.replace(/<(mark|font).*?>/g, "");

	// Regex to extract tags from title
	const tagsRegex = /\s+#([^\s!@#$%^&*()+=;:'"?<>{}[\]-]+)(?=\s|$)/g;
	const extractedTags = (tempTitle.match(tagsRegex) || []).map((t) =>
		t.trim(),
	);

	// const oldTagSet = new Set(oldTagsList.map((t) => t.trim()));
	const newTagSet = new Set(newTagsList.map((t) => t.trim()));
	const extractedTagsSet = new Set(extractedTags.map((t) => t.trim()));

	// --------------------------------------------------
	// 1. REMOVE TAGS THAT NO LONGER EXIST
	// --------------------------------------------------
	for (const tag of extractedTags) {
		if (!newTagSet.has(tag)) {
			updatedTitle = updatedTitle.replace(tag, "").trim();
		}
	}

	// --------------------------------------------------
	// 2. FIND TAGS THAT NEED TO BE ADDED
	// --------------------------------------------------
	const tagsToAdd: string[] = [];
	for (const tag of newTagSet) {
		if (!extractedTagsSet.has(tag)) {
			tagsToAdd.push(tag);
		}
	}

	// --------------------------------------------------
	// 3. INSERT / APPEND NEW TAGS
	// --------------------------------------------------
	if (tagsToAdd.length > 0) {
		if (cursorLocation?.lineNumber === 1) {
			// Insert at cursor position (preserves your original behavior)
			const before = updatedTitle
				.slice(0, cursorLocation.charIndex)
				.trim();
			const after = updatedTitle.slice(cursorLocation.charIndex).trim();

			updatedTitle = [before, ...tagsToAdd, after]
				.filter(Boolean)
				.join(" ");
		} else {
			// Append all new tags at the end
			for (const tag of tagsToAdd) {
				if (!updatedTitle.includes(tag)) {
					updatedTitle += ` ${tag}`;
				}
			}
		}
	}

	return updatedTitle.replace(/\s+/g, " ").trim();
};

/**
 * Function to sanitize the reminder inside the task title.
 * @param globalSettings - The global settings data.
 * @param title - The title of the task.
 * @param newReminder - The new reminder to be sanitized and added to the title. Must be in the format "YYYY-MM-ddTHH:mm".
 * @param cursorLocation - (Optional) The cursor location to insert the reminder at a specific position.
 * @returns The sanitized reminder string to be used in the task title.
 */
export const sanitizeReminder = (
	globalSettings: globalSettingsData,
	title: string,
	newReminder: string,
	cursorLocation?: cursorLocation,
): string => {
	const formatReminder = (reminder: string) => {
		const date = new Date(reminder);
		if (
			globalSettings.notificationService ===
				NotificationService.ReminderPlugin ||
			globalSettings.notificationService ===
				NotificationService.NotifianApp
		) {
			return `(@${date.getFullYear().toString().padStart(4, "0")}-${(
				date.getMonth() + 1
			)
				.toString()
				.padStart(2, "0")}-${date
				.getDate()
				.toString()
				.padStart(2, "0")} ${date
				.getHours()
				.toString()
				.padStart(2, "0")}:${date
				.getMinutes()
				.toString()
				.padStart(2, "0")})`;
		} else if (
			globalSettings.notificationService === NotificationService.ObsidApp
		) {
			return `(@${date.getHours().toString().padStart(2, "0")}:${date
				.getMinutes()
				.toString()
				.padStart(2, "0")})`;
		}
		return "";
	};

	const reminderRegex =
		globalSettings.notificationService === NotificationService.ObsidApp
			? /\(\@\d{2}:\d{2}\)/
			: /\(\@\d{4}-\d{2}-\d{2} \d{2}:\d{2}\)/;

	if (!newReminder) {
		return title.replace(reminderRegex, "").trim();
	}

	const formattedReminder = formatReminder(newReminder);
	if (title.includes(formattedReminder)) {
		return title;
	}

	const existingReminderMatch = title.match(reminderRegex);
	if (existingReminderMatch) {
		return title.replace(reminderRegex, formattedReminder);
	}

	if (cursorLocation?.lineNumber === 1) {
		// Insert formattedReminder at the specified charIndex with spaces
		const spaceBefore =
			title.slice(0, cursorLocation.charIndex).trim() + " ";
		const spaceAfter = " " + title.slice(cursorLocation.charIndex).trim();
		return `${spaceBefore}${formattedReminder}${spaceAfter}`;
	}
	// If no existing reminder found, append new one at the end
	return `${title} ${formattedReminder}`;
};

/**
 * Sanitizes the "dependsOn" section of the task title.
 * @param globalSettings - The global settings data.
 * @param title - The title of the task.
 * @param dependesOnIds - The IDs of the tasks that this task depends on.
 * @param cursorLocation - (Optional) The cursor location to insert the dependsOn at a specific position.
 * @returns The sanitized title string with the updated "dependsOn" section.
 */
export const sanitizeDependsOn = (
	globalSettings: globalSettingsData,
	title: string,
	dependesOnIds: string[],
	cursorLocation?: cursorLocation,
): string => {
	const extractedDependsOnMatch = extractDependsOn(title);

	if (!dependesOnIds || dependesOnIds.length === 0) {
		if (extractedDependsOnMatch) {
			// If dependsOnIds is empty, remove any existing dependsOn
			return title.replace(extractedDependsOnMatch[0], "").trim();
		}
		return title;
	} else {
		let dependsOnFormat: string = "";
		if (globalSettings?.taskPropertyFormat === "1") {
			dependsOnFormat =
				dependesOnIds.length > 0 ? `⛔${dependesOnIds.join(", ")}` : "";
		} else if (globalSettings?.taskPropertyFormat === "2") {
			dependsOnFormat =
				dependesOnIds.length > 0
					? `⛔ ${dependesOnIds.join(", ")}`
					: "";
		} else if (globalSettings?.taskPropertyFormat === "3") {
			dependsOnFormat =
				dependesOnIds.length > 0
					? `[dependsOn:: ${dependesOnIds.join(", ")}]`
					: "";
		} else {
			dependsOnFormat =
				dependesOnIds.length > 0
					? `@dependsOn(${dependesOnIds.join(", ")})`
					: "";
		}

		if (extractedDependsOnMatch && extractedDependsOnMatch.length > 0) {
			return title.replace(extractedDependsOnMatch[0], dependsOnFormat);
		}

		if (cursorLocation?.lineNumber === 1) {
			// Insert newDependsOn at the specified charIndex with spaces
			const spaceBefore =
				title.slice(0, cursorLocation.charIndex).trim() + " ";
			const spaceAfter =
				" " + title.slice(cursorLocation.charIndex).trim();
			return `${spaceBefore}${dependsOnFormat}${spaceAfter}`;
		}

		// If no existing dependsOn found, append new one at the end
		return `${title} ${dependsOnFormat}`;
	}
};

// export const getSanitizedTaskContent = (
// 	plugin: TaskBoard,
// 	updatedTask: taskItem
// ): string => {
// 	if (updatedTask.title === "") {
// 		return "";
// 	}

// 	const dayPlannerPlugin =
// 		plugin.settings.data.globalSettings.dayPlannerPlugin;
// 	const globalSettings = plugin.settings.data.globalSettings;

// 	let dueDateWithFormat: string = "";
// 	let completedWitFormat: string = "";
// 	if (updatedTask.due || updatedTask.completion) {
// 		if (globalSettings?.taskPropertyFormat === "1") {
// 			dueDateWithFormat = updatedTask.due ? ` 📅${updatedTask.due}` : "";
// 			completedWitFormat = updatedTask.completion
// 				? ` ✅${updatedTask.completion} `
// 				: "";
// 		} else if (globalSettings?.taskPropertyFormat === "2") {
// 			dueDateWithFormat = updatedTask.due ? ` 📅 ${updatedTask.due}` : "";
// 			completedWitFormat = updatedTask.completion
// 				? ` ✅ ${updatedTask.completion} `
// 				: "";
// 		} else if (globalSettings?.taskPropertyFormat === "3") {
// 			dueDateWithFormat = updatedTask.due
// 				? ` [due:: ${updatedTask.due}]`
// 				: "";
// 			completedWitFormat = updatedTask.completion
// 				? ` [completion:: ${updatedTask.completion}] `
// 				: "";
// 		} else {
// 			dueDateWithFormat = updatedTask.due
// 				? ` @due(${updatedTask.due})`
// 				: "";
// 			completedWitFormat = updatedTask.completion
// 				? ` @completion(${updatedTask.completion}) `
// 				: "";
// 		}
// 	}

// 	const timeWithEmo = updatedTask.time ? ` ⏰[${updatedTask.time}]` : "";
// 	const checkBoxStat = `- [${updatedTask.status}]`;

// 	// Combine priority emoji if it exists
// 	const priorityWithEmo =
// 		updatedTask.priority > 0
// 			? priorityEmojis[updatedTask.priority as number]
// 			: "";

// 	// Build the formatted string for the main task
// 	let formattedTask = "";
// 	if (
// 		updatedTask.time !== "" ||
// 		timeWithEmo !== "" ||
// 		priorityWithEmo !== "" ||
// 		dueDateWithFormat !== "" ||
// 		completedWitFormat !== "" ||
// 		updatedTask.tags.length > 0
// 	) {
// 		if (dayPlannerPlugin) {
// 			formattedTask = `${checkBoxStat} ${
// 				updatedTask.time ? `${updatedTask.time} ` : ""
// 			}${
// 				updatedTask.title
// 			} | ${priorityWithEmo}${dueDateWithFormat} ${updatedTask.tags.join(
// 				" "
// 			)}${completedWitFormat}`;
// 		} else {
// 			formattedTask = `${checkBoxStat} ${
// 				updatedTask.title
// 			} |${priorityWithEmo}${timeWithEmo}${dueDateWithFormat} ${updatedTask.tags.join(
// 				" "
// 			)}${completedWitFormat}`;
// 		}
// 	} else {
// 		formattedTask = `${checkBoxStat} ${updatedTask.title}`;
// 	}
// 	// Add the body content, indent each line with a tab (or 4 spaces) for proper formatting
// 	const bodyLines = updatedTask.body
// 		.map((line: string) => {
// 			if (line.startsWith("\t")) {
// 				return line;
// 			} else {
// 				return `\t${line}`;
// 			}
// 		})
// 		.join("\n");

// 	const completeTask = `${formattedTask}${
// 		bodyLines.trim() ? `\n${bodyLines}` : ""
// 	}`;

// 	return completeTask;
// };

// For handleCheckboxChange

/**
 * Function to remove only the properties which user has configured
 * to be hidden using the hiddenTaskProperties setting.
 * @param plugin - The TaskBoard plugin instance.
 * @param task - The task item to clean.
 * @returns The cleaned task title without metadata.
 */
export const cleanTaskTitle = (plugin: TaskBoard, task: taskItem): string => {
	// Get the list of properties to hide
	const hiddenProperties =
		plugin.settings.data.globalSettings.hiddenTaskProperties || [];

	// If no properties are configured to hide and the legacy setting is false, return original title
	if (
		hiddenProperties.length === 0 &&
		!plugin.settings.data.globalSettings.showTaskWithoutMetadata
	) {
		return task.title;
	}

	let cleanedTitle = task.title;

	// Remove the initial indentation and checkbox markdown
	cleanedTitle = cleanedTitle
		.replace(
			new RegExp(TaskRegularExpressions.indentationAndCheckboxRegex, "u"),
			"",
		)
		.trim();

	// // If legacy showTaskWithoutMetadata is enabled, hide all properties (backward compatibility)
	// if (plugin.settings.data.globalSettings.showTaskWithoutMetadata) {
	// 	return cleanTaskTitleLegacy(task);
	// }

	// Hide only selected properties
	hiddenProperties.forEach((property) => {
		switch (property) {
			case taskPropertiesNames.Tags:
				// Remove tags
				task.tags.forEach((tag) => {
					const tagRegex = new RegExp(`\\s*${tag}\\s*`, "g");
					const tagsMatch = cleanedTitle.match(tagRegex);
					if (tagsMatch) {
						cleanedTitle = cleanedTitle.replace(tagsMatch[0], " ");
					}
				});
				break;

			case taskPropertiesNames.Time:
				// Remove time (handles both formats)
				if (task.time) {
					const timeRegex =
						/\s*(⏰\s*\[\d{2}:\d{2}\s*-\s*\d{2}:\d{2}\]|\b\d{2}:\d{2}\s*-\s*\d{2}:\d{2}\b|⏰\s*(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})|\[time::.*?\]|\@time\(.*?\))/g;
					const timeMatch = cleanedTitle.match(timeRegex);
					if (timeMatch) {
						cleanedTitle = cleanedTitle.replace(timeMatch[0], "");
					}
				}
				break;

			case taskPropertiesNames.DueDate:
				// Remove due date in various formats
				if (task.due) {
					const dueDateRegex =
						/\s*(📅\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[due::.*?\]|@due\(.*?\))/g;
					cleanedTitle = cleanedTitle.replace(dueDateRegex, "");
				}
				break;

			case taskPropertiesNames.CreatedDate:
				// Remove Created date in various formats
				if (task.createdDate) {
					const createdDateRegex =
						/\s*(➕\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[created::.*?\]|@created\(.*?\))/g;
					cleanedTitle = cleanedTitle.replace(createdDateRegex, "");
				}
				break;

			case taskPropertiesNames.StartDate:
				// Remove start date in various formats
				if (task.startDate) {
					const startDateRegex =
						/\s*(🛫\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[start::.*?\]|@start\(.*?\))/g;
					cleanedTitle = cleanedTitle.replace(startDateRegex, "");
				}
				break;

			case taskPropertiesNames.ScheduledDate:
				// Remove scheduled date in various formats
				if (task.scheduledDate) {
					const scheduledDateRegex =
						/\s*(⏳\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[scheduled::.*?\]|@scheduled\(.*?\))/g;
					cleanedTitle = cleanedTitle.replace(scheduledDateRegex, "");
				}
				break;

			case taskPropertiesNames.CompletionDate:
				// Remove completion date in various formats
				if (task.completion) {
					const completionRegex =
						/\s*(✅\s*.*?(?=\s|$)|\[completion::.*?\]|@completion\(.*?\))/g;
					cleanedTitle = cleanedTitle.replace(completionRegex, "");
				}
				break;

			case taskPropertiesNames.Priority:
				// Remove priority in various formats
				if (task.priority > 0) {
					let match = cleanedTitle.match(
						/\[priority::\s*(\d{1,2})\]/,
					);
					if (match) {
						cleanedTitle = cleanedTitle.replace(match[0], "");
					}

					match = cleanedTitle.match(/@priority\(\s*(\d{1,2})\s*\)/);
					if (match) {
						cleanedTitle = cleanedTitle.replace(match[0], "");
					}

					const priorityIcon = priorityEmojis[task.priority];

					if (priorityIcon) {
						// Create a regex pattern to match any priority emoji in text
						const priorityRegex = new RegExp(
							`(${Object.values(priorityEmojis)
								.map((emoji) => `\\s*${emoji}\\s*`)
								.join("|")})`,
							"g",
						);

						// Replace the first valid priority emoji found
						cleanedTitle = cleanedTitle.replace(
							priorityRegex,
							(match) => {
								return match.trim() === priorityIcon
									? " "
									: match;
							},
						);
					}
				}
				break;
		}
	});

	// Remove reminder if it's in the hidden properties list
	if (
		hiddenProperties.includes(taskPropertiesNames.Dependencies) ||
		plugin.settings.data.globalSettings.showTaskWithoutMetadata
	) {
		const reminderRegex =
			/\(\@(\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?|\d{2}:\d{2})\)/;
		const reminderMatch = cleanedTitle.match(reminderRegex);
		if (reminderMatch) {
			cleanedTitle = cleanedTitle.replace(reminderMatch[0], "").trim();
		}
	}

	// Trim extra spaces and return the cleaned title
	return cleanedTitle.trim();
};

/**
 * Function to clean the task title by removing metadata. This is legacy function for compatibility.
 * @param plugin - The TaskBoard plugin instance.
 * @param task - The task item to clean.
 * @returns The cleaned task title without metadata.
 *
 * @todo Improve the performance of this function as its called at extermely high rate.
 */
export const cleanTaskTitleLegacy = (task: taskItem): string => {
	let cleanedTitle = task.title;

	cleanedTitle = cleanedTitle
		.replace(
			new RegExp(TaskRegularExpressions.indentationAndCheckboxRegex, "u"),
			"",
		)
		.trim();

	// TODO : Support the legacy feature of adding all properties after the pipe symbol (|).
	// If pipe symbol is present (` | `), then remove everything after the pipe symbol.

	// Remove tags
	task.tags.forEach((tag) => {
		const tagRegex = new RegExp(`\\s*${tag}\\s*`, "g");
		const tagsMatch = cleanedTitle.match(tagRegex);
		if (tagsMatch) {
			cleanedTitle = cleanedTitle.replace(tagsMatch[0], " ");
		}
	});

	// Remove id
	if (task.legacyId) {
		const combinedIdRegex = new RegExp(
			`(?:${TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions.idRegex.source})|(?:${DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.idRegex.source})`,
			"g", // add the 'g' flag if you want to match all occurrences
		);
		const idMatch = cleanedTitle.match(combinedIdRegex);
		if (idMatch) {
			cleanedTitle = cleanedTitle.replace(idMatch[0], " ");
		}
	}

	// Remove time (handles both formats)
	if (task.time) {
		const timeRegex =
			/\s*(⏰\s*\[\d{2}:\d{2}\s*-\s*\d{2}:\d{2}\]|\b\d{2}:\d{2}\s*-\s*\d{2}:\d{2}\b|⏰\s*(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})|\[time::.*?\]|\@time\(.*?\))/g;
		const timeMatch = cleanedTitle.match(timeRegex);
		if (timeMatch) {
			cleanedTitle = cleanedTitle.replace(timeMatch[0], "");
		}
	}

	// Remove due date in various formats
	if (task.due) {
		const dueDateRegex =
			/\s*(📅\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[due::.*?\]|@due\(.*?\))/g;
		cleanedTitle = cleanedTitle.replace(dueDateRegex, "");
	}

	// Remove Created date in various formats
	if (task.createdDate) {
		const createdDateRegex =
			/\s*(➕\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[created::.*?\]|@created\(.*?\))/g;
		cleanedTitle = cleanedTitle.replace(createdDateRegex, "");
	}

	// Remove start date in various formats
	if (task.startDate) {
		const startDateRegex =
			/\s*(🛫\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[start::.*?\]|@start\(.*?\))/g;
		cleanedTitle = cleanedTitle.replace(startDateRegex, "");
	}

	// Remove scheduled date in various formats
	if (task.scheduledDate) {
		const scheduledDateRegex =
			/\s*(⏳\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[scheduled::.*?\]|@scheduled\(.*?\))/g;
		cleanedTitle = cleanedTitle.replace(scheduledDateRegex, "");
	}

	// Remove completion date in various formats
	if (task.completion) {
		const completionRegex =
			/\s*(✅\s*.*?(?=\s|$)|\[completion::.*?\]|@completion\(.*?\))/g;
		cleanedTitle = cleanedTitle.replace(completionRegex, "");
	}

	// Remove cancelled date in various formats
	if (task.cancelledDate) {
		const cancelledRegex =
			/\s*(❌\s*.*?(?=\s|$)|\[cancelled::.*?\]|@cancelled\(.*?\))/g;
		cleanedTitle = cleanedTitle.replace(cancelledRegex, "");
	}

	// Remove priority in various formats
	if (task.priority > 0) {
		let match = cleanedTitle.match(/\[priority::\s*(\d{1,2})\]/);
		if (match) {
			cleanedTitle = cleanedTitle.replace(match[0], "");
		}

		match = cleanedTitle.match(/@priority\(\s*(\d{1,2})\s*\)/);
		if (match) {
			cleanedTitle = cleanedTitle.replace(match[0], "");
		}

		const priorityIcon = priorityEmojis[task.priority];

		if (priorityIcon) {
			// Create a regex pattern to match any priority emoji in text
			const priorityRegex = new RegExp(
				`(${Object.values(priorityEmojis)
					.map((emoji) => `\\s*${emoji}\\s*`)
					.join("|")})`,
				"g",
			);

			// Replace the first valid priority emoji found
			cleanedTitle = cleanedTitle.replace(priorityRegex, (match) => {
				return match.trim() === priorityIcon ? " " : match;
			});
		}
	}

	// Remove dependsOn in various formats
	if (task.dependsOn && task.dependsOn.length > 0) {
		const combinedDependsOnRegex = new RegExp(
			`(?:${TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions.dependsOnRegex.source})|(?:${DATAVIEW_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpr.dependsOnRegex.source})`,
			"g", // add the 'g' flag if you want to match all occurrences
		);
		const match = cleanedTitle.match(combinedDependsOnRegex);
		if (match) {
			cleanedTitle = cleanedTitle.replace(match[0], "");
		}
	}

	// Remove reminder if it exists
	if (task.reminder) {
		const reminderRegex =
			/\(\@(\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?|\d{2}:\d{2})\)/;
		const reminderMatch = cleanedTitle.match(reminderRegex);
		if (reminderMatch) {
			cleanedTitle = cleanedTitle.replace(reminderMatch[0], "").trim();
		}
	}

	// Remove recurring tag and onCompletion tag
	cleanedTitle = cleanedTitle
		.replace(
			TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
				.recurrenceRegex,
			"",
		)
		.trim();
	cleanedTitle = cleanedTitle
		.replace(
			TASKS_PLUGIN_DEFAULT_SYMBOLS.TaskFormatRegularExpressions
				.onCompletionRegex,
			"",
		)
		.trim();

	// Trim extra spaces and return the cleaned title
	return cleanedTitle.trim();
};
