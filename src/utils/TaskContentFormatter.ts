// /src/utils/TaskContentFormatter.ts

import TaskBoard from "main";
import {
	extractDependsOn,
	extractPriority,
	extractTaskId,
	generateTaskId,
} from "./VaultScanner";
import {
	NotificationService,
	UniversalDateOptions,
	globalSettingsData,
	HideableTaskProperty,
} from "src/interfaces/GlobalSettings";
import { TaskRegularExpressions } from "src/regularExpressions/TasksPluginRegularExpr";
import { priorityEmojis, taskItem } from "src/interfaces/TaskItem";

export interface cursorLocation {
	lineNumber: number;
	charIndex: number;
}

/**
 * Function to get the formatted task content. The content will look similar to how it goes into your notes.
 * @param task - The task item to format.
 * @returns The formatted task content as a string.
 */
export const getFormattedTaskContent = async (
	task: taskItem
): Promise<string> => {
	console.log("getFormattedTaskContent\ntask :", task);
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

export const addIdToTaskContent = async (
	Plugin: TaskBoard,
	formattedTaskContent: string,
	forcefullyAddId?: boolean
): Promise<{ formattedTaskContent: string; newId: number | undefined }> => {
	const taskId = extractTaskId(formattedTaskContent);
	let newId = undefined;
	if (
		(!taskId && Plugin.settings.data.globalSettings.autoAddUniqueID) ||
		forcefullyAddId
	) {
		newId = generateTaskId(Plugin);
		formattedTaskContent = formattedTaskContent.replace(
			/^(.*?)(\n|$)/,
			`$1 🆔 ${newId}$2`
		);
	}
	return { formattedTaskContent, newId };
};

export const getFormattedTaskContentSync = (task: taskItem): string => {
	console.log("getFormattedTaskContentSync\ntask :", task);
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
	updatedTask: taskItem
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
		updatedTask.priority
	);

	updatedTitle = sanitizeTime(globalSettings, updatedTitle, updatedTask.time);

	updatedTitle = sanitizeCreatedDate(
		globalSettings,
		updatedTitle,
		updatedTask.createdDate
	);

	updatedTitle = sanitizeStartDate(
		globalSettings,
		updatedTitle,
		updatedTask.startDate
	);

	updatedTitle = sanitizeScheduledDate(
		globalSettings,
		updatedTitle,
		updatedTask.scheduledDate
	);

	updatedTitle = sanitizeDueDate(
		globalSettings,
		updatedTitle,
		updatedTask.due
	);

	updatedTitle = sanitizeTags(
		updatedTitle,
		updatedTask.tags,
		updatedTask.tags.pop() || ""
	);

	updatedTitle = sanitizeReminder(
		globalSettings,
		updatedTitle,
		updatedTask?.reminder || ""
	);

	updatedTitle = sanitizeCompletionDate(
		globalSettings,
		updatedTitle,
		updatedTask.completion || ""
	);

	updatedTitle = sanitizeCancellationDate(
		globalSettings,
		updatedTitle,
		updatedTask.cancelledDate || ""
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
 * Function to sanitize the created date inside the task title.
 * @param globalSettings - The global settings data.
 * @param title  - The title of the task.
 * @param createdDate - The new created date. Only single format supported right now. (yyyy-MM-dd)
 * @param cursorLocation - (Optional) The cursor location to insert the created date at a specific position.
 * @returns The sanitized created date string to be used in the task title.
 */
export const sanitizeCreatedDate = (
	globalSettings: globalSettingsData,
	title: string,
	createdDate: string,
	cursorLocation?: cursorLocation
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
	cursorLocation?: cursorLocation
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
	cursorLocation?: cursorLocation
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
 * @param dueDate - The due date of the task. Only one format supported right now. (yyyy-mm-dd)
 * @param cursorLocation - (Optional) The cursor location to insert the due date at a specific position.
 * @returns The sanitized due date string to be used in the task title.
 */
export const sanitizeDueDate = (
	globalSettings: globalSettingsData,
	title: string,
	dueDate: string,
	cursorLocation?: cursorLocation
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
 * @param completionDate - The completion date of the task. Only one format supported right now. (yyyy-mm-dd)
 * @param cursorLocation - (Optional) The cursor location to insert the completion date at a specific position.
 * @returns The sanitized completion date string to be used in the task title.
 */
export const sanitizeCompletionDate = (
	globalSettings: globalSettingsData,
	title: string,
	completionDate: string,
	cursorLocation?: cursorLocation
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
 * @param cancelledDate - The cancellation date of the task. Only one format supported right now. (yyyy-mm-dd)
 * @param cursorLocation - (Optional) The cursor location to insert the cancellation date at a specific position.
 * @returns The sanitized cancellation date string to be used in the task title.
 */
export const sanitizeCancellationDate = (
	globalSettings: globalSettingsData,
	title: string,
	cancelledDate: string,
	cursorLocation?: cursorLocation
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
 * @returns The sanitized time string to be used in the task title.
 */
export const sanitizeTime = (
	globalSettings: globalSettingsData,
	title: string,
	newTime: string,
	cursorLocation?: cursorLocation
): string => {
	const timeAtStartRegex = /^\s*(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})/;
	const timeFormatsRegex =
		/\s*(⏰\s*\[.*?\]|⏰\s*(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})|\[time::.*?\]|@time\(.*?\))/g; // Match all three formats

	if (globalSettings.compatiblePlugins.dayPlannerPlugin) {
		const timeAtStartMatch = title.match(timeAtStartRegex);
		if (timeAtStartMatch) {
			// If time is at the start of the title, replace it
			return title.replace(timeAtStartMatch[0], newTime);
		}

		const timeFormatMatch = title.match(timeFormatsRegex);
		if (timeFormatMatch) {
			// If time is present in any format, move it to the start
			title = title.replace(timeFormatsRegex, "").trim();
			return `${newTime} ${title}`;
		}

		// If no time is present, add it at the start
		return `${newTime} ${title}`;
	} else {
		const timeAtStartMatch = title.match(timeAtStartRegex);
		const timeFormatMatch = title.match(timeFormatsRegex);

		if (newTime === "") {
			if (timeAtStartMatch) {
				return title.replace(timeAtStartMatch[0], "").trim();
			}

			if (timeFormatMatch) {
				return title.replace(timeFormatMatch[0], "").trim();
			}

			return title;
		}

		let newTimeWithFormat: string = "";
		if (globalSettings.taskPropertyFormat === "1") {
			newTimeWithFormat = `⏰[${newTime}]`;
		} else if (globalSettings.taskPropertyFormat === "2") {
			newTimeWithFormat = `⏰ [${newTime}]`;
		} else if (globalSettings.taskPropertyFormat === "3") {
			newTimeWithFormat = `[time:: ${newTime}]`;
		} else {
			newTimeWithFormat = `@time(${newTime})`;
		}

		if (timeFormatMatch) {
			return title.replace(timeFormatsRegex, newTimeWithFormat);
		}

		if (cursorLocation?.lineNumber === 1) {
			// Insert newTimeWithFormat at the specified charIndex with spaces
			const spaceBefore =
				title.slice(0, cursorLocation.charIndex).trim() + " ";
			const spaceAfter =
				" " + title.slice(cursorLocation.charIndex).trim();
			return `${spaceBefore}${newTimeWithFormat}${spaceAfter}`;
		}

		// If no time is present, append it at the end
		return `${title} ${newTimeWithFormat}`;
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
	cursorLocation?: cursorLocation
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
		new RegExp(`\\[priority::\\s*${extractedPriorityMatch}\\s*\\]`)
	);
	if (match) {
		return newPriority > 0
			? title.replace(match[0], `[priority:: ${newPriority}]`)
			: title.replace(match[0], "");
	}

	match = title.match(
		new RegExp(`@priority\\(\\s*${extractedPriorityMatch}\\s*\\)`)
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
			priorityEmojis[newPriority]
		);
	}
};

/**
 * Function to sanitize tags inside the task title.
 * @param title - The title of the task.
 * @param oldTagsList - The list of old tags to be sanitized.
 * @param newTag - The new tag to be added to the title. Pass it along with the hash symbol. Eg. "#newTag".
 * @param cursorLocation - (Optional) The cursor location to insert the tag at a specific position.
 * @returns The sanitized tags string to be used in the task title.
 */
export const sanitizeTags = (
	title: string,
	oldTagsList: string[],
	newTag: string,
	cursorLocation?: cursorLocation
): string => {
	// Remove the <mark> and <font> tags from the title first before processing
	let updatedTitle = title;
	const tempTitle = title.replace(/<(mark|font).*?>/g, "");

	const tagsRegex = /\s+#([^\s!@#$%^&*()+=;:'"?<>{}[\]-]+)(?=\s|$)/g;
	const extractedTagsMatch = tempTitle.match(tagsRegex) || [];

	// Create a set for quick lookup of newTags
	const oldTagSet = new Set(oldTagsList);

	if (oldTagSet.size === 0) {
		// If no tags are present, remove all existing tags
		extractedTagsMatch.forEach((tag) => {
			updatedTitle = title.replace(tag.trim(), "").trim();
		});
	}

	// Remove tags from the title that are not in newTags
	for (const tag of extractedTagsMatch) {
		if (!oldTagSet.has(tag.trim())) {
			updatedTitle = updatedTitle.replace(tag, "").trim();
		}
	}

	// // Append tags from newTags that are not already in the title
	// const updatedTagsMatch =
	// 	updatedTitle.match(tagsRegex)?.map((tag) => tag.trim()) || [];
	// const updatedTagsSet = new Set(updatedTagsMatch);
	// for (const tag of newTags) {
	// 	if (!updatedTagsSet.has(tag)) {
	// 		updatedTitle += ` ${tag}`;
	// 	}
	// }

	if (cursorLocation?.lineNumber === 1) {
		// Insert newTag at the specified charIndex with spaces
		const spaceBefore =
			updatedTitle.slice(0, cursorLocation.charIndex).trim() + " ";
		const spaceAfter =
			" " + updatedTitle.slice(cursorLocation.charIndex).trim();
		return `${spaceBefore}${newTag}${spaceAfter}`;
	} else {
		// Append newTag at the end of the title
		if (newTag && !updatedTitle.includes(newTag)) {
			updatedTitle += ` ${newTag}`;
		}
	}

	return updatedTitle.trim();
};

/**
 * Function to sanitize the reminder inside the task title.
 * @param globalSettings - The global settings data.
 * @param title - The title of the task.
 * @param newReminder - The new reminder to be sanitized and added to the title. Must be in the format "yyyy-MM-ddTHH:mm".
 * @param cursorLocation - (Optional) The cursor location to insert the reminder at a specific position.
 * @returns The sanitized reminder string to be used in the task title.
 */
export const sanitizeReminder = (
	globalSettings: globalSettingsData,
	title: string,
	newReminder: string,
	cursorLocation?: cursorLocation
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
 * @returns The sanitized dependsOn string to be used in the task title.
 */
export const sanitizeDependsOn = (
	globalSettings: globalSettingsData,
	title: string,
	dependesOnIds: string[],
	cursorLocation?: cursorLocation
): string => {
	const extractedDependsOnMatch = extractDependsOn(title);

	console.log(
		"sanitizeDependsOn : title",
		title,
		"\ndependsOnIds",
		dependesOnIds,
		"\ncursorLocation",
		cursorLocation,
		"\nextractedDependsOnMatch",
		extractedDependsOnMatch
	);

	if (!dependesOnIds || dependesOnIds.length === 0) {
		if (extractedDependsOnMatch) {
			// If dependsOnIds is empty, remove any existing dependsOn
			return title.replace(extractedDependsOnMatch[0], "").trim();
		}
		return title;
	}

	let dependsOnFormat: string = "";
	if (globalSettings?.taskPropertyFormat === "1") {
		dependsOnFormat =
			dependesOnIds.length > 0 ? `⛔${dependesOnIds.join(", ")}` : "";
	} else if (globalSettings?.taskPropertyFormat === "2") {
		dependsOnFormat =
			dependesOnIds.length > 0 ? `⛔ ${dependesOnIds.join(", ")}` : "";
	} else if (globalSettings?.taskPropertyFormat === "3") {
		dependsOnFormat =
			dependesOnIds.length > 0
				? `[cancelled:: ${dependesOnIds.join(", ")}]`
				: "";
	} else {
		dependsOnFormat =
			dependesOnIds.length > 0
				? `@cancelled(${dependesOnIds.join(", ")})`
				: "";
	}

	if (extractedDependsOnMatch.length > 0) {
		return title.replace(extractedDependsOnMatch[0], dependsOnFormat);
	}

	if (cursorLocation?.lineNumber === 1) {
		// Insert newDependsOn at the specified charIndex with spaces
		const spaceBefore =
			title.slice(0, cursorLocation.charIndex).trim() + " ";
		const spaceAfter = " " + title.slice(cursorLocation.charIndex).trim();
		return `${spaceBefore}${dependsOnFormat}${spaceAfter}`;
	}
	// If no existing dependsOn found, append new one at the end
	return `${title} ${dependsOnFormat}`;
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
 * Function to clean the task title by removing metadata and formatting.
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
			""
		)
		.trim();

	// If legacy showTaskWithoutMetadata is enabled, hide all properties (backward compatibility)
	if (plugin.settings.data.globalSettings.showTaskWithoutMetadata) {
		return cleanTaskTitleLegacy(plugin, task);
	}

	// Hide only selected properties
	hiddenProperties.forEach((property) => {
		switch (property) {
			case HideableTaskProperty.Tags:
				// Remove tags
				task.tags.forEach((tag) => {
					const tagRegex = new RegExp(`\\s*${tag}\\s*`, "g");
					const tagsMatch = cleanedTitle.match(tagRegex);
					if (tagsMatch) {
						cleanedTitle = cleanedTitle.replace(tagsMatch[0], " ");
					}
				});
				break;

			case HideableTaskProperty.Time:
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

			case HideableTaskProperty.DueDate:
				// Remove due date in various formats
				if (task.due) {
					const dueDateRegex =
						/\s*(📅\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[due::.*?\]|@due\(.*?\))/g;
					cleanedTitle = cleanedTitle.replace(dueDateRegex, "");
				}
				break;

			case HideableTaskProperty.CreatedDate:
				// Remove Created date in various formats
				if (task.createdDate) {
					const createdDateRegex =
						/\s*(➕\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[created::.*?\]|@created\(.*?\))/g;
					cleanedTitle = cleanedTitle.replace(createdDateRegex, "");
				}
				break;

			case HideableTaskProperty.StartDate:
				// Remove start date in various formats
				if (task.startDate) {
					const startDateRegex =
						/\s*(🛫\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[start::.*?\]|@start\(.*?\))/g;
					cleanedTitle = cleanedTitle.replace(startDateRegex, "");
				}
				break;

			case HideableTaskProperty.ScheduledDate:
				// Remove scheduled date in various formats
				if (task.scheduledDate) {
					const scheduledDateRegex =
						/\s*(⏳\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})|\[scheduled::.*?\]|@scheduled\(.*?\))/g;
					cleanedTitle = cleanedTitle.replace(scheduledDateRegex, "");
				}
				break;

			case HideableTaskProperty.CompletionDate:
				// Remove completion date in various formats
				if (task.completion) {
					const completionRegex =
						/\s*(✅\s*.*?(?=\s|$)|\[completion::.*?\]|@completion\(.*?\))/g;
					cleanedTitle = cleanedTitle.replace(completionRegex, "");
				}
				break;

			case HideableTaskProperty.Priority:
				// Remove priority in various formats
				if (task.priority > 0) {
					let match = cleanedTitle.match(
						/\[priority::\s*(\d{1,2})\]/
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
							"g"
						);

						// Replace the first valid priority emoji found
						cleanedTitle = cleanedTitle.replace(
							priorityRegex,
							(match) => {
								return match.trim() === priorityIcon
									? " "
									: match;
							}
						);
					}
				}
				break;
		}
	});

	// Remove reminder if it's in the hidden properties list
	if (
		hiddenProperties.includes(HideableTaskProperty.Dependencies) ||
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

// Legacy function for backward compatibility
export const cleanTaskTitleLegacy = (
	plugin: TaskBoard,
	task: taskItem
): string => {
	let cleanedTitle = task.title;

	cleanedTitle = cleanedTitle
		.replace(
			new RegExp(TaskRegularExpressions.indentationAndCheckboxRegex, "u"),
			""
		)
		.trim();

	// Remove tags
	task.tags.forEach((tag) => {
		const tagRegex = new RegExp(`\\s*${tag}\\s*`, "g");
		const tagsMatch = cleanedTitle.match(tagRegex);
		if (tagsMatch) {
			cleanedTitle = cleanedTitle.replace(tagsMatch[0], " ");
		}
	});

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
				"g"
			);

			// Replace the first valid priority emoji found
			cleanedTitle = cleanedTitle.replace(priorityRegex, (match) => {
				return match.trim() === priorityIcon ? " " : match;
			});
		}
	}

	// Remove reminder if it exists
	const reminderRegex =
		/\(\@(\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?|\d{2}:\d{2})\)/;
	const reminderMatch = cleanedTitle.match(reminderRegex);
	if (reminderMatch) {
		cleanedTitle = cleanedTitle.replace(reminderMatch[0], "").trim();
	}

	// console.log("cleanedTitle", cleanedTitle.trim());

	// Trim extra spaces and return the cleaned title
	return cleanedTitle.trim();
};

