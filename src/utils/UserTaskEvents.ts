// /src/utils/UserTaskEvents.ts

import { WorkspaceLeaf, TFile, Notice } from "obsidian";

import { t } from "i18next";
import TaskBoard from "../../main.js";
import {
	EditButtonMode,
	statusTypeNames,
	UniversalDateOptions,
	PropertyTypeConfig,
} from "../interfaces/Enums.js";
import { globalSettingsData } from "../interfaces/GlobalSettings.js";
import {
	coerceCustomTaskPropertyValue,
	taskItem,
	UpdateTaskEventData,
} from "../interfaces/TaskItem.js";
import { bugReporterManagerInsatance } from "../core/managers/BugReporter.js";
import { eventEmitter } from "../services/EventEmitter.js";
import {
	openEditTaskNoteModal,
	openEditTaskModal,
	openEditTaskView,
} from "../ui/modals/OpenModals.js";
import { openTasksPluginEditModal } from "../services/tasks_plugin/helpers.js";
import { verifySubtasksAndChildtasksAreComplete } from "../core/algorithms/ScanningFilterer.js";
import {
	sanitizeStatus,
	sanitizePriority,
	sanitizeStartDate,
	sanitizeScheduledDate,
	sanitizeDueDate,
	sanitizeReminder,
	sanitizeTags,
} from "./task_line/TaskContentFormatter.js";
import { updateTaskInFile } from "./task_line/TaskLineUtils.js";
import {
	isTaskNotePresentInTags,
	updateFrontmatterInMarkdownFile,
} from "./task_note/TaskNoteUtils.js";
import { DEFAULT_TASK_CACHE_KEYS } from "../interfaces/Enums.js";

function coerceTaskDateValue(
	globalSettings: globalSettingsData,
	propertyKey: string,
	value: unknown,
): number | undefined {
	const property = globalSettings.taskProperties.find(
		(candidate) => candidate.key === propertyKey,
	);
	if (!property) return undefined;
	const convertedValue = coerceCustomTaskPropertyValue(
		value,
		property.type,
		property.type === PropertyTypeConfig.date
			? globalSettings.dateFormat
			: globalSettings.dateTimeFormat,
		globalSettings.dateFormat,
	);
	return typeof convertedValue === "number" ? convertedValue : undefined;
}


/**
 * Handle edit task event when user click on the edit task button. Depends on the configurations, it will either open the edit task modal, edit task view, directly open the inline-task in note and highlight the task or also open the edit task modal of tasks plugin.
 * @param plugin - Taskboard plugin instance
 * @param task - Task note to edit
 * @param settingOption - Edit button mode setting value
 */
export const handleEditTask = (
	plugin: TaskBoard,
	task: taskItem,
	settingOption: EditButtonMode,
) => {
	const taskNoteIdentifierTag = plugin.settings.data.taskNoteIdentifierTag;
	const isThisATaskNote = isTaskNotePresentInTags(
		taskNoteIdentifierTag,
		task[DEFAULT_TASK_CACHE_KEYS.Tags] ?? [],
	);
	switch (settingOption) {
		case EditButtonMode.Modal:
			if (isThisATaskNote) {
				openEditTaskNoteModal(plugin, task);
			} else {
				openEditTaskModal(plugin, task);
			}
			break;
		case EditButtonMode.ViewInSplitTab:
			void openEditTaskView(
				plugin,
				isThisATaskNote,
				false,
				true,
				task,
				task[DEFAULT_TASK_CACHE_KEYS.FilePath],
				"split",
			);
			break;
		case EditButtonMode.ViewInWindow:
			void openEditTaskView(
				plugin,
				isThisATaskNote,
				false,
				true,
				task,
				task[DEFAULT_TASK_CACHE_KEYS.FilePath],
				"window",
			);
			break;
		case EditButtonMode.TasksPluginModal:
			if (isThisATaskNote) {
				openEditTaskNoteModal(plugin, task);
			} else {
				void openTasksPluginEditModal(plugin, task);
			}
			break;
		case EditButtonMode.NoteInTab: {
			void openFileAndHighlightTask(plugin, task, settingOption);
			break;
		}
		case EditButtonMode.NoteInSplit: {
			void openFileAndHighlightTask(plugin, task, settingOption);
			break;
		}
		case EditButtonMode.NoteInWindow: {
			void openFileAndHighlightTask(plugin, task, settingOption);
			break;
		}
		default:
			bugReporterManagerInsatance.showNotice(
				85,
				"This should never happen, looks like you have not set the setting for Edit button mode or double click action correctly. Or the setting has been corrupted. Please try to change the setting first. If issue still persists, report it to the developer.",
				"NA",
				"TaskItemEventHandlers.ts/handleEditTask",
			);
			// markdownButtonHoverPreviewEvent(app, event, task.filePath);
			break;
	}
};

