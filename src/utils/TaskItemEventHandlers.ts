import { checkboxStateSwitcher, isCompleted } from "./CheckBoxUtils";
import {
	archiveTask,
	deleteTaskFromFile,
	useTasksPluginToUpdateInFile,
	updateTaskInFile,
} from "./TaskItemUtils";

import { AddOrEditTaskModal } from "src/modal/AddOrEditTaskModal";
import { DeleteConfirmationModal } from "src/modal/DeleteConfirmationModal";
import { EditButtonMode } from "src/interfaces/GlobalSettings";
import TaskBoard from "main";
import { moment as _moment } from "obsidian";
import { t } from "./lang/helper";
import { taskItem } from "src/interfaces/TaskItem";
import { isTaskRecurring } from "./TaskContentFormatter";
import { bugReporter, openEditTaskModal } from "src/services/OpenModals";
import { TasksApi } from "src/services/tasks-plugin/api";
import { isTaskNotePresentInTags } from "./TaskNoteUtils";

export const handleCheckboxChange = (plugin: TaskBoard, task: taskItem) => {
	// const task = tasks.filter(t => t.id !== task.id);
	// setTasks(updatedTasks); // This two lines were not required at all since, anyways the `writeDataToVaultFile` is running and sending and refresh emit signal.
	const tasksPlugin = new TasksApi(plugin);

	if (!tasksPlugin.isTasksPluginEnabled()) {
		// Check if the task is completed
		const newStatus = checkboxStateSwitcher(plugin, task.status);
		if (isCompleted(`- [${task.status}]`)) {
			const taskWithUpdatedStatus = {
				...task,
				completion: "",
				status: newStatus,
			};
			updateTaskInFile(plugin, taskWithUpdatedStatus, task).then(
				(newId) => {
					plugin.realTimeScanning.processAllUpdatedFiles(
						task.filePath
					);

					// // Move from Completed to Pending
					// moveFromCompletedToPending(plugin, taskWithUpdatedStatus);
				}
			);
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

			if (!isTaskRecurring(task.title)) {
				updateTaskInFile(plugin, taskWithUpdatedStatus, task).then(
					(newId) => {
						plugin.realTimeScanning.processAllUpdatedFiles(
							taskWithUpdatedStatus.filePath
						);

						// NOTE : This is not necessary any more as I am scanning the file after it has been updated.
						// Move from Pending to Completed
						// moveFromPendingToCompleted(plugin, taskWithUpdatedStatus);
					}
				);
			} else {
				bugReporter(
					plugin,
					"Tasks plugin is must for handling recurring tasks. Since the task you are trying to update is a recurring task and Task Board cannot handle recurring tasks as of now. Hence the plugin has not updated your content.",
					`Tasks plugin installed and enabled: ${tasksPlugin.isTasksPluginEnabled()}`,
					"TaskItemUtils.ts/useTasksPluginToUpdateInFile"
				);

				// useTasksPluginToUpdateInFile(plugin, tasksPlugin, task)
				// 	.then(() => {
				// 		plugin.realTimeScanning.processAllUpdatedFiles(
				// 			task.filePath
				// 		);
				// 	})
				// 	.catch((error) => {
				// 		console.error(
				// 			"TaskItemEventHandlers.ts : Error updating recurring task in file",
				// 			error
				// 		);
				// 	});
			}

			// // Move from Pending to Completed
			// moveFromPendingToCompleted(plugin, taskWithUpdatedStatus);
		}
	} else {
		useTasksPluginToUpdateInFile(plugin, tasksPlugin, task)
			.then(() => {
				plugin.realTimeScanning.processAllUpdatedFiles(task.filePath);

				// NOTE : This is not necessary any more as I am scanning the file after it has been updated.
				// 	// Move from Pending to Completed
				// 	moveFromPendingToCompleted(plugin, taskWithUpdatedStatus);
			})
			.catch((error) => {
				// bugReporter(
				// 	plugin,
				// 	"Error updating recurring task in file",
				// 	error as string,
				// 	"TaskItemEventHandlers.ts/handleCheckboxChange"
				// );
				console.error(
					"TaskItemEventHandlers.ts : Error updating recurring task in file",
					error
				);
			});
	}
	// NOTE : The eventEmitter.emit("REFRESH_COLUMN") is being sent from the moveFromPendingToCompleted and moveFromCompletedToPending functions, because if i add that here, then all the things are getting executed parallely instead of sequential.
};

export const handleSubTasksChange = (
	plugin: TaskBoard,
	oldTask: taskItem,
	updatedTask: taskItem
) => {
	// updateTaskInJson(plugin, updatedTask); // TODO : This is not necessary any more as I am scanning the file after it has been updated.
	updateTaskInFile(plugin, updatedTask, oldTask)
		.then((newId) => {
			plugin.realTimeScanning.processAllUpdatedFiles(
				updatedTask.filePath
			);
		});
};

export const handleDeleteTask = (plugin: TaskBoard, task: taskItem) => {
	const mssg = t("confirm-task-delete-description");
	const app = plugin.app;
	const deleteModal = new DeleteConfirmationModal(app, {
		app,
		mssg,
		onConfirm: () => {
			deleteTaskFromFile(plugin, task).then(() => {
				plugin.realTimeScanning.processAllUpdatedFiles(task.filePath);
			});

			// deleteTaskFromJson(plugin, task); // NOTE : No need to run any more as I am scanning the file after it has been updated.
			// Remove the task from state after deletion
			// setTasks((prevTasks) => prevTasks.filter(t => t.id !== task.id)); // This line were not required at all since, anyways the `writeDataToVaultFile` is running and sending and refresh emit signal.
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
		const isTaskNote = isTaskNotePresentInTags(task.tags);
		openEditTaskModal(plugin, task, isTaskNote);
		// const editTaskModal = new AddOrEditTaskModal(
		// 	plugin,
		// 	(updatedTask, quickAddPluginChoice) => {
		// 		updatedTask.filePath = task.filePath;
		// 		// Update the task in the file and JSON
		// 		updateTaskInFile(plugin, updatedTask, task)
		// 			.then(() => {
		// 				plugin.realTimeScanning.processAllUpdatedFiles(
		// 					updatedTask.filePath
		// 				);
		// 			})
		// 			.catch((error) => {
		// 				// bugReporter(
		// 				// 	plugin,
		// 				// 	"Error updating task in file",
		// 				// 	error as string,
		// 				// 	"TaskItemEventHandlers.ts/handleEditTask"
		// 				// );
		// 				console.error(
		// 					"TaskItemEventHandlers.ts : Error updating task in file",
		// 					error
		// 				);
		// 			});

		// 		// updateTaskInJson(plugin, updatedTask); // NOTE : This is not necessary any more as I am scanning the file after it has been updated.

		// 		// setTasks((prevTasks) =>
		// 		// 	prevTasks.map((task) =>
		// 		// 		task.id === updatedTask.id ? { ...task, ...updatedTask } : task
		// 		// 	)
		// 		// );
		// 		// NOTE : The eventEmitter.emit("REFRESH_COLUMN") is being sent from the updateTaskInJson function, because if i add that here, then all the things are getting executed parallely instead of sequential.
		// 	},
		// 	isTaskNote,
		// 	false,
		// 	true,
		// 	task,
		// 	task.filePath
		// );
		// editTaskModal.open();
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