export const getUniversalDateFromTask = (
	task: taskItem,
	plugin: TaskBoard
): string => {
	// Method 1 - Comparing
	const universalDateChoice =
		plugin.settings.data.globalSettings.universalDate;

	if (universalDateChoice === UniversalDateOptions.dueDate) {
		return task.due;
	} else if (universalDateChoice === UniversalDateOptions.startDate) {
		return task.startDate || "";
	} else if (universalDateChoice === UniversalDateOptions.scheduledDate) {
		return task.scheduledDate || "";
	}
	return "";

	// Method 2 - directly fetching the key of the task object which is same as that saved as string inside plugin.settings.data.globalSettings.universalDate
	// const universalDateChoice =
	// 	plugin.settings.data.globalSettings.universalDate;
	// if (
	// 	!universalDateChoice ||
	// 	!task[universalDateChoice] ||
	// 	task[universalDateChoice] === ""
	// ) {
	// 	return "";
	// }
	// // Return the value of the universal date key from the task object
	// return task[universalDateChoice] || "";
};

export const getUniversalDateEmoji = (plugin: TaskBoard): string => {
	const universalDateChoice =
		plugin.settings.data.globalSettings.universalDate;
	if (universalDateChoice === UniversalDateOptions.dueDate) {
		return "📅";
	} else if (universalDateChoice === UniversalDateOptions.scheduledDate) {
		return "⏳";
	} else if (universalDateChoice === UniversalDateOptions.startDate) {
		return "🛫";
	}
	return "";
};

export const isTaskRecurring = (taskTitle: string): boolean => {
	// This function will simly check if the task title contatins the recurring tag: 🔁
	const recurringTagRegex = /🔁/u;
	if (recurringTagRegex.test(taskTitle)) {
		return true;
	}
	// If the recurring tag is not found, return false
	return false;
};