/**
 * Opens a file and highlights the task in the given leaf/tab.
 * If the file path is invalid, it will not open the file and will log an error message.
 * If the leaf initialization fails, it will log an error message.
 * If the file exists and the leaf is valid, it will open the file and highlight the task content.
 * @param plugin - The Taskboard plugin instance
 * @param task - The task item to open
 * @param mode - The edit button mode setting value
 */
export const openFileAndHighlightTask = async (
	plugin: TaskBoard,
	task: taskItem,
	mode: EditButtonMode,
) => {
	const file = plugin.app.vault.getAbstractFileByPath(task[DEFAULT_TASK_CACHE_KEYS.FilePath]);
	let leaf: WorkspaceLeaf | null = null;

	switch (mode) {
		case EditButtonMode.NoteInTab: {
			leaf = plugin.app.workspace.getLeaf("tab");
			break;
		}
		case EditButtonMode.NoteInSplit: {
			leaf = plugin.app.workspace.getLeaf("split");
			break;
		}
		case EditButtonMode.NoteInWindow: {
			leaf = plugin.app.workspace.getLeaf("window");

			break;
		}
		case EditButtonMode.Modal:
		default:
			bugReporterManagerInsatance.showNotice(
				86,
				"This is a low priority error and it should never happen. Looks like you have not set the setting for Edit button mode or double click action correctly. Or the setting has been corrupted. Please try to change the setting first. If issue still persists, report it to the developer.",
				"NA",
				"TaskItemEventHandlers.ts/handleEditTask",
			);
			// markdownButtonHoverPreviewEvent(app, event, task.filePath);
			break;
	}

	if (file && file instanceof TFile && leaf) {
		await leaf.openFile(file, {
			eState: { line: task[DEFAULT_TASK_CACHE_KEYS.TaskLocation].startLine - 1 },
		});
	} else {
		bugReporterManagerInsatance.showNotice(
			87,
			"Either file not found or Leaf initialization failed. Please check below details for more information. First try to find if the file exists as per the below path. If the issue is critical, report it to developer.",
			`Trying to open the following file: ${task[DEFAULT_TASK_CACHE_KEYS.FilePath]}.\nLeaf type: ${
				leaf ? leaf.constructor.name : "undefined"
			}`,
			"UserTaskEvents.ts/openFileAndHighlightTask",
		);
	}

	// if (newWindow) {
	// 	// plugin.app.workspace.openLinkText('', newFilePath, 'window')
	// 	const leaf = plugin.app.workspace.getLeaf("window");
	// } else {
	// await plugin.app.workspace.openLinkText('', newFilePath, false);
	// const activeEditor = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
	// console.log("Note View:", activeEditor);
	// activeEditor?.scrollIntoView({
	// 	from: { line: 5, ch: 0 },
	// 	to: { line: 5, ch: 5 },
	// }, true);
	// const leaf = plugin.app.workspace.getLeaf(Keymap.isModEvent(evt));
	// const file = plugin.app.vault.getAbstractFileByPath(newFilePath);
	// if (file && file instanceof TFile) {
	// 	await leaf.openFile(file, {
	// 		eState: { line: task.taskLocation.startLine - 1 },
	// 	});
	// } else {
	// 	bugReporterManagerInsatance.showNotice(
	// 		88,
	// 		"File not found",
	// 		`The file at path ${newFilePath} could not be found.`,
	// 		"UserTaskEvents.ts/openFileAndHighlightTask"
	// 	);
	// }
	// }
};

