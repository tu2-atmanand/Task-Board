import TaskBoard from "main";
import { UniversalDateOptions } from "src/interfaces/Enums";
import { taskItem } from "src/interfaces/TaskItem";

/**
 * Returns local time in ISO-like format (YYYY-MM-DDTHH:MM) without milliseconds or timezone
 * @returns Current local time in ISO format string (YYYY-MM-DDTHH:MM)
 */
export const getLocalDateTimeString = (): string => {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");
	return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Returns local time in ISO-like format (YYYY-MM-DDTHH:MM:SS) without milliseconds or timezone
 * @returns Current local time in ISO format string (YYYY-MM-DDTHH:MM:SS)
 */
export const getCurrentLocalTimeString = (): string => {
	const now = new Date();
	const currentTime = new Date(
		now.getTime() - now.getTimezoneOffset() * 60000
	)
		.toISOString()
		.slice(0, 19);

	return currentTime;
};

/**
 * Parses a date string and returns a Date object if valid, otherwise returns null.
 * @param dateStr - The date string to parse.
 * @returns A Date object if valid, otherwise null.
 */
export const parseUniversalDate = (dateStr: string): Date | null => {
	// Regular expression to check if dueStr starts with a two-digit day
	const ddMmYyyyPattern = /^\d{2}-\d{2}-\d{4}$/;

	if (ddMmYyyyPattern.test(dateStr)) {
		// Convert "DD-MM-YYYY" → "YYYY-MM-DD"
		const [day, month, year] = dateStr.split("-");
		dateStr = `${year}-${month}-${day}`;
	}

	// Parse the date
	const parsedDate = new Date(dateStr);
	return isNaN(parsedDate.getTime()) ? null : parsedDate;
};

/**
 * Returns the universal date of a task based on the plugin's global settings.
 * If the universal date is not set or the task does not have a value for the universal date, an empty string is returned.
 * @param task - The task object containing the universal date values.
 * @param plugin - The TaskBoard plugin object.
 * @returns The universal date of the task as a string, or an empty string if not set. */
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

/**
 * Returns an emoji based on the universal date type set in the plugin's global settings.
 * If the universal date is not set, an empty string is returned.
 * @param plugin - The TaskBoard plugin object.
 * @returns An emoji representing the universal date type, or an empty string if not set.
 */
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
