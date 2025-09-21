import TaskBoard from "main";
import { Notice, Plugin } from "obsidian";

/**
 * Tasks API v1 interface
 */
interface TasksPluginApiV1 {
	/**
	 * Checks if the Tasks plugin is enabled.
	 *
	 * @returns {boolean} True if the Tasks plugin is enabled, false otherwise.
	 */
	isTasksPluginEnabled(): boolean;

	/**
	 * Opens the Tasks UI and returns the Markdown string for the task entered.
	 *
	 * @returns {Promise<string>} A promise that contains the Markdown string for the task entered or
	 * an empty string, if data entry was cancelled.
	 */
	createTaskLineModal(): Promise<string>;

	/**
	 * Opens the Tasks UI pre-filled with the provided task line for editing.
	 * Does not edit the task line in the file, but returns the edited task line as a Markdown string.
	 *
	 * @param taskLine The markdown string of the task line to edit
	 * @returns {Promise<string>} A promise that contains the Markdown string for the edited task or
	 * an empty string in the case where the data entry was cancelled.
	 */
	editTaskLineModal(taskLine: string): Promise<string>;

	/**
	 * Executes the 'Tasks: Toggle task done' command on the supplied line string
	 *
	 * @param line The markdown string of the task line being toggled
	 * @param path The path to the file containing line
	 * @returns The updated line string, which will contain two lines
	 *          if a recurring task was completed.
	 */
	executeToggleTaskDoneCommand: (line: string, path: string) => string;
}

export class TasksPluginApi implements TasksPluginApiV1 {
	private readonly apiV1: TasksPluginApiV1 | null;

	public constructor(plugin?: Plugin) {
		// @ts-expect-error - official guidance for accessing the plugin, see:
		// https://publish.obsidian.md/tasks/Advanced/Tasks+Api
		const apiV1 = plugin?.app?.plugins?.plugins?.["obsidian-tasks-plugin"]?.apiV1 as TasksPluginApiV1 | null;
		if (!apiV1) {
			// throw new Error("obsidian-tasks-plugin must be installed");
		}
		this.apiV1 = apiV1;
	}

	public isTasksPluginEnabled() {
		return !!this.apiV1;
	}

	public editTaskLineModal(taskLine: string): Promise<string> {
		if (this.apiV1) {
			return this.apiV1.editTaskLineModal(taskLine);
		}
		return Promise.resolve("");
	}

	public async createTaskLineModal(): Promise<string> {
		const result = await this.apiV1?.createTaskLineModal();
		return typeof result === "string" ? result : "";
	}

	public executeToggleTaskDoneCommand(line: string, path: string): string {
		const result = this.apiV1?.executeToggleTaskDoneCommand(line, path);
		return typeof result === "string" ? result : "";
	}
}
