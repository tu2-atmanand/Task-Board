import { checkboxStateSwitcher, isCompleted } from "./CheckBoxUtils";
import {
	archiveTask,
	deleteTaskFromFile,
	deleteTaskFromJson,
	moveFromCompletedToPending,
	moveFromPendingToCompleted,
	updateRecurringTaskInFile,
	updateTaskInFile,
	updateTaskInJson,
} from "./TaskItemUtils";

import { AddOrEditTaskModal } from "src/modal/AddOrEditTaskModal";
import { DeleteConfirmationModal } from "src/modal/DeleteConfirmationModal";
import { EditButtonMode } from "src/interfaces/GlobalSettings";
import TaskBoard from "main";
import { moment as _moment } from "obsidian";
import { t } from "./lang/helper";
import { taskItem } from "src/interfaces/TaskItem";
import { isTaskRecurring } from "./TaskContentFormatter";

export const handleCheckboxChange = (plugin: TaskBoard, task: taskItem) => {
	// const task = tasks.filter(t => t.id !== task.id);
	// setTasks(updatedTasks); // This two lines were not required at all since, anyways the `writeDataToVaultFiles` is running and sending and refresh emit signal.

	// Check if the task is completed
	const newStatus = checkboxStateSwitcher(plugin, task.status);
	if (isCompleted(`- [${task.status}]`)) {
		const taskWithUpdatedStatus = {
			...task,
			completion: "",
			status: newStatus,
		};
		// Move from Completed to Pending
		moveFromCompletedToPending(plugin, taskWithUpdatedStatus);
		updateTaskInFile(plugin, taskWithUpdatedStatus, taskWithUpdatedStatus);
	} else {
		const globalSettings = plugin.settings.data.globalSettings;
		const moment = _moment as unknown as typeof _moment.default;
		const taskWithUpdatedStatus = {
			...task,
			completion: moment().format(
				globalSettings?.taskCompletionDateTimePattern
			),
			status: newStatus,
		};
		// Move from Pending to Completed
		moveFromPendingToCompleted(plugin, taskWithUpdatedStatus);

		if (!isTaskRecurring(task.title)) {
			updateTaskInFile(
				plugin,
				taskWithUpdatedStatus,
				taskWithUpdatedStatus
			);
		} else {
			updateRecurringTaskInFile(plugin, taskWithUpdatedStatus, task);
		}
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
		onArchive: () => {
			archiveTask(plugin, task);
		},
	});
	deleteModal.open();
};

export const handleEditTask = (plugin: TaskBoard, task: taskItem) => {
	if (
		plugin.settings.data.globalSettings.editButtonAction ===
		EditButtonMode.PopUp
	) {
		const editTaskModal = new AddOrEditTaskModal(
			plugin.app,
			plugin,
			(updatedTask, quickAddPluginChoice) => {
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
			false,
			true,
			task,
			task.filePath
		);
		editTaskModal.open();
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