/**
 * Update the status of a task item.
 * @param plugin - Taskboard plugin instance
 * @param taskOld - Task item with old properties, directly fetched from the cache.
 * @param taskUpdated - Task which might have been updated before sending to this function. Or it can be same as taskOld if no changes has been made.
 * @param newStatus - New status symbol of the task item
 * @returns void
 * @description This function updates the status of a task item and triggers an event to update the real-time data.
 * If the task item is a note, it will update the frontmatter of the file first and then trigger the event to update the view.
 * If the task item is an inline-task, it will directly update the file and then trigger the event to update the view.
 */
export const updateTaskItemStatus = async (
	plugin: TaskBoard,
	taskOld: taskItem,
	taskUpdated: taskItem,
	newStatus: string,
) => {
	let newTask = { ...taskUpdated };
	newTask[DEFAULT_TASK_CACHE_KEYS.Status] = newStatus;

	const statusConfig = plugin.settings.data.customStatuses.find(
		(status) => status.symbol === newStatus,
	);
	const statusType = statusConfig ? statusConfig.type : statusTypeNames.TODO;

	if (statusType === statusTypeNames.DONE) {
		const allowed = await verifySubtasksAndChildtasksAreComplete(
			plugin,
			taskUpdated,
		);

		if (!allowed) {
			new Notice(
				t("verifySubtasksAndChildtasksAreComplete-false-message"),
			);
			return;
		}
	}

	let eventData: UpdateTaskEventData = {
		taskID: taskOld[DEFAULT_TASK_CACHE_KEYS.ID],
		state: true,
	};
	eventEmitter.emit("UPDATE_TASK", eventData);

	const isThisTaskNote = isTaskNotePresentInTags(
		plugin.settings.data.taskNoteIdentifierTag,
		taskOld[DEFAULT_TASK_CACHE_KEYS.Tags] ?? [],
	);
	if (isThisTaskNote) {
		updateFrontmatterInMarkdownFile(plugin, newTask)
			.then(() => {
				window.setTimeout(() => {
					// TODO : Is 1 sec really required ?
					// This is required to rescan the updated file and refresh the board.
					plugin.realTimeScanner
						.processAllUpdatedFiles(taskOld[DEFAULT_TASK_CACHE_KEYS.FilePath], taskOld[DEFAULT_TASK_CACHE_KEYS.ID])
						.catch((error) => {
							bugReporterManagerInsatance.addToLogs(
								217,
								String(error),
								"UserTaskEvents.ts/udateTaskItemStatus",
							);
						});
				}, 1000);
			})
			.catch((error) => {});
	} else {
		newTask[DEFAULT_TASK_CACHE_KEYS.Title] = sanitizeStatus(
			plugin.settings.data,
			newTask[DEFAULT_TASK_CACHE_KEYS.Title],
			newStatus,
			statusType,
		);
		void updateTaskInFile(plugin, newTask, taskOld).then((newId) => {
			plugin.realTimeScanner
				.processAllUpdatedFiles(taskOld[DEFAULT_TASK_CACHE_KEYS.FilePath], taskOld[DEFAULT_TASK_CACHE_KEYS.ID])
				.catch((error) => {
					bugReporterManagerInsatance.addToLogs(
						217,
						String(error),
						"UserTaskEvents.ts/udateTaskItemStatus",
					);
				});
		});
	}
};

/**
 * Update the priority of a task item.
 * @param plugin - Taskboard plugin instance
 * @param taskOld - Task item with old properties, directly fetched from the cache.
 * @param taskUpdated - Task which might have been updated before sending to this function. Or it can be same as taskOld if no changes has been made.
 * @param newPriority - New priority value of the task item
 * @returns void
 * @description This function updates the priority of a task item and triggers an event to update the real-time data.
 * If the task item is a note, it will update the frontmatter of the file first and then trigger the event to update the view.
 * If the task item is an inline-task, it will directly update the file and then trigger the event to update the view.
 */
