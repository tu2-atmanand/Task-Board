import type TaskBoard from "main";
import { Notice } from "obsidian";
import { statusTypeNames } from "src/interfaces/Enums";
import { CustomStatus, PluginDataJson } from "src/interfaces/GlobalSettings";
import { bugReporterManagerInsatance } from "src/managers/BugReporter";
import { TaskRegularExpressions } from "src/regularExpressions/TasksPluginRegularExpr";

/**
 * Switches the checkbox state based on the current symbol.
 * @param plugin - The plugin instance.
 * @param symbol - The current checkbox symbol.
 * @returns The next checkbox state symbol.
 */
export function checkboxStateSwitcher(
	plugin: TaskBoard,
	symbol: string,
): { newSymbol: string; newSymbolType: string } {
	const { customStatuses } = plugin.settings.data.globalSettings;

	// Check if customStatuses is available and has entries
	if (customStatuses?.length > 0) {
		const oldStatus = customStatuses.find(
			(status) => status.symbol === symbol,
		);
		if (oldStatus) {
			const nextStatus = customStatuses.find(
				(status) => status.symbol === oldStatus?.nextStatusSymbol,
			);
			if (nextStatus) {
				return {
					newSymbol: oldStatus.nextStatusSymbol,
					newSymbolType: nextStatus?.type,
				};
			}
		}
	}

	new Notice(
		"customStatuses is not available or empty. Please check your settings. Falling back to default behavior.",
	);
	// Default fallback behavior
	return symbol === "x" || symbol === "X"
		? {
				newSymbol: " ",
				newSymbolType: statusTypeNames.TODO,
			}
		: {
				newSymbol: "x",
				newSymbolType: statusTypeNames.DONE,
			};
}

/**
 * Determines if a task is completed based on its title or symbol.
 * @param titleOrSymbol - The title if its a inline-task, or the symbol (task.status) if its a task-note.
 * @param isTaskNote - A boolean indicating whether the task is a task note.
 * @param settings - The plugin settings.
 * @returns True if the symbol represents a completed state, otherwise false.
 */
export function isTaskCompleted(
	titleOrSymbol: string,
	isTaskNote: boolean,
	settings: PluginDataJson,
): boolean {
	// console.log(
	// 	"isTaskCompleted...\ntitleOrSymbol :",
	// 	titleOrSymbol,
	// 	"\nisTaskNote :",
	// 	isTaskNote
	// );
	if (!isTaskNote) {
		// const match = task.title.match(/\s\[(.)\]/); // Extract the symbol inside [ ]
		// // console.log("CheckBoxUtils.ts : isCompleted : match :", match);
		// if (!match || match.length < 2) return false;

		let symbol = " ";
		if (titleOrSymbol.trim().length === 1) {
			symbol = titleOrSymbol;
		} else {
			symbol = extractCheckboxSymbol(titleOrSymbol);
		}
		// return (
		// 	symbol === defaultTaskStatuses.regular ||
		// 	symbol === defaultTaskStatuses.checked ||
		// 	symbol === defaultTaskStatuses.done ||
		// 	symbol === defaultTaskStatuses.dropped
		// );

		const tasksPluginStatusConfigs =
			settings.data.globalSettings.customStatuses;
		let flag = false;
		tasksPluginStatusConfigs.some((customStatus: CustomStatus) => {
			// console.log("customStatus :", customStatus, "\nsymbol :", symbol);
			if (
				customStatus.symbol === symbol &&
				(customStatus.type === "DONE" ||
					customStatus.type === "CANCELLED")
			) {
				flag = true;
				return true;
			}
		});
		return flag;
	} else {
		const tasksPluginStatusConfigs =
			settings.data.globalSettings.customStatuses;
		let flag = false;
		tasksPluginStatusConfigs.some((customStatus: CustomStatus) => {
			if (
				customStatus.symbol === titleOrSymbol &&
				(customStatus.type === "DONE" ||
					customStatus.type === "CANCELLED")
			) {
				flag = true;
				return true;
			}
		});
		return flag;
	}
}

/**
 * Determines if a line is a task.
 * @param line - The line of text to check.
 * @returns Returns "True" if the line matches the task pattern, otherwise "False".
 */
export function isTaskLine(line: string): boolean {
	line = line.trim();
	const regexMatch = line.match(TaskRegularExpressions.taskRegex);
	// return /^- \[[^\]]\]\s+.*\S/.test(line);
	return (
		regexMatch !== null &&
		regexMatch.length > 0 &&
		regexMatch[0].trim().length > 0
	);
}

/**
 * Extracts the checkbox symbol from a task string.
 * @param task - The task string in the format '- [symbol]'.
 * @returns The checkbox symbol.
 */
export function extractCheckboxSymbol(task: string): string {
	const match = task.match(/\[(.)\]/); // Extract the symbol inside [ ]
	if (!match || match.length < 2) return " ";

	return match[1];
}

/**
 * Gets the indentation settings from Obsidian configuration.
 * @param plugin - The TaskBoard plugin instance.
 * @returns The indentation string.
 */
export function getObsidianIndentationSetting(plugin: TaskBoard): string {
	try {
		if (plugin.app.vault.config) {
			plugin.app;
			const tabSize = plugin.app.vault.config.tabSize || 4; // Default to 4 if not set
			return plugin.app.vault.config.useTab ? `\t` : " ".repeat(tabSize);
		}
		return `\t`; // Default indentation value
	} catch {
		// Fallback: try to read the vault's .obsidian/app.json to get tabSize / useTab
		try {
			const path = `${plugin.app.vault.configDir}/app.json`;
			plugin.app.vault.adapter.read(path).then((content: string) => {
				const parsed = JSON.parse(content || "{}");
				const tabSize =
					typeof parsed?.tabSize === "number" ? parsed.tabSize : 4;
				return parsed?.useTab ? `\t` : " ".repeat(tabSize);
			});
			return `\t`; // Default indentation while async read happens
		} catch (err) {
			bugReporterManagerInsatance.addToLogs(
				108,
				String(err),
				"CheckBoxUtils.ts/getObsidianIndentationSetting",
			);
			return `\t`;
		}
	}
}

/**
 * Asynchronous version to get Obsidian indentation settings.
 * @param plugin - The TaskBoard plugin instance.
 * @returns A promise that resolves to the indentation string.
 */
export async function getObsidianIndentationSettingAsync(
	plugin: TaskBoard,
): Promise<string> {
	try {
		if (plugin.app.vault.config) {
			const tabSize = plugin.app.vault.config.tabSize || 4; // Default to 4 if not set
			return plugin.app.vault.config.useTab ? `\t` : " ".repeat(tabSize);
		}
		return `\t`; // Default indentation value
	} catch {
		// Fallback: try to read the vault's .obsidian/app.json to get tabSize / useTab
		try {
			const path = `${plugin.app.vault.configDir}/app.json`;
			const content: string = await plugin.app.vault.adapter.read(path);
			const parsed = JSON.parse(content || "{}");
			const tabSize =
				typeof parsed?.tabSize === "number" ? parsed.tabSize : 4;
			const useTab = !!parsed?.useTab;
			return useTab ? `\t` : " ".repeat(tabSize);
		} catch (err) {
			bugReporterManagerInsatance.addToLogs(
				109,
				String(err),
				"CheckBoxUtils.ts/getObsidianIndentationSettingAsync",
			);
			return `\t`;
		}
	}
}
