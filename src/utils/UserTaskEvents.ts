import TaskBoard from "main";
import { WorkspaceLeaf, TFile } from "obsidian";
import {
	EditButtonMode,
	statusTypeNames,
	UniversalDateOptions,
} from "src/interfaces/Enums";
import { taskItem, UpdateTaskEventData } from "src/interfaces/TaskItem";
import {
	openEditTaskNoteModal,
	openEditTaskModal,
	openEditTaskView,
	bugReporter,
} from "src/services/OpenModals";
import { openTasksPluginEditModal } from "src/services/tasks-plugin/helpers";
import {
	isTaskNotePresentInTags,
	updateFrontmatterInMarkdownFile,
} from "./taskNote/TaskNoteUtils";
import { updateTaskInFile } from "./taskLine/TaskLineUtils";
import { eventEmitter } from "src/services/EventEmitter";
import {
	sanitizeDueDate,
	sanitizePriority,
	sanitizeScheduledDate,
	sanitizeStartDate,
	sanitizeStatus,
	sanitizeTags,
} from "./taskLine/TaskContentFormatter";
import {
	globalSettingsData,
	PluginDataJson,
} from "src/interfaces/GlobalSettings";
import { bugReporterManagerInsatance } from "src/managers/BugReporter";

/**
 * Handle edit task event when user click on the edit task button. Depends on the configurations, it will either open the edit task modal, edit task view, directly open the inline-task in note and highlight the task or also open the edit task modal of tasks plugin.
 * @param plugin - Taskboard plugin instance
 * @param task - Task note to edit
 * @param settingOption - Edit button mode setting value
 */
