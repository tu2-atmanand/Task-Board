import TaskBoard from "main";
import { UniversalDateOptions } from "src/interfaces/Enums";
import { taskItem } from "src/interfaces/TaskItem";

/**
 * Returns local time in ISO-like format (YYYY-MM-DDTHH:MM:SS) without milliseconds or timezone
 * @returns Current local time in ISO format string (YYYY-MM-DDTHH:MM:SS)
 * 
 * @todo - Update this function to take input as the format from the setting and return the value as per the format.
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

// import { DateTime } from "luxon";

// function getDates(fromDate: number, toDate: number): string[] {
// 	const now = DateTime.now();
// 	const startDate = now.plusDays(fromDate);
// 	const endDate = now.plusDays(toDate);
// 	const dates: string[] = [];
// 	let currentDate = startDate;
// 	while (currentDate <= endDate) {
// 		dates.push(currentDate.toISODate());
// 		currentDate = currentDate.plusDays(1);
// 	}
// 	return dates;
// }

/**
 * Returns an array of dates in the format "YYYY-MM-DD" from the given fromDate to toDate.
 * The fromDate and toDate are the number of days from the current date.
 * @param fromDate - The number of days from the current date to start the date range.
 * @param toDate - The number of days from the current date to end the date range.
 * @returns An array of dates in the format "YYYY-MM-DD".
 */
export function getAllDatesInRelativeRange(
	fromDate: number,
	toDate: number
): string[] {
	const now = new Date();
	const startDate = new Date(now.getTime() + fromDate * 24 * 60 * 60 * 1000);
	const endDate = new Date(now.getTime() + toDate * 24 * 60 * 60 * 1000);
	const dates: string[] = [];
	let currentDate = new Date(startDate.getTime());
	while (currentDate <= endDate) {
		dates.push(currentDate.toISOString().split("T")[0]);
		currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
	}
	return dates;
}
