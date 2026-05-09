import {
	format,
	parse,
	isValid,
	eachDayOfInterval,
	startOfToday,
} from "date-fns";
import { moment as _moment } from "obsidian";
import { bugReporterManagerInsatance } from "../managers/BugReporter.js";
import { DEFAULT_DATE_FORMAT, DEFAULT_DATE_TIME_FORMAT } from "../interfaces/Constants.js";
import { UniversalDateOptions } from "../interfaces/Enums.js";
import { taskItem } from "../interfaces/TaskItem.js";

/**
 * A simple function to get today's date in the user's custom format from the plugin's setting using the date-fns library.
 * @param str The custom date format set by user in the plugin setting.
 * @returns Today's date as string in the custom date format.
 */
export const formatToday = (str: string): string => format(new Date(), str);

/**
 * Robust date parser that detects date format and parses accordingly.
 * Prioritizes ISO format (YYYY-MM-DD) and common date formats.
 *
 * @param dateString - The date string to parse (e.g., "2026-02-19", "19/02/2026T10:30:00")
 * @param preferredFormat - The preferred format to try first (e.g., "yyyy-MM-dd", "dd/MM/yyyyTHH:mm:ss" )
 * @param timePresent - Whether this is a date-time string or just a date string
 * @returns Parsed Date object or null if parsing fails
 *
 * @note This function is getting called three times for each and every task item:
 * 	- First for board level advanced filter (if date related filter is applied)
 * 	- Second for column level advanced filter (if date related filter is applied)
 * 	- Third for the card rendering from the component.
 *
 * Either we need to somehow cache the value or need to find a better approach.
 */
export const robustDateParser = (
	dateString: string,
	preferredFormat: string = DEFAULT_DATE_FORMAT,
): Date | null => {
	if (!dateString || typeof dateString !== "string") {
		return null;
	}

	const trimmed = dateString.trim();

	// // Try ISO format first (YYYY-MM-DD) since Tasks plugin uses this
	// if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
	// 	try {
	// 		const parsed = parseISO(trimmed);
	// 		if (isValid(parsed)) {
	// 			return parsed;
	// 		}
	// 	} catch (error) {
	// 		// Fall through to other formats
	// 	}
	// }

	// // Detect separator in the input string
	// const separatorMatch = trimmed.match(/[-/\\.\s]/);
	// const inputSeparator = separatorMatch ? separatorMatch[0] : "-";

	// // Build format list based on detected separator and preferred format
	// const formatsToTry: string[] = [];

	// // Add preferred format first (if it uses the correct separator)
	// const preferredSeparator = preferredFormat.match(/[-/\\.\s]/)?.[0] || "-";
	// if (preferredSeparator === inputSeparator) {
	// 	formatsToTry.push(preferredFormat);
	// }

	// // Add common formats with matching separator
	// const commonFormats = {
	// 	"-": [
	// 		"yyyy-MM-dd",
	// 		"yyyy-MM-dd HH:mm:ss",
	// 		"yyyy-MM-dd'T'HH:mm:ss",
	// 		"dd-MM-yyyy",
	// 		"MM-dd-yyyy",
	// 	],
	// 	"/": [
	// 		"dd/MM/yyyy",
	// 		"MM/dd/yyyy",
	// 		"yyyy/MM/dd",
	// 		"dd/MM/yyyy HH:mm:ss",
	// 		"MM/dd/yyyy HH:mm:ss",
	// 	],
	// 	".": ["dd.MM.yyyy", "yyyy.MM.dd", "dd.MM.yyyy HH:mm:ss"],
	// };

	// formatsToTry.push(
	// 	...(commonFormats[inputSeparator as keyof typeof commonFormats] || []),
	// );

	try {
		const parsed = parse(trimmed, preferredFormat, new Date());
		if (isValid(parsed)) {
			return parsed;
		}

		// If no format worked, try native Date parsing
		const nativeDate = new Date(dateString);
		if (isValid(nativeDate)) {
			return nativeDate;
		}
	} catch (error) {
		bugReporterManagerInsatance.addToLogs(
			187,
			`${JSON.stringify(error)}\n\nDate string : ${trimmed}\nDate format : ${preferredFormat}\n`,
			"DateTimeCalculations.ts/robustDateParser",
		);
		return null;
	}
	// }

	// Last resort: try native Date parsing for ISO strings and other formats
	try {
		const nativeDate = new Date(trimmed);
		if (isValid(nativeDate) && !isNaN(nativeDate.getTime())) {
			return nativeDate;
		}
	} catch (error) {
		// Fall through
	}

	return null;
};

