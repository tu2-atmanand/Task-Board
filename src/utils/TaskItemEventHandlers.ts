import {
	deleteTaskFromFile,
	deleteTaskFromJson,
	moveFromCompletedToPending,
	moveFromPendingToCompleted,
	updateTaskInFile,
	updateTaskInJson,
} from "./TaskItemUtils";

import { AddOrEditTaskModal } from "src/modal/AddOrEditTaskModal";
import { DeleteConfirmationModal } from "src/modal/DeleteConfirmationModal";
import { EditButtonMode } from "src/interfaces/GlobalSettings";
import TaskBoard from "main";
import { moment as _moment } from "obsidian";
import { t } from "./lang/helper";
import { taskItem } from "src/interfaces/TaskItemProps";

export const handleCheckboxChange = (
	plugin: TaskBoard,
	updatedTask: taskItem
) => {
	// const updatedTasks = tasks.filter(t => t.id !== updatedTask.id);
	// setTasks(updatedTasks); // This two lines were not required at all since, anyways the `writeDataToVaultFiles` is running and sending and refresh emit signal.

	// Check if the task is completed
	if (updatedTask.completed) {
		const taskWithCompleted = { ...updatedTask, completed: "" };
		// Move from Completed to Pending
		moveFromCompletedToPending(plugin, taskWithCompleted);
		updateTaskInFile(plugin, taskWithCompleted, taskWithCompleted);
	} else {
		const globalSettings = plugin.settings.data.globalSettings;
		const moment = _moment as unknown as typeof _moment.default;
		const taskWithCompleted = {
			...updatedTask,
			completed: moment().format(
				globalSettings?.taskCompletionDateTimePattern
			),
		};
		// Move from Pending to Completed
		moveFromPendingToCompleted(plugin, taskWithCompleted);
		updateTaskInFile(plugin, taskWithCompleted, taskWithCompleted);
	}
	// NOTE : The eventEmitter.emit("REFRESH_COLUMN") is being sent from the moveFromPendingToCompleted and moveFromCompletedToPending functions, because if i add that here, then all the things are getting executed parallely instead of sequential.
};

export const handleSubTasksChange = (
	plugin: TaskBoard,
	updatedTask: taskItem
) => {
	updateTaskInJson(plugin, updatedTask);
	updateTaskInFile(plugin, updatedTask, updatedTask);
};

export const handleDeleteTask = (plugin: TaskBoard, task: taskItem) => {
	const mssg = t("confirm-task-delete-description");
	const app = plugin.app;
	const deleteModal = new DeleteConfirmationModal(app, {
		app,
		mssg,
		onConfirm: () => {
			deleteTaskFromFile(plugin, task);
			deleteTaskFromJson(plugin, task);
			// Remove the task from state after deletion
			// setTasks((prevTasks) => prevTasks.filter(t => t.id !== task.id)); // This line were not required at all since, anyways the `writeDataToVaultFiles` is running and sending and refresh emit signal.
		},
		onCancel: () => {
			// console.log('Task deletion canceled');
		},
	});
	deleteModal.open();
};

export const handleEditTask = (plugin: TaskBoard, task: taskItem) => {
	if (
		plugin.settings.data.globalSettings.editButtonAction ===
		EditButtonMode.PopUp
	) {
		const editModal = new AddOrEditTaskModal(
			plugin.app,
			plugin,
			(updatedTask) => {
				updatedTask.filePath = task.filePath;
				// Update the task in the file and JSON
				updateTaskInFile(plugin, updatedTask, task);
				updateTaskInJson(plugin, updatedTask);

				// setTasks((prevTasks) =>
				// 	prevTasks.map((task) =>
				// 		task.id === updatedTask.id ? { ...task, ...updatedTask } : task
				// 	)
				// );
				// NOTE : The eventEmitter.emit("REFRESH_COLUMN") is being sent from the updateTaskInJson function, because if i add that here, then all the things are getting executed parallely instead of sequential.
			},
			task.filePath,
			true,
			task
		);
		editModal.open();
	} else if (
		plugin.settings.data.globalSettings.editButtonAction ===
		EditButtonMode.NoteInTab
	) {
		const getFile = plugin.app.vault.getFileByPath(task.filePath);
		if (getFile) {
			plugin.app.workspace.getLeaf("tab").openFile(getFile);
		}
	} else if (
		plugin.settings.data.globalSettings.editButtonAction ===
		EditButtonMode.NoteInSplit
	) {
		const getFile = plugin.app.vault.getFileByPath(task.filePath);
		if (getFile) {
			plugin.app.workspace.getLeaf("split").openFile(getFile);
		}
	} else if (
		plugin.settings.data.globalSettings.editButtonAction ===
		EditButtonMode.NoteInWindow
	) {
		const getFile = plugin.app.vault.getFileByPath(task.filePath);
		if (getFile) {
			plugin.app.workspace.getLeaf("window").openFile(getFile);
		}
	} else {
		// markdownButtonHoverPreviewEvent(app, event, task.filePath);
	}
};
