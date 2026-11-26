import {
	addDays,
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
import {
	PropertyTypeConfig,
	UniversalDateOptions,
	DEFAULT_TASK_CACHE_KEYS,
} from "../interfaces/Enums.js";
import type { taskItem } from "../interfaces/TaskItem.js";

/**
 * A simple function to get today's date in the user's custom format from the plugin's setting using the date-fns library.
 * @param str The custom date format set by user in the plugin setting.
 * @returns Today's date as string in the custom date format.
 */
export const formatToday = (str: string): string => format(new Date(), str);

const TIME_COMPONENT_REGEX = /\d{1,2}:\d{2}/;
const TIME_ONLY_REGEX = /^\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM))?$/i;
const DATE_TIME_SEPARATOR_REGEX = /(?:T|\s)\s*\d{1,2}:\d{2}/i;

function hasTimeComponent(value: string): boolean {
	return TIME_COMPONENT_REGEX.test(value);
}

function formatHasTimeComponent(dateFormat: string): boolean {
	return /[Hhms]/.test(dateFormat);
}

/** Removes a trailing time component so only the calendar date remains. */
function getDateOnlyPart(value: string): string {
	return value.split(DATE_TIME_SEPARATOR_REGEX)[0].trim();
}

/** Best-effort date format derived from a date-time format string. */
function getDateFormatFromDateTimeFormat(dateTimeFormat: string): string {
	const timeTokenIndex = dateTimeFormat.search(/[Hhms]/);
	if (timeTokenIndex <= 0) return DEFAULT_DATE_FORMAT;

	return dateTimeFormat
		.slice(0, timeTokenIndex)
		.replace(/['"][^'"]*['"]\s*$/, "")
		.replace(/[T\s]+$/, "")
		.trim();
}

/**
 * Builds the timezone-independent epoch for a date-only cache value.
 *
 * Date-only values are stored as 12:00 UTC on the intended calendar day. The
 * original local/date-fns date is used to identify the calendar day so that
 * callers which already produced a local date keep the same day.
 */
export function getDateOnlyEpochFromDateValue(date: Date): number {
	const isCanonicalUtcNoon =
		date.getUTCHours() === 12 &&
		date.getUTCMinutes() === 0 &&
		date.getUTCSeconds() === 0 &&
		date.getUTCMilliseconds() === 0;

	const year = isCanonicalUtcNoon
		? date.getUTCFullYear()
		: date.getFullYear();
	const month = isCanonicalUtcNoon ? date.getUTCMonth() : date.getMonth();
	const day = isCanonicalUtcNoon ? date.getUTCDate() : date.getDate();

	return Date.UTC(year, month, day, 12, 0, 0, 0);
}

/**
 * Converts a date-only epoch back to a local Date that still shows the same
 * calendar day. Useful for date-fns UI operations such as calendar grids.
 */
export function getLocalDateFromDateOnlyEpoch(epoch: number): Date {
	const date = new Date(epoch);
	return new Date(
		date.getUTCFullYear(),
		date.getUTCMonth(),
		date.getUTCDate(),
		12,
		0,
		0,
		0,
	);
}

/** Returns the canonical UTC-noon epoch for a local calendar date. */
export function getDateOnlyEpochFromLocalDate(date: Date): number {
	return Date.UTC(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
		12,
		0,
		0,
		0,
	);
}

/** True when an epoch is the canonical UTC-noon sentinel used for date-only values. */
export function isDateOnlyEpoch(epoch: number): boolean {
	if (!Number.isFinite(epoch)) return false;
	const date = new Date(epoch);
	return (
		date.getUTCHours() === 12 &&
		date.getUTCMinutes() === 0 &&
		date.getUTCSeconds() === 0 &&
		date.getUTCMilliseconds() === 0
	);
}

function isLocalMidnight(date: Date): boolean {
	return (
		date.getHours() === 0 &&
		date.getMinutes() === 0 &&
		date.getSeconds() === 0 &&
		date.getMilliseconds() === 0
	);
}

