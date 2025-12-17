import TaskBoard from "main";
import { App } from "obsidian";
import { AddOrEditTaskModal } from "./modals/AddOrEditTaskModal";

export class TaskBoardApi {
	public static GetApi(app: App, plugin: TaskBoard) {
		return {
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

	public static async openAddNewTaskModal(
		app: App,
		plugin: TaskBoard,
		isTaskNote: boolean,
		filePath?: string
	) {
		try {
			const AddTaskModal = new AddOrEditTaskModal(
				plugin,
				(newTask, quickAddPluginChoice) => {
					// return getSanitizedTaskContent(plugin, newTask);
				},
				isTaskNote,
				true,
				false,
				undefined,
				filePath
			);
			AddTaskModal.open();
			// return await AddTaskModal.returnTask();
			return await AddTaskModal.waitForClose;
		} catch (error) {
			console.error("Error opening add new task modal:", error);
			return String(error);
		}
	}
}
