import {
	format,
	parse,
	isValid,
	eachDayOfInterval,
	startOfToday,
	compareAsc,
} from "date-fns";
import { moment as _moment } from "obsidian";
import { bugReporterManagerInsatance } from "../core/managers/BugReporter.js";
import {
	DEFAULT_DATE_FORMAT,
	DEFAULT_DATE_TIME_FORMAT,
} from "../interfaces/Constants.js";
import { UniversalDateOptions } from "../interfaces/Enums.js";
import { taskItem } from "../interfaces/TaskItem.js";
import { DEFAULT_TASK_CACHE_KEYS } from "../interfaces/Enums.js";

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
 * @returns Parsed Date object or null if parsing fails
 *
 * @note - This is an expensive function and hence not to be used for rendering or other calculation operations. 
 * It should be mainly use for scanning the task and storing the value in cache.
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
	dateString: string | number | Date,
	dateFormat: string = DEFAULT_DATE_FORMAT,
): string => {
	if (dateString === "") {
		return String(dateString);
	}

	try {
		const parsedDate =
			dateString instanceof Date
				? dateString
				: typeof dateString === "number"
					? new Date(dateString)
					: robustDateParser(dateString, dateFormat);

		// If we have a valid date, format it
		if (parsedDate && isValid(parsedDate)) {
			return format(parsedDate, dateFormat);
		}

		return String(dateString);
	} catch (error) {
		return String(dateString);
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
	dateTimeString: string | number | Date,
	dateTimeFormat: string = DEFAULT_DATE_TIME_FORMAT,
): string => {
	if (dateTimeString === "") {
		return String(dateTimeString);
	}

	try {
		const parsedDate =
			dateTimeString instanceof Date
				? dateTimeString
				: typeof dateTimeString === "number"
					? new Date(dateTimeString)
					: robustDateParser(dateTimeString, dateTimeFormat);

		// If we have a valid date, format it
		if (parsedDate && isValid(parsedDate)) {
			return format(parsedDate, dateTimeFormat);
		}

		return String(dateTimeString);
	} catch (error) {
		return String(dateTimeString);
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
 * Returns the universal date in epoch milliseconds, or undefined if not set.
 * @param task - The task object containing the universal date values.
 * @param universalDateType - The type of the universal date which user has set inside plugin.settings.universalDate.
 * @returns The universal date in epoch milliseconds, or undefined if not set.
 */
export const getUniversalDateFromTask = (
	task: taskItem,
	universalDateType: UniversalDateOptions,
): number | undefined => {
	// Method 1 - Comparing
	if (universalDateType === UniversalDateOptions.dueDate) {
		return task[DEFAULT_TASK_CACHE_KEYS.DueDate];
	} else if (universalDateType === UniversalDateOptions.startDate) {
		return task[DEFAULT_TASK_CACHE_KEYS.StartDate];
	} else if (universalDateType === UniversalDateOptions.scheduledDate) {
		return task[DEFAULT_TASK_CACHE_KEYS.ScheduledDate];
	}
	return undefined;

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
export const getUniversalDateEmoji = (
	universalDateSetting: UniversalDateOptions,
): string => {
	if (universalDateSetting === UniversalDateOptions.dueDate) {
		return "📅";
	} else if (universalDateSetting === UniversalDateOptions.scheduledDate) {
		return "⏳";
	} else if (universalDateSetting === UniversalDateOptions.startDate) {
		return "🛫";
	}
	return "";
};

/** Compare configured time values as clock times (HH:mm), not dates. */
function compareTimeValues_V1(value1: string, value2: string): number {
	const toMinutes = (value: string): number => {
		const [hours, minutes] = value.split(":").map(Number);
		return Number.isFinite(hours) && Number.isFinite(minutes)
			? hours * 60 + minutes
			: Number.NaN;
	};
	const time1 = toMinutes(value1);
	const time2 = toMinutes(value2);
	if (Number.isNaN(time1) || Number.isNaN(time2)) return 0;
	return time1 - time2;
}

/**
 * Compares two dates using robust parsing
 * Handles multiple date formats automatically
 * @returns -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
function compareDatesExpensive(
	date1: string | Date,
	date2: string | Date,
	dateFormat: string,
): number {
	if (!date1 || !date2) {
		return 0;
	}

	// Use robust parser for both dates
	const parsedDate1 = robustDateParser(String(date1), dateFormat);
	const parsedDate2 = robustDateParser(String(date2), dateFormat);

	// If either date is invalid, return 0
	if (!parsedDate1 || !parsedDate2) {
		return 0;
	}

	// Compare dates
	const comparison = compareAsc(parsedDate1, parsedDate2);
	return comparison;
}

/**
 * Compares two dates
 * Returns: -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 * Handles empty/null dates by placing them at the end for ascending order
 */
export function compareDates(
	date1: string | number | Date,
	date2: string | number | Date,
	order: "asc" | "desc",
	dateFormat: string = DEFAULT_DATE_FORMAT,
): number {
	// Handle empty/null values
	const hasDate1 =
		typeof date1 === "number" || date1 instanceof Date
			? true
			: date1 !== "";
	const hasDate2 =
		typeof date2 === "number" || date2 instanceof Date
			? true
			: date2 !== "";

	if (!hasDate1 && !hasDate2) return 0;
	if (!hasDate1) return order === "asc" ? 1 : -1; // Empty values go to end for asc, start for desc
	if (!hasDate2) return order === "asc" ? -1 : 1;

	const d1 =
		typeof date1 === "number"
			? new Date(date1)
			: date1 instanceof Date
				? date1
				: robustDateParser(date1, dateFormat);
	const d2 =
		typeof date2 === "number"
			? new Date(date2)
			: date2 instanceof Date
				? date2
				: robustDateParser(date2, dateFormat);

	if (!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime())) {
		return 0;
	}

	if (d1 < d2) return -1;
	if (d1 > d2) return 1;
	return 0;
}

/**
 * Compares two time strings (e.g., "09:00", "9:00", or "09:00-10:00")
 * Returns: -1 if time1 < time2, 0 if equal, 1 if time1 > time2
 */
export function compareTimePropertyValue(
	time1: string,
	time2: string,
	order: "asc" | "desc",
): number {
	// Handle empty/null values
	const hasTime1 = time1 && time1 !== "";
	const hasTime2 = time2 && time2 !== "";

	if (!hasTime1 && !hasTime2) return 0;
	if (!hasTime1) return order === "asc" ? 1 : -1; // Empty values go to end for asc, start for desc
	if (!hasTime2) return order === "asc" ? -1 : 1;

	// Extract start time if it's a range (e.g., "09:00-10:00")
	const extractStartTime = (timeStr: string): string => {
		if (timeStr.includes("-")) {
			return timeStr.split("-")[0].trim();
		}
		return timeStr.trim();
	};

	const t1 = extractStartTime(String(time1));
	const t2 = extractStartTime(String(time2));

	// Parse time to compare numerically (handles both "9:00" and "09:00")
	const parseTime = (timeStr: string): number => {
		const parts = timeStr.split(":");
		if (parts.length !== 2) return -1; // Invalid format
		const hours = parseInt(parts[0], 10);
		const minutes = parseInt(parts[1], 10);
		if (isNaN(hours) || isNaN(minutes)) return -1; // Invalid number
		if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return -1; // Out of range
		return hours * 60 + minutes; // Convert to minutes since midnight
	};

	const time1Minutes = parseTime(t1);
	const time2Minutes = parseTime(t2);

	// Treat invalid times as equal
	if (time1Minutes < 0 && time2Minutes < 0) return 0;
	if (time1Minutes < 0) return order === "asc" ? 1 : -1; // Invalid times go to end for asc
	if (time2Minutes < 0) return order === "asc" ? -1 : 1;

	if (time1Minutes < time2Minutes) return -1;
	if (time1Minutes > time2Minutes) return 1;
	return 0;
}

/**
 * Returns a human readable string/summary for a date value relative to today.
 * For example,
 * - Today = 2026-11-01
 * - dateValue = 2026-11-05
 * - returns = 4 days from now.
 * @param dateValue The date value in string or Date format.
 * @returns Human readable string.
 */
export const getHumanReadableDateString = (
	dateValue: string | Date,
): string => {
	return "3 days from now";
};
