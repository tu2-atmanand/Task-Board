// /src/utils/taskLine/TaskItemEventHandlers.ts

import { t } from "i18next";
import TaskBoard from "../../../main.js";
import { taskItem } from "../../interfaces/TaskItem.js";
import { bugReporterManagerInsatance } from "../../managers/BugReporter.js";
import { DeleteConfirmationModal } from "../../modals/DeleteConfirmationModal.js";
import { eventEmitter } from "../../services/EventEmitter.js";
import { TasksPluginApi } from "../../services/tasks-plugin/api.js";
import { checkboxStateSwitcher } from "../CheckBoxUtils.js";
import { deleteTaskNote, archiveTaskNote } from "../taskNote/TaskNoteUtils.js";
import { sanitizeStatus } from "./TaskContentFormatter.js";
import { isTaskRecurring, updateTaskInFile, useTasksPluginToUpdateInFile, deleteTaskFromFile, archiveTask } from "./TaskLineUtils.js";


/**
 * Handle the checkbox change event for the inline-tasks and update the task in the file.
 * @param plugin - Taskboard plugin instance
 * @param task - TaskItem to update
 */
export const handleCheckboxChange = (plugin: TaskBoard, task: taskItem) => {
	// const task = tasks.filter(t => t.id !== task.id);
	// setTasks(updatedTasks); // This two lines were not required at all since, anyways the `writeDataToVaultFile` is running and sending and refresh emit signal.
	const tasksPlugin = new TasksPluginApi(plugin);
	const globalSettings = plugin.settings.data;

	if (!isTaskRecurring(task.title)) {
		// Check if the task is completed
		const newStatus = checkboxStateSwitcher(
			globalSettings.customStatuses,
			task.status,
		);
		const newTitle = sanitizeStatus(
			globalSettings,
			task.title,
			newStatus.newSymbol,
			newStatus.newSymbolType,
		);
		const taskWithUpdatedStatus = {
			...task,
			title: newTitle,
			status: newStatus.newSymbol,
		};

		updateTaskInFile(plugin, taskWithUpdatedStatus, task).then((newId) => {
			plugin.realTimeScanner.processAllUpdatedFiles(
				task.filePath,
				task.legacyId,
			);

			// DEPRECATED : See notes from //src/utils/TaskItemCacheOperations.ts file
			// moveFromCompletedToPending(plugin, taskWithUpdatedStatus);
		});

		// if (isTaskCompleted(`- [${task.status}]`, false, plugin.settings)) {
		// 	const newStatusType =
		// 		plugin.settings.data.globalSettings.customStatuses.find(
		// 			(status) => status.symbol === newStatus
		// 		)?.type ?? statusTypeNames.TODO;
		// 	let newTitle = sanitizeStatus(task.title, newStatus.newSymbol);

		// 	const taskWithUpdatedStatus = {
		// 		...task,
		// 		title: newTitle,
		// 		completion: "",
		// 		status: newStatus.newSymbol,
		// 	};

		// 	updateTaskInFile(plugin, taskWithUpdatedStatus, task).then(
		// 		(newId) => {
		// 			plugin.realTimeScanner.processAllUpdatedFiles(
		// 				task.filePath,
		// 				task.legacyId
		// 			);

		// 			// DEPRECATED : See notes from //src/utils/TaskItemCacheOperations.ts file
		// 			// moveFromCompletedToPending(plugin, taskWithUpdatedStatus);
		// 		}
		// 	);
		// } else {
		// 	const globalSettings = plugin.settings.data.globalSettings;
		// 	const moment = _moment as unknown as typeof _moment.default;
		// 	const currentDateValue = moment().format(
		// 		globalSettings?.dateTimeFormat
		// 	);
		// 	let newTitle = "";
		// 	if (newStatus.type === statusTypeNames.DONE) {
		// 		newTitle = sanitizeCompletionDate(
		// 			globalSettings,
		// 			task.title,
		// 			currentDateValue
		// 		);
		// 	} else if (newStatus.type === statusTypeNames.CANCELLED) {
		// 		newTitle = sanitizeCancelledDate(
		// 			globalSettings,
		// 			task.title,
		// 			currentDateValue
		// 		);
		// 	}

		// 	const taskWithUpdatedStatus = {
		// 		...task,
		// 		title: newTitle,
		// 		status: newStatus.newSymbol,
		// 	};

		// 	updateTaskInFile(plugin, taskWithUpdatedStatus, task).then(
		// 		(newId) => {
		// 			plugin.realTimeScanner.processAllUpdatedFiles(
		// 				taskWithUpdatedStatus.filePath
		// 			);

		// 			// DEPRECATED : See notes from //src/utils/TaskItemCacheOperations.ts file
		// 			// moveFromPendingToCompleted(plugin, taskWithUpdatedStatus);
		// 		}
		// 	);
		// }
	} else {
		if (tasksPlugin.isTasksPluginEnabled()) {
			useTasksPluginToUpdateInFile(plugin, tasksPlugin, task)
				.then(() => {
					plugin.realTimeScanner.processAllUpdatedFiles(
						task.filePath,
						task.legacyId,
					);

					// NOTE : This is not necessary any more as I am scanning the file after it has been updated.
					// 	// Move from Pending to Completed
					// 	moveFromPendingToCompleted(plugin, taskWithUpdatedStatus);
				})
				.catch((err) => {
					bugReporterManagerInsatance.addToLogs(
						152,
						String(err),
						"TaskItemEventHandlers.ts/handleCheckboxChange",
					);
				});
		} else {
			bugReporterManagerInsatance.showNotice(
				45,
				"Task Board do not support recurring tasks yet. Tasks plugin is required to work with recurring inline-tasks. No changes has been made.",
				`Tasks plugin installed and enabled: ${tasksPlugin.isTasksPluginEnabled()}`,
				"TaskItemUtils.ts/useTasksPluginToUpdateInFile",
			);
		}
	}
};

