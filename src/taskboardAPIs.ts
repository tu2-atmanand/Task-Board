import TaskBoard from "main";
import { App } from "obsidian";
import { AddOrEditTaskModal } from "./modals/AddOrEditTaskModal";

/**
 * TaskBoardApi provides external plugins with a public API to interact with Task Board functionality.
 * This class exposes methods that allow other Obsidian plugins to integrate with Task Board features.
 *
 * @example
 * ```typescript
 * // In your plugin file
 * const taskBoardApi = this.app.plugins.plugins["task-board"]?.taskBoardApi;
 * const taskContent = await taskBoardApi.addNewTask(false);
 * ```
 */
export class TaskBoardApi {
	/**
	 * Retrieves the public API object for Task Board.
	 * This method returns an object containing all available API methods that external plugins can use.
	 *
	 * @param app - The Obsidian App instance
	 * @param plugin - The Task Board plugin instance
	 * @returns An object containing public API methods for external plugin consumption
	 *
	 * @example
	 * ```typescript
	 * const api = TaskBoardApi.GetApi(app, taskBoardPlugin);
	 * const result = await api.addNewTask(true);
	 * ```
	 */
	public static GetApi(app: App, plugin: TaskBoard) {
		return {
			/**
			 * Opens a modal to create or view a new task.
			 * This method allows external plugins to open the Task Board's task creation/editing interface.
			 *
			 * @param isTaskNote - If true, creates a Task Note (a dedicated note file for the task).
			 *                     If false, creates an inline task in the current note.
			 * @param filePath - Optional. The file path where the task should be created or edited.
			 *                   If not provided, a default location will be used for Task Notes,
			 *                   or the current note for inline tasks.
			 *
			 * @returns A Promise that resolves with the formatted task content string when the user saves.
			 *          Returns an empty string if the user cancels without saving.
			 *          Returns an error message string if an error occurs during task creation.
			 *
			 * @example
			 * ```typescript
			 * // Create a task note
			 * const taskContent = await api.addNewTask(true);
			 * console.log("Task created:", taskContent);
			 *
			 * // Create an inline task in a specific file
			 * const inlineTaskContent = await api.addNewTask(false, "path/to/file.md");
			 *
			 * // Handle the result
			 * if (taskContent === "") {
			 *   console.log("User cancelled the task creation");
			 * } else if (taskContent.startsWith("Error")) {
			 *   console.error("Failed to create task:", taskContent);
			 * } else {
			 *   console.log("Task created successfully:", taskContent);
			 * }
			 * ```
			 */
			addNewTask: (isTaskNote: boolean, filePath?: string) => {
				return this.openAddNewTaskModal(
					app,
					plugin,
					isTaskNote,
					filePath
				);
			},
		};
	}

	/**
	 * Internal method that handles opening the Add/Edit Task Modal.
	 * This method creates and displays the task modal, then waits for the user to complete their action.
	 *
	 * @param app - The Obsidian App instance
	 * @param plugin - The Task Board plugin instance
	 * @param isTaskNote - Whether to create a Task Note or inline task
	 * @param filePath - Optional file path for task creation
	 *
	 * @returns A Promise that resolves with:
	 *          - The formatted task content string if the user saves the task
	 *          - An empty string if the user cancels without saving
	 *          - An error message string if an exception occurs
	 *
	 * @internal This method should not be called directly by external plugins. Use the public API methods instead.
	 */
	public static async openAddNewTaskModal(
		app: App,
		plugin: TaskBoard,
		isTaskNote: boolean,
		filePath?: string
	): Promise<string> {
		try {
			const AddTaskModal = new AddOrEditTaskModal(
				plugin,
				(newTask, quickAddPluginChoice) => {
					// Task save callback - handled by modal's onSave event
				},
				isTaskNote,
				true,
				false,
				undefined,
				filePath
			);
			AddTaskModal.open();
			return await AddTaskModal.waitForClose;
		} catch (error) {
			console.error("Error opening add new task modal:", error);
			return String(error);
		}
	}
}