export const updateTaskItemPriority = (
	plugin: TaskBoard,
	taskOld: taskItem,
	taskUpdated: taskItem,
	newPriority: number,
) => {
	let newTask = { ...taskUpdated };
	newTask[DEFAULT_TASK_CACHE_KEYS.Priority] = newPriority;

	let eventData = {
		taskID: taskOld[DEFAULT_TASK_CACHE_KEYS.ID],
		state: true,
	} as UpdateTaskEventData;
	eventEmitter.emit("UPDATE_TASK", eventData);

	const isThisTaskNote = isTaskNotePresentInTags(
		plugin.settings.data.taskNoteIdentifierTag,
		taskOld[DEFAULT_TASK_CACHE_KEYS.Tags] ?? [],
	);

	if (isThisTaskNote) {
		void updateFrontmatterInMarkdownFile(plugin, newTask).then(() => {
			window.setTimeout(() => {
				plugin.realTimeScanner
					.processAllUpdatedFiles(taskOld[DEFAULT_TASK_CACHE_KEYS.FilePath], taskOld[DEFAULT_TASK_CACHE_KEYS.ID])
					.catch((error) => {
						bugReporterManagerInsatance.addToLogs(
							217,
							String(error),
							"UserTaskEvents.ts/updateTaskItemTags",
						);
					});
			}, 1000);
		});
	} else {
		newTask[DEFAULT_TASK_CACHE_KEYS.Title] = sanitizePriority(
			plugin.settings.data,
			newTask[DEFAULT_TASK_CACHE_KEYS.Title],
			newPriority,
		);
		void updateTaskInFile(plugin, newTask, taskOld).then(() => {
			plugin.realTimeScanner
				.processAllUpdatedFiles(taskOld[DEFAULT_TASK_CACHE_KEYS.FilePath], taskOld[DEFAULT_TASK_CACHE_KEYS.ID])
				.catch((error) => {
					bugReporterManagerInsatance.addToLogs(
						217,
						String(error),
						"UserTaskEvents.ts/updateTaskItemTags",
					);
				});
		});
	}
};

/**
 * Update the date of a task item.
 * @param plugin - Taskboard plugin instance
 * @param taskOld - Task item with old properties, directly fetched from the cache.
 * @param taskUpdated - Task which might have been updated before sending to this function. Or it can be same as taskOld if no changes has been made.
 * @param dateType - Type of date to update (startDate, scheduledDate, due)
 * @param newDate - New date value of the task item
 * @returns void
 * @description This function updates the date of a task item and triggers an event to update the real-time data.
 * If the task item is a note, it will update the frontmatter of the file first and then trigger the event to update the view.
 * If the task item is an inline-task, it will directly update the file and then trigger the event to update the view.
 */