/**
 * Handle subtasks change event. This function is basically updating the content in the file using the `updateTaskInFile` function.
 * @param plugin - Taskboard plugin instance
 * @param oldTask - TaskItem to update
 * @param updatedTask - TaskItem with updated subtasks
 */
export const handleSubTasksChange = (
	plugin: TaskBoard,
	oldTask: taskItem,
	updatedTask: taskItem,
) => {
	// DEPRECATED : See notes from //src/utils/TaskItemCacheOperations.ts file
	// updateTaskInJson(plugin, updatedTask);

	updateTaskInFile(plugin, updatedTask, oldTask).then((newId) => {
		plugin.realTimeScanner.processAllUpdatedFiles(
			updatedTask.filePath,
			oldTask.id,
		);
	});
};

/**
 * Handle task deletion event by showing a confirmation modal where user can select whether to remove the task content from the file, comment it out or archive it into another file.
 * @param plugin - Taskboard plugin instance
 * @param task - Task note to delete
 * @param isTaskNote - Boolean indicating if the task is deleted
 */
export const handleDeleteTask = (
	plugin: TaskBoard,
	task: taskItem,
	isTaskNote: boolean,
) => {
	const mssg = t("confirm-task-delete-description");
	const app = plugin.app;
	const deleteModal = new DeleteConfirmationModal(app, {
		app,
		mssg,
		onConfirm: () => {
			if (isTaskNote) {
				deleteTaskNote(plugin, task.filePath);
			} else {
				deleteTaskFromFile(plugin, task).then(() => {
					plugin.realTimeScanner.processAllUpdatedFiles(
						task.filePath,
					);
				});

				// DEPRECATED : See notes from //src/utils/TaskItemCacheOperations.ts file
				// deleteTaskFromJson(plugin, task);
				// Remove the task from state after deletion
				// setTasks((prevTasks) => prevTasks.filter(t => t.id !== task.id)); // This line were not required at all since, anyways the `writeDataToVaultFile` is running and sending and refresh emit signal.
			}
		},
		onCancel: () => {
			// console.log('Task deletion canceled');
		},
		onArchive: () => {
			if (isTaskNote) {
				archiveTaskNote(plugin, task.filePath).then(() => {
					eventEmitter.emit("REFRESH_COLUMN");
				});
			} else {
				archiveTask(plugin, task);
			}
		},
	});
	deleteModal.open();
};
