import { checkboxStateSwitcher } from "../CheckBoxUtils";
import {
	archiveTask,
	deleteTaskFromFile,
	useTasksPluginToUpdateInFile,
	updateTaskInFile,
	isTaskRecurring,
} from "./TaskLineUtils";
import TaskBoard from "main";
import { moment as _moment } from "obsidian";
import { t } from "../lang/helper";
import { taskItem } from "src/interfaces/TaskItem";
import { TasksPluginApi } from "src/services/tasks-plugin/api";
import { archiveTaskNote, deleteTaskNote } from "../taskNote/TaskNoteUtils";
import { DeleteConfirmationModal } from "src/modals/DeleteConfirmationModal";
import { eventEmitter } from "src/services/EventEmitter";
import { sanitizeStatus } from "./TaskContentFormatter";
import { bugReporterManagerInsatance } from "src/managers/BugReporter";

/**
 * Handle the checkbox change event for the inline-tasks and update the task in the file.
 * @param plugin - Taskboard plugin instance
 * @param task - TaskItem to update
 */
export const handleCheckboxChange = (plugin: TaskBoard, task: taskItem) => {
	// const task = tasks.filter(t => t.id !== task.id);
	// setTasks(updatedTasks); // This two lines were not required at all since, anyways the `writeDataToVaultFile` is running and sending and refresh emit signal.
	const tasksPlugin = new TasksPluginApi(plugin);

	if (!isTaskRecurring(task.title)) {
		// Check if the task is completed
		const newStatus = checkboxStateSwitcher(plugin, task.status);
		const newTitle = sanitizeStatus(
			plugin.settings.data.globalSettings,
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
		// 		globalSettings?.taskCompletionDateTimePattern
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
