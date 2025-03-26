import { taskStatuses } from "src/interfaces/TaskItemProps";

/**
 * Switches the checkbox state based on the current symbol.
 * @param plugin - The plugin instance.
 * @param symbol - The current checkbox symbol.
 * @returns The next checkbox state symbol.
 */
export function checkboxStateSwitcher(plugin: any, symbol: string): string {
	const { tasksPluginCustomStatuses, customStatuses } =
		plugin.settings.data.globalSettings;

	// Check if tasksPluginCustomStatuses is available and has entries
	if (tasksPluginCustomStatuses?.length > 0) {
		const foundStatus = tasksPluginCustomStatuses.find(
			(status: { symbol: string }) => status.symbol === symbol
		);
		if (foundStatus) return foundStatus.nextStatusSymbol;
	} else if (customStatuses?.length > 0) {
		const foundStatus = customStatuses.find(
			(status: { symbol: string }) => status.symbol === symbol
		);
		if (foundStatus) return foundStatus.nextStatusSymbol;
	}

	// Default fallback behavior
	return symbol === "x" || symbol === "X" ? " " : "x";
}

/**
 * Checks if a given task string is marked as completed.
 * @param task - The task string in the format '- [symbol]'.
 * @returns True if the symbol represents a completed state, otherwise false.
 */
export function isCompleted(task: string): boolean {
	const match = task.match(/-\s\[(.)\]/); // Extract the symbol inside [ ]
	if (!match || match.length < 2) return false;

	const symbol = match[1];
	return (
		symbol === taskStatuses.regular ||
		symbol === taskStatuses.checked ||
		symbol === taskStatuses.dropped
	);
}

/**
 * Determines if a line is a task.
 * @param line - The line of text to check.
 * @returns True if the line matches the task pattern, otherwise false.
 */
export function isTaskLine(line: string): boolean {
	const trimmedLine = line.trim();
	return /^- \[.\]/.test(trimmedLine) && trimmedLine.length > 5;
}

/**
 * Extracts the checkbox symbol from a task string.
 * @param task - The task string in the format '- [symbol]'.
 * @returns The checkbox symbol.
 */
export function extractCheckboxSymbol(task: string): string {
	const match = task.match(/- \[(.)\]/); // Extract the symbol inside [ ]
	if (!match || match.length < 2) return " ";

	return match[1];
}