/**
 * Returns current local date formatted according to the specified format using date-fns.
 * @param dateFormat The date format string (e.g., "yyyy-MM-dd")
 *
 * @returns Current local date value as string in the specified format.
 */
export const getCurrentLocalDateString = (
	dateFormat: string = DEFAULT_DATE_FORMAT,
): string => {
	try {
		const now = new Date();
		return format(now, dateFormat);
	} catch (error) {
		// Fallback to ISO format if format string is invalid
		const iso = new Date().toISOString();
		return iso.split("T")[0];
	}
};

/**
 * Returns current local date-time formatted according to the specified format using date-fns.
 * @param dateTimeFormat The date-time format string (e.g., "yyyy-MM-dd HH:mm:ss")
 *
 * @returns Current local date-time value as string in the specified format.
 */
export const getCurrentLocalDateTimeString = (
	dateTimeFormat: string = DEFAULT_DATE_TIME_FORMAT,
): string => {
	try {
		// Convert moment.js format pattern to date-fns format pattern
		// moment pattern: yyyy-MM-dd HH:mm:ss -> date-fns: yyyy-MM-dd HH:mm:ss
		const dateFormatPatternForDateFns =
			dateTimeFormat || DEFAULT_DATE_TIME_FORMAT;

		const now = new Date();
		return format(now, dateFormatPatternForDateFns);
	} catch (error) {
		// Fallback to ISO format if format string is invalid
		return new Date().toISOString();
	}
};

/**
 * @deprecated moment.js and date-fns libraries dont follow the same formatting. Hence, its better to only proceed with using a single library for all date formatting. Hence, will no longer use moment.js library in this project.
 *
 * @description Returns current local date-time formatted according to the specified format.
 * This is a legacy function for backward compatibility.
 * Uses moment.js library for formatting.
 * @param dateTimeString The date-time value to be formatted (e.g., "2024-04-05 14:30:00")
 * @param dateTimeFormat The target date-time format string (e.g., "yyyy-MM-dd HH:mm:ss")
 *
 * @returns Formatted date-time string if successful, otherwise returns the original dateTimeString.
 */
export const getCurrentLocalDateTimeStringLegacy = (
	dateTimeFormat: string = DEFAULT_DATE_TIME_FORMAT,
): string => {
	try {
		const moment = _moment as unknown as typeof _moment.default;
		const currentDateValue = moment().format(dateTimeFormat);

		return currentDateValue;
	} catch (error) {
		bugReporterManagerInsatance.addToLogs(
			182,
			JSON.stringify(error),
			"DateTimeCalculations.ts/getCurrentLocalDateTimeStringLegacy",
		);
		const moment = _moment as unknown as typeof _moment.default;
		const currentDateValue = moment().format(DEFAULT_DATE_TIME_FORMAT);

		return currentDateValue;
	}
};

/**
 * Accepts a date value in any format and converts it into the format set by user in the settings.
 * Uses date-fns for robust date parsing and formatting.
 * @param dateString The date value to be formatted (e.g., "2024-04-05", "05/04/2024")
 * @param dateFormat The target date format string (e.g., "yyyy-MM-dd")
 *
 * @returns Formatted date string if successful, otherwise returns the original dateString.
 */