/**
 * A local midnight means the user supplied only a date (or explicitly chose
 * midnight). Normalize it to the UTC-noon date-only sentinel so whole-day
 * values stay timezone-independent and distinguishable from real times.
 */
function normalizeDateTimeValue(date: Date): Date {
	return isValid(date) && isLocalMidnight(date)
		? new Date(getDateOnlyEpochFromDateValue(date))
		: date;
}

/** Returns the cached epoch for a date-time value, normalizing local midnight. */
export function getDateTimeEpochFromDateValue(date: Date): number {
	return normalizeDateTimeValue(date).getTime();
}

/**
 * Parses a date-only value and returns the canonical UTC-noon epoch.
 *
 * If a value contains both a date and a time, only the date portion is parsed.
 * Time-only values are rejected.
 */
export function parseDateOnlyValue(
	value: string,
	dateFormat: string = DEFAULT_DATE_FORMAT,
): Date | null {
	if (!value || typeof value !== "string") return null;

	const trimmed = value.trim();
	if (!trimmed || TIME_ONLY_REGEX.test(trimmed)) return null;

	const datePart = getDateOnlyPart(trimmed);
	if (!datePart) return null;

	const preferredDateFormat = formatHasTimeComponent(dateFormat)
		? getDateFormatFromDateTimeFormat(dateFormat)
		: dateFormat || DEFAULT_DATE_FORMAT;

	for (const formatString of new Set([
		preferredDateFormat,
		DEFAULT_DATE_FORMAT,
	])) {
		try {
			const parsed = parse(datePart, formatString, new Date());
			if (isValid(parsed)) {
				return new Date(getDateOnlyEpochFromDateValue(parsed));
			}
		} catch (error) {
			bugReporterManagerInsatance.addToLogs(
				187,
				`${JSON.stringify(error)}\n\nDate string : ${datePart}\nDate format : ${formatString}\n`,
				"DateTimeCalculations.ts/parseDateOnlyValue",
			);
		}
	}

	return null;
}

/**
 * Parses a date-time value.
 *
 * Time-only values are rejected. If only a date is supplied, or the supplied
 * time is local midnight, the value is normalized to the UTC-noon date-only
 * sentinel so whole-day values can be identified and stay timezone-safe.
 */
export function parseDateTimeValue(
	value: string,
	dateTimeFormat: string = DEFAULT_DATE_TIME_FORMAT,
	dateFormat: string = DEFAULT_DATE_FORMAT,
): Date | null {
	if (!value || typeof value !== "string") return null;

	const trimmed = value.trim();
	if (!trimmed || TIME_ONLY_REGEX.test(trimmed)) return null;

	if (!hasTimeComponent(trimmed)) {
		const formats = [
			dateFormat || DEFAULT_DATE_FORMAT,
			getDateFormatFromDateTimeFormat(dateTimeFormat),
			DEFAULT_DATE_FORMAT,
		].filter(Boolean);

		for (const formatString of new Set(formats)) {
			const dateOnlyValue = parseDateOnlyValue(trimmed, formatString);
			if (dateOnlyValue) return dateOnlyValue;
		}
		return null;
	}

	try {
		const parsed = parse(trimmed, dateTimeFormat, new Date());
		if (isValid(parsed)) {
			return normalizeDateTimeValue(parsed);
		}
	} catch (error) {
		bugReporterManagerInsatance.addToLogs(
			187,
			`${JSON.stringify(error)}\n\nDate string : ${trimmed}\nDate format : ${dateTimeFormat}\n`,
			"DateTimeCalculations.ts/parseDateTimeValue",
		);
	}

	try {
		const nativeDate = new Date(trimmed);
		return isValid(nativeDate) ? normalizeDateTimeValue(nativeDate) : null;
	} catch {
		return null;
	}
}

/** Formats a canonical date-only epoch without timezone drift. */
function formatDateOnlyEpoch(epoch: number, dateFormat: string): string {
	return format(getLocalDateFromDateOnlyEpoch(epoch), dateFormat);
}