export const updateTaskItemDate = (
	plugin: TaskBoard,
	taskOld: taskItem,
	taskUpdated: taskItem,
	dateType: UniversalDateOptions,
	newDate: string,
): void => {
	let newTask = { ...taskUpdated };
	switch (dateType) {
		case UniversalDateOptions.startDate:
			newTask[DEFAULT_TASK_CACHE_KEYS.StartDate] = coerceTaskDateValue(
				plugin.settings.data,
				DEFAULT_TASK_CACHE_KEYS.StartDate,
				newDate,
			);
			break;
		case UniversalDateOptions.scheduledDate:
			newTask[DEFAULT_TASK_CACHE_KEYS.ScheduledDate] = coerceTaskDateValue(
				plugin.settings.data,
				DEFAULT_TASK_CACHE_KEYS.ScheduledDate,
				newDate,
			);
			break;
		case UniversalDateOptions.dueDate:
			newTask[DEFAULT_TASK_CACHE_KEYS.DueDate] = coerceTaskDateValue(
				plugin.settings.data,
				DEFAULT_TASK_CACHE_KEYS.DueDate,
				newDate,
			);
			break;
		default:
			bugReporterManagerInsatance.addToLogs(
				166,
				"error while updating the date value. Date type unknown.",
				`dateType = ${String(dateType)}`,
			);
	}

	eventEmitter.emit("UPDATE_TASK", { taskID: taskOld[DEFAULT_TASK_CACHE_KEYS.ID], state: true });

	const isThisTaskNote = isTaskNotePresentInTags(
		plugin.settings.data.taskNoteIdentifierTag,
		taskOld[DEFAULT_TASK_CACHE_KEYS.Tags] ?? [],
	);

	if (isThisTaskNote) {
		void updateFrontmatterInMarkdownFile(plugin, newTask).then(() => {
			window.setTimeout(() => {
				plugin.realTimeScanner
					.processAllUpdatedFiles(taskOld[DEFAULT_TASK_CACHE_KEYS.FilePath], taskOld[DEFAULT_TASK_CACHE_KEYS.ID])
					.catch((error) => {
						bugReporterManagerInsatance.addToLogs(
							217,
							String(error),
							"UserTaskEvents.ts/updateTaskItemTags",
						);
					});
			}, 1000);
		});
	} else {
		switch (dateType) {
			case UniversalDateOptions.startDate:
				newTask[DEFAULT_TASK_CACHE_KEYS.Title] = sanitizeStartDate(
					plugin.settings.data,
					newTask[DEFAULT_TASK_CACHE_KEYS.Title],
					newDate,
				);
				break;
			case UniversalDateOptions.scheduledDate:
				newTask[DEFAULT_TASK_CACHE_KEYS.Title] = sanitizeScheduledDate(
					plugin.settings.data,
					newTask[DEFAULT_TASK_CACHE_KEYS.Title],
					newDate,
				);
				break;
			case UniversalDateOptions.dueDate:
				newTask[DEFAULT_TASK_CACHE_KEYS.Title] = sanitizeDueDate(
					plugin.settings.data,
					newTask[DEFAULT_TASK_CACHE_KEYS.Title],
					newDate,
				);
				break;
			default:
				bugReporterManagerInsatance.addToLogs(
					167,
					"error while updating the date value. Date type unknown.",
					`dateType = ${String(dateType)}`,
				);
		}

		void updateTaskInFile(plugin, newTask, taskOld).then(() => {
			plugin.realTimeScanner
				.processAllUpdatedFiles(taskOld[DEFAULT_TASK_CACHE_KEYS.FilePath], taskOld[DEFAULT_TASK_CACHE_KEYS.ID])
				.catch((error) => {
					bugReporterManagerInsatance.addToLogs(
						217,
						String(error),
						"UserTaskEvents.ts/updateTaskItemTags",
					);
				});
		});
	}
};

/**
 * Update the reminder of a task item.
 * @param plugin - Taskboard plugin instance
 * @param taskOld - Task item with old properties, directly fetched from the cache.
 * @param taskUpdated - Task which might have been updated before sending to this function. Or it can be same as taskOld if no changes has been made.
 * @param newReminder - New reminder value of the task item
 * @returns void
 * @description This function updates the reminder of a task item and triggers an event to update the real-time data.
 * If the task item is a note, it will update the frontmatter of the file first and then trigger the event to update the view.
 * If the task item is an inline-task, it will directly update the file and then trigger the event to update the view.
 */