export const formatDateStringAsPerSettings = (
	dateString: string,
	dateFormat: string = DEFAULT_DATE_FORMAT,
): string => {
	if (!dateString) {
		return dateString;
	}

	try {
		let parsedDate: Date | null = robustDateParser(dateString, dateFormat);

		// If we have a valid date, format it
		if (parsedDate) {
			return format(parsedDate, dateFormat);
		}

		return dateString;
	} catch (error) {
		return dateString;
	}
};

/**
 * Accepts a date-time value in any format and converts it into the format set by user in the settings.
 * Uses date-fns for robust date-time parsing and formatting.
 * @param dateTimeString The date-time value to be formatted (e.g., "2024-04-05 14:30:00")
 * @param dateTimeFormat The target date-time format string (e.g., "yyyy-MM-dd HH:mm:ss")
 *
 * @returns Formatted date-time string if successful, otherwise returns the original dateTimeString.
 */
export const formatDateTimeAsPerSettings = (
	dateTimeString: string,
	dateTimeFormat: string = DEFAULT_DATE_TIME_FORMAT,
): string => {
	if (!dateTimeString) {
		return dateTimeString;
	}

	try {
		let parsedDate: Date | null = robustDateParser(
			dateTimeString,
			dateTimeFormat,
		);

		// If we have a valid date, format it
		if (parsedDate) {
			return format(parsedDate, dateTimeFormat);
		}

		return dateTimeString;
	} catch (error) {
		return dateTimeString;
	}
};

/**
 * Returns an array of dates in the format "yyyy-MM-dd" from the given fromDate to toDate.
 * The fromDate and toDate are the number of days from the current date.
 * Uses date-fns for efficient date range generation.
 * @param fromDate - The number of days from the current date to start the date range.
 * @param toDate - The number of days from the current date to end the date range.
 * @returns An array of dates in the format "yyyy-MM-dd".
 */
export function getAllDatesInRelativeRange(
	fromDate: number,
	toDate: number,
): string[] {
	try {
		const now = startOfToday();
		const startDate = new Date(
			now.getTime() + fromDate * 24 * 60 * 60 * 1000,
		);
		const endDate = new Date(now.getTime() + toDate * 24 * 60 * 60 * 1000);

		// Use date-fns eachDayOfInterval for efficient date generation
		const interval = eachDayOfInterval(
			{
				start: startDate <= endDate ? startDate : endDate,
				end: startDate <= endDate ? endDate : startDate,
			},
			{ step: 1 },
		);

		// Format each date as "yyyy-MM-dd"
		return interval.map((date) => format(date, "yyyy-MM-dd"));
	} catch (error) {
		return [];
	}
}

/**
 * Returns the universal date of a task based on the plugin's global settings.
 * If the universal date is not set or the task does not have a value for the universal date, an empty string is returned.
 * @param task - The task object containing the universal date values.
 * @param universalDateType - The type of the universal date which user has set inside plugin.settings.universalDate.
 * @returns The universal date of the task as a string, or an empty string if not set. */
export const getUniversalDateFromTask = (
	task: taskItem,
	universalDateType: string,
): string => {
	// Method 1 - Comparing
	if (universalDateType === UniversalDateOptions.dueDate) {
		return task.due;
	} else if (universalDateType === UniversalDateOptions.startDate) {
		return task.startDate || "";
	} else if (universalDateType === UniversalDateOptions.scheduledDate) {
		return task.scheduledDate || "";
	}
	return "";

	// Method 2 - directly fetching the key of the task object which is same as that saved as string inside plugin.settings.data.universalDate
	// const universalDateChoice =
	// 	plugin.settings.data.universalDate;
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
export const getUniversalDateEmoji = (universalDateSetting: string): string => {
	if (universalDateSetting === UniversalDateOptions.dueDate) {
		return "📅";
	} else if (universalDateSetting === UniversalDateOptions.scheduledDate) {
		return "⏳";
	} else if (universalDateSetting === UniversalDateOptions.startDate) {
		return "🛫";
	}
	return "";
};
