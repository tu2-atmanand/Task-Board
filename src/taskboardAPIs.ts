import TaskBoard from "main";
import { App } from "obsidian";
import { AddOrEditTaskModal } from "./modal/AddOrEditTaskModal";
import { taskContentFormatter } from "./utils/TaskContentFormatter";

export class TaskBoardApi {
	public static GetApi(app: App, plugin: TaskBoard) {
		return {
			addNewTask: (filePath?: string) => {
				return this.openAddNewTaskModal(app, plugin, filePath);
			},
		};
	}

	public static async openAddNewTaskModal(
		app: App,
		plugin: TaskBoard,
		filePath?: string
	) {
		try {
			const AddTaskModal = new AddOrEditTaskModal(
				app,
				plugin,
				(newTask, quickAddPluginChoice) => {
					// return taskContentFormatter(plugin, newTask);
				},
				true,
				false,
				undefined,
				filePath
			);
			AddTaskModal.open();
			// return await AddTaskModal.returnTask();
			return await AddTaskModal.waitForClose;
		} catch {
			return undefined;
		}
	}
}
