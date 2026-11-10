import { sanitizeHTMLToDom } from "obsidian";
import { bugReporterManagerInsatance } from "../core/managers/BugReporter.js";
import { DEFAULT_TASK_CACHE_KEYS } from "../interfaces/Enums.js";

/**
 * Convert a hex color string to an rgba() CSS string.
 *
 * Supports short (#rgb), full (#rrggbb), and optional alpha channel (#rrggbbaa).
 * If an 8-character hex with alpha is provided, the `opacity` parameter will override it.
 *
 * @param hex - Hex color string (e.g. "#03f", "#0033ff", or "#0033ff80")
 * @param opacity - Opacity value between 0 and 1 to use for the resulting rgba string
 * @returns CSS rgba() color string like "rgba(0,51,255,0.5)"
 */
export function hexToRgba(hex: string, opacity: number): string {
	let r = 0,
		g = 0,
		b = 0;

	if (hex.length === 4) {
		r = parseInt(hex[1] + hex[1], 16);
		g = parseInt(hex[2] + hex[2], 16);
		b = parseInt(hex[3] + hex[3], 16);
	} else if (hex.length === 7 || hex.length === 9) {
		r = parseInt(hex[1] + hex[2], 16);
		g = parseInt(hex[3] + hex[4], 16);
		b = parseInt(hex[5] + hex[6], 16);
	}

	return `rgba(${r},${g},${b},${opacity})`;
}

/**
 * Convert hex color to hex with alpha channel
 * @param hex - Hex color string (e.g. "#0033ff")
 * @param alpha - Alpha value between 0 and 1
 * @returns Hex color string with alpha channel (e.g. "#0033ff80")
 */
export function hexToHexAlpha(hex: string, alpha: number = 1): string {
	hex = hex.slice(0, 7);
	const alphaHex = Math.floor(alpha * 255)
		.toString(16)
		.padStart(2, "0");
	return `${hex}${alphaHex}`;
}

/**
 * Convert color to 20% opacity
 * @param color - Hex or RGBA color string
 * @returns Color string with 20% opacity
 */
export function colorTo20PercentOpacity(color: string): string {
	if (color.startsWith("#")) {
		return hexToRgba(color, 0.1);
	}
	return color; // If it's already RGBA, return the same color
}

/**
 * Update the opacity of an RGBA color string
 * @param plugin - TaskBoard plugin instance
 * @param rgba - RGBA color string (e.g. "rgba(0, 51, 255, 1)")
 * @param newOpacity - New opacity value between 0 and 1
 * @returns RGBA color string with updated opacity
 */
export function updateRGBAOpacity(rgba: string, newOpacity: number): string {
	let newRGBA = rgba;
	if (rgba.startsWith("#")) {
		newRGBA = hexToRgba(rgba, newOpacity);
	}

	const regex = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)$/;
	const match = newRGBA.match(regex);

	if (match) {
		return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${newOpacity})`;
	} else {
		bugReporterManagerInsatance.addToLogs(
			110,
			`rgba match : ${newRGBA}`,
			"UIHelpers.ts/updateRGBAOpacity",
		);
		return newRGBA;
	}
}

/** Create a DocumentFragment from sanitized HTML string using Obsidian API
 * @param html - HTML string to sanitize and convert
 * @returns DocumentFragment containing the sanitized HTML
 */
export const createFragmentWithHTML = (html: string) => sanitizeHTMLToDom(html);

/**
 * Maps task property names to their CSS hide class names
 * @private
 * @param property - The task property name
 * @returns The corresponding CSS hide class name
 */
export function getHideClassForProperty(property: DEFAULT_TASK_CACHE_KEYS): string {
	switch (property) {
		case DEFAULT_TASK_CACHE_KEYS.ID:
			return "hide-task-id";
		case DEFAULT_TASK_CACHE_KEYS.Tags:
			return "hide-task-tags";
		case DEFAULT_TASK_CACHE_KEYS.CreatedDate:
			return "hide-task-created";
		case DEFAULT_TASK_CACHE_KEYS.StartDate:
			return "hide-task-start";
		case DEFAULT_TASK_CACHE_KEYS.ScheduledDate:
			return "hide-task-scheduled";
		case DEFAULT_TASK_CACHE_KEYS.DueDate:
			return "hide-task-due";
		case DEFAULT_TASK_CACHE_KEYS.CompletionDate:
			return "hide-task-completion";
		case DEFAULT_TASK_CACHE_KEYS.CancelledDate:
			return "hide-task-cancelled";
		case DEFAULT_TASK_CACHE_KEYS.Priority:
			return "hide-task-priority";
		case DEFAULT_TASK_CACHE_KEYS.Time:
			return "hide-task-time";
		case DEFAULT_TASK_CACHE_KEYS.Dependencies:
			return "hide-task-dependsOn";
		case DEFAULT_TASK_CACHE_KEYS.OnCompletion:
			return "hide-task-onCompletion";
		case DEFAULT_TASK_CACHE_KEYS.Recurring:
			return "hide-task-recurring";
		default:
			return "";
	}
}