export const handleEditTask = (
	plugin: TaskBoard,
	task: taskItem,
	settingOption: string,
) => {
	const taskNoteIdentifierTag =
		plugin.settings.data.globalSettings.taskNoteIdentifierTag;
	const isThisATaskNote = isTaskNotePresentInTags(
		taskNoteIdentifierTag,
		task.tags,
	);
	switch (settingOption) {
		case EditButtonMode.Modal:
			if (isThisATaskNote) {
				openEditTaskNoteModal(plugin, task);
			} else {
				openEditTaskModal(plugin, task);
			}
			break;
		case EditButtonMode.View:
			openEditTaskView(
				plugin,
				isThisATaskNote,
				false,
				true,
				task,
				task.filePath,
				"window",
			);
			break;
		case EditButtonMode.TasksPluginModal:
			if (isThisATaskNote) {
				openEditTaskNoteModal(plugin, task);
			} else {
				openTasksPluginEditModal(plugin, task);
			}
			break;
		case EditButtonMode.NoteInTab: {
			openFileAndHighlightTask(plugin, task, settingOption);
			break;
		}
		case EditButtonMode.NoteInSplit: {
			openFileAndHighlightTask(plugin, task, settingOption);
			break;
		}
		case EditButtonMode.NoteInWindow: {
			openFileAndHighlightTask(plugin, task, settingOption);
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
	mode: string,
) => {
	const file = plugin.app.vault.getAbstractFileByPath(task.filePath);
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
			eState: { line: task.taskLocation.startLine - 1 },
		});
	} else {
		bugReporterManagerInsatance.showNotice(
			87,
			"Either file not found or Leaf initialization failed. Please check below details for more information. First try to find if the file exists as per the below path. If the issue is critical, report it to developer.",
			`Trying to open the following file: ${task.filePath}.\nLeaf type: ${
				leaf ? leaf.constructor.name : "undefined"
			}`,
			"AddOrEditTaskModal.tsx/EditTaskContent/onOpenFilBtnClicked",
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
	// 		"AddOrEditTaskModal.tsx/EditTaskContent/onOpenFilBtnClicked"
	// 	);
	// }
	// }
};

/**
 * Update the status of a task item.
 * @param plugin - Taskboard plugin instance
 * @param oldTask - Task item with old properties
 * @param newStatus - New status symbol of the task item
 * @returns void
 * @description This function updates the status of a task item and triggers an event to update the real-time data.
 * If the task item is a note, it will update the frontmatter of the file first and then trigger the event to update the view.
 * If the task item is an inline-task, it will directly update the file and then trigger the event to update the view.
 */
export const updateTaskItemStatus = (
	plugin: TaskBoard,
	oldTask: taskItem,
	newStatus: string,
) => {
	let newTask = { ...oldTask };
	newTask.status = newStatus;

	let eventData: UpdateTaskEventData = {
		taskID: oldTask.id,
		state: true,
	};
	eventEmitter.emit("UPDATE_TASK", eventData);

	const isThisTaskNote = isTaskNotePresentInTags(
		plugin.settings.data.globalSettings.taskNoteIdentifierTag,
		oldTask.tags,
	);
	if (isThisTaskNote) {
		updateFrontmatterInMarkdownFile(plugin, newTask).then(() => {
			sleep(1000).then(() => {
				// TODO : Is 1 sec really required ?
				// This is required to rescan the updated file and refresh the board.
				plugin.realTimeScanner.processAllUpdatedFiles(
					oldTask.filePath,
					oldTask.id,
				);
			});
		});
	} else {
		const newStatusType =
			plugin.settings.data.globalSettings.customStatuses.find(
				(status) => status.symbol === newStatus,
			)?.type ?? statusTypeNames.TODO;
		newTask.title = sanitizeStatus(
			plugin.settings.data.globalSettings,
			newTask.title,
			newStatus,
			newStatusType,
		);
		updateTaskInFile(plugin, newTask, oldTask).then((newId) => {
			plugin.realTimeScanner.processAllUpdatedFiles(
				oldTask.filePath,
				oldTask.id,
			);
		});
	}
};

/**
 * Update the priority of a task item.
 * @param plugin - Taskboard plugin instance
 * @param oldTask - Task item with old properties
 * @param newPriority - New priority value of the task item
 * @returns void
 * @description This function updates the priority of a task item and triggers an event to update the real-time data.
 * If the task item is a note, it will update the frontmatter of the file first and then trigger the event to update the view.
 * If the task item is an inline-task, it will directly update the file and then trigger the event to update the view.
 */
export const updateTaskItemPriority = (
	plugin: TaskBoard,
	oldTask: taskItem,
	newPriority: number,
) => {
	let newTask = { ...oldTask } as taskItem;
	newTask.priority = newPriority;

	let eventData = {
		taskID: oldTask.id,
		state: true,
	} as UpdateTaskEventData;
	eventEmitter.emit("UPDATE_TASK", eventData);

	const isThisTaskNote = isTaskNotePresentInTags(
		plugin.settings.data.globalSettings.taskNoteIdentifierTag,
		oldTask.tags,
	);

	if (isThisTaskNote) {
		updateFrontmatterInMarkdownFile(plugin, newTask).then(() => {
			sleep(1000).then(() => {
				plugin.realTimeScanner.processAllUpdatedFiles(
					oldTask.filePath,
					oldTask.id,
				);
			});
		});
	} else {
		newTask.title = sanitizePriority(
			plugin.settings.data.globalSettings,
			newTask.title,
			newPriority,
		);
		updateTaskInFile(plugin, newTask, oldTask).then(() => {
			plugin.realTimeScanner.processAllUpdatedFiles(
				oldTask.filePath,
				oldTask.id,
			);
		});
	}
};

/**
 * Update the date of a task item.
 * @param plugin - Taskboard plugin instance
 * @param oldTask - Task item with old properties
 * @param dateType - Type of date to update (startDate, scheduledDate, due)
 * @param newDate - New date value of the task item
 * @returns void
 * @description This function updates the date of a task item and triggers an event to update the real-time data.
 * If the task item is a note, it will update the frontmatter of the file first and then trigger the event to update the view.
 * If the task item is an inline-task, it will directly update the file and then trigger the event to update the view.
 */
export const updateTaskItemDate = (
	plugin: TaskBoard,
	oldTask: taskItem,
	dateType: "startDate" | "scheduledDate" | "due",
	newDate: string,
): void => {
	let newTask = { ...oldTask } as taskItem;
	switch (dateType) {
		case UniversalDateOptions.startDate:
			newTask.startDate = newDate;
			break;
		case UniversalDateOptions.scheduledDate:
			newTask.scheduledDate = newDate;
			break;
		case UniversalDateOptions.dueDate:
			newTask.due = newDate;
			break;
		default:
			bugReporterManagerInsatance.addToLogs(
				166,
				"error while updating the date value. Date type unknown.",
				`dateType = ${dateType}`,
			);
	}

	eventEmitter.emit("UPDATE_TASK", { taskID: oldTask.id, state: true });

	const isThisTaskNote = isTaskNotePresentInTags(
		plugin.settings.data.globalSettings.taskNoteIdentifierTag,
		oldTask.tags,
	);

	if (isThisTaskNote) {
		updateFrontmatterInMarkdownFile(plugin, newTask).then(() => {
			sleep(1000).then(() => {
				plugin.realTimeScanner.processAllUpdatedFiles(
					oldTask.filePath,
					oldTask.id,
				);
			});
		});
	} else {
		switch (dateType) {
			case UniversalDateOptions.startDate:
				newTask.title = sanitizeStartDate(
					plugin.settings.data.globalSettings,
					newTask.title,
					newDate,
				);
				break;
			case UniversalDateOptions.scheduledDate:
				newTask.title = sanitizeScheduledDate(
					plugin.settings.data.globalSettings,
					newTask.title,
					newDate,
				);
				break;
			case UniversalDateOptions.dueDate:
				newTask.title = sanitizeDueDate(
					plugin.settings.data.globalSettings,
					newTask.title,
					newDate,
				);
				break;
			default:
				bugReporterManagerInsatance.addToLogs(
					167,
					"error while updating the date value. Date type unknown.",
					`dateType = ${dateType}`,
				);
		}

		updateTaskInFile(plugin, newTask, oldTask).then(() => {
			plugin.realTimeScanner.processAllUpdatedFiles(
				oldTask.filePath,
				oldTask.id,
			);
		});
	}
};

/**
 * Update the reminder of a task item.
 * @param plugin - Taskboard plugin instance
 * @param oldTask - Task item with old properties
 * @param newReminder - New reminder value of the task item
 * @returns void
 * @description This function updates the reminder of a task item and triggers an event to update the real-time data.
 * If the task item is a note, it will update the frontmatter of the file first and then trigger the event to update the view.
 * If the task item is an inline-task, it will directly update the file and then trigger the event to update the view.
 */
export const updateTaskItemReminder = (
	plugin: TaskBoard,
	oldTask: taskItem,
	newReminder: string,
) => {
	const newTask = { ...oldTask } as taskItem;
	newTask.reminder = newReminder;

	eventEmitter.emit("UPDATE_TASK", { taskID: oldTask.id, state: true });

	const isThisTaskNote = isTaskNotePresentInTags(
		plugin.settings.data.globalSettings.taskNoteIdentifierTag,
		oldTask.tags,
	);

	if (isThisTaskNote) {
		updateFrontmatterInMarkdownFile(plugin, newTask).then(() => {
			sleep(1000).then(() => {
				plugin.realTimeScanner.processAllUpdatedFiles(
					oldTask.filePath,
					oldTask.id,
				);
			});
		});
	} else {
		updateTaskInFile(plugin, newTask, oldTask).then(() => {
			plugin.realTimeScanner.processAllUpdatedFiles(
				oldTask.filePath,
				oldTask.id,
			);
		});
	}
};

/** * Update the tags of a task item.
 * @param plugin - Taskboard plugin instance
 * @param oldTask - Task item with old properties
 * @param newTask - This task may have other properties updated or it may be exact same copy of oldTask.
 * @param newTags - New tags array of the task item
 * @returns void
 * @description This function updates the tags of a task item and triggers an event to update the real-time data.
 * If the task item is a note, it will update the frontmatter of the file first and then trigger the event to update the view.
 * If the task item is an inline-task, it will directly update the file and then trigger the event to update the view.
 */
export const updateTaskItemTags = (
	plugin: TaskBoard,
	oldTask: taskItem,
	newTask: taskItem,
	newTags: string[],
) => {
	// let newTask = { ...oldTask };
	newTask.tags = newTags;

	eventEmitter.emit("UPDATE_TASK", { taskID: oldTask.id, state: true });

	const isThisTaskNote = isTaskNotePresentInTags(
		plugin.settings.data.globalSettings.taskNoteIdentifierTag,
		oldTask.tags,
	);

	if (isThisTaskNote) {
		updateFrontmatterInMarkdownFile(plugin, newTask).then(() => {
			sleep(1000).then(() => {
				plugin.realTimeScanner.processAllUpdatedFiles(
					oldTask.filePath,
					oldTask.id,
				);
			});
		});
	} else {
		newTask.title = sanitizeTags(newTask.title, oldTask.tags, newTags);
		updateTaskInFile(plugin, newTask, oldTask).then(() => {
			plugin.realTimeScanner.processAllUpdatedFiles(
				oldTask.filePath,
				oldTask.id,
			);
		});
	}
};

/**
 * Updates a property of a task item and returns the updated task item.
 * @param {taskItem} task - The task item to update.
 * @param {globalSettingsData} globalSettings - The global settings data of the Taskboard plugin.
 * @param {string} property - The property of the task item to update.
 * @param {string | number | string[]} oldValue - The old value of the property to update.
 * @param {string | number | string[]} newValue - The new value of the property to update.
 * @returns {taskItem} The updated task item.
 */
export const updateTaskItemProperty = async (
	task: taskItem,
	globalSettings: globalSettingsData,
	property: string,
	oldValue: string | number | string[],
	newValue: string | number | string[],
): Promise<taskItem> => {
	const updatedTask: taskItem = { ...task };
	const isThisTaskNote = isTaskNotePresentInTags(
		globalSettings.taskNoteIdentifierTag,
		task.tags,
	);

	switch (property) {
		case "tags":
			updatedTask.tags = newValue as string[];
			if (!isThisTaskNote) {
				updatedTask.title = sanitizeTags(
					task.title,
					oldValue as string[],
					newValue as string[],
				);
			}
			break;
		case "status":
			updatedTask.status = newValue as string;
			break;
		case "priority":
			updatedTask.priority = newValue as number;
			if (!isThisTaskNote) {
				updatedTask.title = sanitizePriority(
					globalSettings,
					task.title,
					newValue as number,
				);
			}
			break;
		case "reminder":
			updatedTask.reminder = newValue as string;
			break;
		case "startDate":
			updatedTask.startDate = newValue as string;
			break;
		case "scheduledDate":
			updatedTask.scheduledDate = newValue as string;
			break;
		case "due":
			updatedTask.due = newValue as string;
			break;
		case "completion":
			updatedTask.completion = newValue as string;
			break;
		case "cancelledDate":
			updatedTask.cancelledDate = newValue as string;
			break;
		case "time":
			updatedTask.time = newValue as string;
			break;
		case "dependsOn":
			updatedTask.dependsOn = newValue as string[];
			break;
		case "filePath":
			updatedTask.filePath = newValue as string;
			break;
		case "title":
			updatedTask.title = newValue as string;
			break;
	}

	return updatedTask;
};
