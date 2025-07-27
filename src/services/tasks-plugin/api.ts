import TaskBoard from "main";
import { Notice, Plugin } from "obsidian";

/**
 * Tasks API v1 interface
 */
interface TasksApiV1 {

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
    createTaskLineModal(): Promise<string | null | undefined>;

    /**
     * Executes the 'Tasks: Toggle task done' command on the supplied line string
     *
     * @param line The markdown string of the task line being toggled
     * @param path The path to the file containing line
     * @returns The updated line string, which will contain two lines
     *          if a recurring task was completed.
     */
    executeToggleTaskDoneCommand(line: string, path: string): string | undefined;
}

export class TasksApi implements TasksApiV1 {
    private readonly apiV1: TasksApiV1 | null;

	public constructor(plugin?: Plugin) {
		// @ts-expect-error - official guidance for accessing the plugin, see:
		// https://publish.obsidian.md/tasks/Advanced/Tasks+Api
		const apiV1 = plugin?.app?.plugins?.plugins?.["obsidian-tasks-plugin"]?.apiV1 as TasksApiV1 | null;
		if (!apiV1) {
			// throw new Error("obsidian-tasks-plugin must be installed");
		}
		this.apiV1 = apiV1;
	}

	public isTasksPluginEnabled() {
		return !!this.apiV1;
	}

    public async createTaskLineModal(): Promise<string | null | undefined> {
        return this.apiV1?.createTaskLineModal();
    }

    public executeToggleTaskDoneCommand(line: string, path: string): string | undefined {
        return this.apiV1?.executeToggleTaskDoneCommand(line, path);
    }
}


export async function fetchTasksPluginCustomStatuses(plugin: TaskBoard) {
	try {
		const tasksPluginO = new TasksApi(plugin);
		// if( plugin.app.plugins.getPlugin("obsidian-tasks-plugin")) {
		if (tasksPluginO.isTasksPluginEnabled()) {
			// Define the path to the tasks plugin data.json file
			const path = `${plugin.app.vault.configDir}/plugins/obsidian-tasks-plugin/data.json`;

			// Read the file content
			const data: string = await plugin.app.vault.adapter.read(path);
			const parsedData = JSON.parse(data);

			// Extract customStatuses from the JSON
			const customStatuses =
				parsedData?.statusSettings?.customStatuses || [];

			// Store it in the plugin settings
			plugin.settings.data.globalSettings.tasksPluginCustomStatuses =
				customStatuses;
			plugin.saveSettings();
		}
	} catch (error) {
		console.error(
			"Error fetching custom statuses from tasks plugin:",
			error
		);
	}
}