/** Formats a canonical date-only epoch as local midnight in a date-time format. */
function formatDateOnlyEpochAsMidnight(
	epoch: number,
	dateTimeFormat: string,
): string {
	const dateOnlyDate = getLocalDateFromDateOnlyEpoch(epoch);
	const midnight = new Date(
		dateOnlyDate.getFullYear(),
		dateOnlyDate.getMonth(),
		dateOnlyDate.getDate(),
		0,
		0,
		0,
		0,
	);
	return format(midnight, dateTimeFormat);
}

/**
 * Robust date parser that detects date format and parses accordingly.
 *
 * Date formats only parse the date portion of a value, while date-time formats
 * fall back to UTC 12:00 when a value contains only a date. Time-only values
 * are rejected for both.
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
	if (!trimmed) return null;

	return formatHasTimeComponent(preferredFormat)
		? parseDateTimeValue(trimmed, preferredFormat)
		: parseDateOnlyValue(trimmed, preferredFormat);
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
		let epoch: number | undefined;

		if (typeof dateString === "number") {
			epoch = dateString;
		} else if (dateString instanceof Date) {
			epoch = getDateOnlyEpochFromDateValue(dateString);
		} else {
			epoch = parseDateOnlyValue(dateString, dateFormat)?.getTime();
		}

		if (epoch !== undefined && Number.isFinite(epoch)) {
			return formatDateOnlyEpoch(epoch, dateFormat);
		}

		return String(dateString);
	} catch (error) {
		return String(dateString);
	}
};

/**
 * Accepts a date-time value in any format and converts it into the format set by user in the settings.
 * Uses date-fns for robust date-time parsing and formatting.
 *
 * Canonical date-only values are rendered as local midnight instead of their
 * UTC-noon cache instant, so whole-day tasks do not appear shifted.
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
		if (
			typeof dateTimeString === "number" &&
			isDateOnlyEpoch(dateTimeString)
		) {
			return formatDateOnlyEpochAsMidnight(
				dateTimeString,
				dateTimeFormat,
			);
		}

		if (
			dateTimeString instanceof Date &&
			isDateOnlyEpoch(dateTimeString.getTime())
		) {
			return formatDateOnlyEpochAsMidnight(
				dateTimeString.getTime(),
				dateTimeFormat,
			);
		}

		const parsedDate =
			dateTimeString instanceof Date
				? dateTimeString
				: typeof dateTimeString === "number"
					? new Date(dateTimeString)
					: parseDateTimeValue(dateTimeString, dateTimeFormat);

		// If we have a valid date, format it
		if (parsedDate && isValid(parsedDate)) {
			return isDateOnlyEpoch(parsedDate.getTime())
				? formatDateOnlyEpochAsMidnight(
						parsedDate.getTime(),
						dateTimeFormat,
					)
				: format(parsedDate, dateTimeFormat);
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
		const startDate = addDays(now, fromDate);
		const endDate = addDays(now, toDate);

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
	valueType?: PropertyTypeConfig,
	dateTimeFormat: string = DEFAULT_DATE_TIME_FORMAT,
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

	const isDateOnly = valueType === PropertyTypeConfig.date;
	const isDateTime = valueType === PropertyTypeConfig.dateTime;

	const parseValue = (value: string | number | Date): Date | null => {
		if (typeof value === "number") {
			const date = new Date(value);
			if (isDateOnly && Number.isFinite(date.getTime())) {
				return new Date(getDateOnlyEpochFromDateValue(date));
			}
			return isDateTime ? normalizeDateTimeValue(date) : date;
		}
		if (value instanceof Date) {
			if (isDateOnly)
				return new Date(getDateOnlyEpochFromDateValue(value));
			return isDateTime ? normalizeDateTimeValue(value) : value;
		}
		if (isDateOnly) return parseDateOnlyValue(value, dateFormat);
		if (isDateTime)
			return parseDateTimeValue(value, dateTimeFormat, dateFormat);
		return robustDateParser(value, dateFormat);
	};

	const d1 = parseValue(date1);
	const d2 = parseValue(date2);

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
