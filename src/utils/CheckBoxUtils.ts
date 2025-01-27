import { taskStatuses } from "src/interfaces/TaskItemProps";

/**
 * Switches the checkbox state based on the current symbol.
 * @param plugin - The plugin instance.
 * @param symbol - The current checkbox symbol.
 * @returns The next checkbox state symbol.
 */
export function checkboxStateSwitcher(plugin: any, symbol: string): string {
	console.log("checkboxStateSwitcher : symbol : ", symbol);
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
		console.log("checkboxStateSwitcher : nextStatusSymbol : ", foundStatus.nextStatusSymbol);
		if (foundStatus) return foundStatus.nextStatusSymbol;
	}

	// Default fallback behavior
	return symbol === " " ? "x" : " ";
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
    return /^- \[.\]/.test(line);
}

/**
 * Extracts the checkbox symbol from a task string.
 * @param task - The task string in the format '- [symbol]'.
 * @returns The checkbox symbol.
 */
export function extractCheckboxSymbol(task: string): string {
	const match = task.match(/- \[(.)\]/); // Extract the symbol inside [ ]
	if (!match || match.length < 2) return " ";

	console.log("match[1] : ", match[1]);
	return match[1];
}