export const updateTaskItemReminder = (
	plugin: TaskBoard,
	taskOld: taskItem,
	taskUpdated: taskItem,
	newReminder: string,
) => {
	const newTask = { ...taskUpdated };
	newTask[DEFAULT_TASK_CACHE_KEYS.Reminder] = coerceTaskDateValue(
		plugin.settings.data,
		DEFAULT_TASK_CACHE_KEYS.Reminder,
		newReminder,
	);

	eventEmitter.emit("UPDATE_TASK", { taskID: taskOld[DEFAULT_TASK_CACHE_KEYS.ID], state: true });

	const isThisTaskNote = isTaskNotePresentInTags(
		plugin.settings.data.taskNoteIdentifierTag,
		taskOld[DEFAULT_TASK_CACHE_KEYS.Tags] ?? [],
	);

	if (isThisTaskNote) {
		void updateFrontmatterInMarkdownFile(plugin, newTask).then(() => {
			window.setTimeout(() => {
				plugin.realTimeScanner
					.processAllUpdatedFiles(taskOld[DEFAULT_TASK_CACHE_KEYS.FilePath], taskOld[DEFAULT_TASK_CACHE_KEYS.ID])
					.catch((error) => {
						bugReporterManagerInsatance.addToLogs(
							217,
							String(error),
							"UserTaskEvents.ts/updateTaskItemTags",
						);
					});
			}, 1000);
		});
	} else {
		newTask[DEFAULT_TASK_CACHE_KEYS.Title] = sanitizeReminder(
			plugin.settings.data,
			taskOld[DEFAULT_TASK_CACHE_KEYS.Title],
			newReminder,
		);
		void updateTaskInFile(plugin, newTask, taskOld).then(() => {
			plugin.realTimeScanner
				.processAllUpdatedFiles(taskOld[DEFAULT_TASK_CACHE_KEYS.FilePath], taskOld[DEFAULT_TASK_CACHE_KEYS.ID])
				.catch((error) => {
					bugReporterManagerInsatance.addToLogs(
						217,
						String(error),
						"UserTaskEvents.ts/updateTaskItemTags",
					);
				});
		});
	}
};

/** * Update the tags of a task item.
 * @param plugin - Taskboard plugin instance
 * @param taskOld - Task item with old properties, directly fetched from the cache.
 * @param taskUpdated - Task which might have been updated before sending to this function. Or it can be same as taskOld if no changes has been made.
 * @param newTags - New tags array of the task item
 * @returns void
 * @description This function updates the tags of a task item and triggers an event to update the real-time data.
 * If the task item is a note, it will update the frontmatter of the file first and then trigger the event to update the view.
 * If the task item is an inline-task, it will directly update the file and then trigger the event to update the view.
 */
export const updateTaskItemTags = (
	plugin: TaskBoard,
	taskOld: taskItem,
	taskUpdated: taskItem,
	newTags: string[],
) => {
	let newTask = { ...taskUpdated };
	newTask[DEFAULT_TASK_CACHE_KEYS.Tags] = newTags;

	eventEmitter.emit("UPDATE_TASK", { taskID: taskOld[DEFAULT_TASK_CACHE_KEYS.ID], state: true });

	const isThisTaskNote = isTaskNotePresentInTags(
		plugin.settings.data.taskNoteIdentifierTag,
		taskOld[DEFAULT_TASK_CACHE_KEYS.Tags] ?? [],
	);

	if (isThisTaskNote) {
		void updateFrontmatterInMarkdownFile(plugin, newTask).then(() => {
			window.setTimeout(() => {
				plugin.realTimeScanner
					.processAllUpdatedFiles(taskOld[DEFAULT_TASK_CACHE_KEYS.FilePath], taskOld[DEFAULT_TASK_CACHE_KEYS.ID])
					.catch((error) => {
						bugReporterManagerInsatance.addToLogs(
							217,
							String(error),
							"UserTaskEvents.ts/updateTaskItemTags",
						);
					});
			}, 1000);
		});
	} else {
		newTask[DEFAULT_TASK_CACHE_KEYS.Title] = sanitizeTags(newTask[DEFAULT_TASK_CACHE_KEYS.Title], newTags);
		void updateTaskInFile(plugin, newTask, taskOld).then(() => {
			plugin.realTimeScanner
				.processAllUpdatedFiles(taskOld[DEFAULT_TASK_CACHE_KEYS.FilePath], taskOld[DEFAULT_TASK_CACHE_KEYS.ID])
				.catch((error) => {
					bugReporterManagerInsatance.addToLogs(
						217,
						String(error),
						"UserTaskEvents.ts/updateTaskItemTags",
					);
				});
		});
	}
};

/**
 * Updates the old property with the new property of a task item.
 * Also, for inline-task, sanitizes the title to update the value in title.
 * And returns the updated task item.
 *
 * @param {taskItem} task - The task item to update.
 * @param {globalSettingsData} globalSettings - The global settings data of the Taskboard plugin.
 * @param {string} property - The property of the task item to update.
 * @param {string | number | string[]} newValue - The new value of the property to update.
 * @returns {taskItem} The updated task item.
 */
export const updateTaskItemProperty = async (
	task: taskItem,
	globalSettings: globalSettingsData,
	property: string,
	newValue: string | number | string[],
): Promise<taskItem> => {
	const updatedTask: taskItem = { ...task };
	const isThisTaskNote = isTaskNotePresentInTags(
		globalSettings.taskNoteIdentifierTag,
		task[DEFAULT_TASK_CACHE_KEYS.Tags] ?? [],
	);

	switch (property) {
		case "tags":
			updatedTask[DEFAULT_TASK_CACHE_KEYS.Tags] = newValue as string[];
			if (!isThisTaskNote) {
				updatedTask[DEFAULT_TASK_CACHE_KEYS.Title] = sanitizeTags(
					task[DEFAULT_TASK_CACHE_KEYS.Title],
					newValue as string[],
				);
			}
			break;
		case "status":
			updatedTask[DEFAULT_TASK_CACHE_KEYS.Status] = newValue as string;
			break;
		case "priority":
			updatedTask[DEFAULT_TASK_CACHE_KEYS.Priority] = newValue as number;
			if (!isThisTaskNote) {
				updatedTask[DEFAULT_TASK_CACHE_KEYS.Title] = sanitizePriority(
					globalSettings,
					task[DEFAULT_TASK_CACHE_KEYS.Title],
					newValue as number,
				);
			}
			break;
		case "reminder":
			updatedTask[DEFAULT_TASK_CACHE_KEYS.Reminder] = coerceTaskDateValue(
				globalSettings,
				DEFAULT_TASK_CACHE_KEYS.Reminder,
				newValue,
			);
			break;
		case "startDate":
			updatedTask[DEFAULT_TASK_CACHE_KEYS.StartDate] = coerceTaskDateValue(
				globalSettings,
				DEFAULT_TASK_CACHE_KEYS.StartDate,
				newValue,
			);
			break;
		case "scheduledDate":
			updatedTask[DEFAULT_TASK_CACHE_KEYS.ScheduledDate] = coerceTaskDateValue(
				globalSettings,
				DEFAULT_TASK_CACHE_KEYS.ScheduledDate,
				newValue,
			);
			break;
		case "due":
			updatedTask[DEFAULT_TASK_CACHE_KEYS.DueDate] = coerceTaskDateValue(
				globalSettings,
				DEFAULT_TASK_CACHE_KEYS.DueDate,
				newValue,
			);
			break;
		case "completion":
			updatedTask[DEFAULT_TASK_CACHE_KEYS.CompletionDate] = coerceTaskDateValue(
				globalSettings,
				DEFAULT_TASK_CACHE_KEYS.CompletionDate,
				newValue,
			);
			break;
		case "cancelledDate":
			updatedTask[DEFAULT_TASK_CACHE_KEYS.CancelledDate] = coerceTaskDateValue(
				globalSettings,
				DEFAULT_TASK_CACHE_KEYS.CancelledDate,
				newValue,
			);
			break;
		case "time":
			updatedTask[DEFAULT_TASK_CACHE_KEYS.Time] = newValue as string;
			break;
		case "dependsOn":
			updatedTask[DEFAULT_TASK_CACHE_KEYS.Dependencies] = newValue as string[];
			break;
		case "filePath":
			updatedTask[DEFAULT_TASK_CACHE_KEYS.FilePath] = newValue as string;
			break;
		case "title":
			updatedTask[DEFAULT_TASK_CACHE_KEYS.Title] = newValue as string;
			break;
	}

	return updatedTask;
};
