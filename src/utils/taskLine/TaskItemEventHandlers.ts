import { checkboxStateSwitcher, isTaskCompleted } from "../CheckBoxUtils";
import {
	archiveTask,
	deleteTaskFromFile,
	useTasksPluginToUpdateInFile,
	updateTaskInFile,
} from "./TaskLineUtils";
import TaskBoard from "main";
import { moment as _moment, TFile, WorkspaceLeaf } from "obsidian";
import { t } from "../lang/helper";
import { taskItem } from "src/interfaces/TaskItem";
import { isTaskRecurring } from "./TaskContentFormatter";
import {
	bugReporter,
	openEditTaskModal,
	openEditTaskNoteModal,
	openEditTaskView,
} from "src/services/OpenModals";
import { TasksPluginApi } from "src/services/tasks-plugin/api";
import {
	archiveTaskNote,
	deleteTaskNote,
	isTaskNotePresentInTags,
} from "../taskNote/TaskNoteUtils";
import { openTasksPluginEditModal } from "src/services/tasks-plugin/helpers";
import { EditButtonMode } from "src/interfaces/Enums";
import { DeleteConfirmationModal } from "src/modals/DeleteConfirmationModal";
import { eventEmitter } from "src/services/EventEmitter";

/**
 * Handle the checkbox change event for the task-line and update the task in the file.
 * @param plugin - Taskboard plugin instance
 * @param task - TaskItem to update
 */
export const handleCheckboxChange = (plugin: TaskBoard, task: taskItem) => {
	// const task = tasks.filter(t => t.id !== task.id);
	// setTasks(updatedTasks); // This two lines were not required at all since, anyways the `writeDataToVaultFile` is running and sending and refresh emit signal.
	const tasksPlugin = new TasksPluginApi(plugin);

	if (!tasksPlugin.isTasksPluginEnabled()) {
		// Check if the task is completed
		const newStatus = checkboxStateSwitcher(plugin, task.status);
		if (isTaskCompleted(`- [${task.status}]`, false, plugin.settings)) {
			const taskWithUpdatedStatus = {
				...task,
				completion: "",
				status: newStatus,
			};
			updateTaskInFile(plugin, taskWithUpdatedStatus, task).then(
				(newId) => {
					plugin.realTimeScanning.processAllUpdatedFiles(
						task.filePath,
						task.legacyId
					);

					// DEPRECATED : See notes from //src/utils/TaskItemCacheOperations.ts file
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

						// DEPRECATED : See notes from //src/utils/TaskItemCacheOperations.ts file
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
				plugin.realTimeScanning.processAllUpdatedFiles(
					task.filePath,
					task.legacyId
				);

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
	// NOTE : The eventEmitter.emit("REFRESH_COLUMN") is being sent from the moveFromPendingToCompleted functions, because if i add that here, then all the things are getting executed parallely instead of sequential.
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
	updatedTask: taskItem
) => {
	// DEPRECATED : See notes from //src/utils/TaskItemCacheOperations.ts file
	// updateTaskInJson(plugin, updatedTask);

	updateTaskInFile(plugin, updatedTask, oldTask).then((newId) => {
		plugin.realTimeScanning.processAllUpdatedFiles(
			updatedTask.filePath,
			oldTask.id
		);
	});
};

/**
 * Handle task deletion event.
 * @param plugin - Taskboard plugin instance
 * @param task - Task note to delete
 * @param isTaskNote - Boolean indicating if the task is deleted
 */
export const handleDeleteTask = (
	plugin: TaskBoard,
	task: taskItem,
	isTaskNote: boolean
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
					plugin.realTimeScanning.processAllUpdatedFiles(
						task.filePath
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

/**
 * Handle edit task modal open
 * @param plugin - Taskboard plugin instance
 * @param task - Task note to edit
 * @param settingOption - Edit button mode setting value
 */
export const handleEditTask = (
	plugin: TaskBoard,
	task: taskItem,
	settingOption: string
) => {
	const taskNoteIdentifierTag =
		plugin.settings.data.globalSettings.taskNoteIdentifierTag;
	switch (settingOption) {
		case EditButtonMode.Modal:
			if (isTaskNotePresentInTags(taskNoteIdentifierTag, task.tags)) {
				openEditTaskNoteModal(plugin, task);
			} else {
				openEditTaskModal(plugin, task);
			}
			break;
		case EditButtonMode.View:
			const isTaskNote = isTaskNotePresentInTags(
				taskNoteIdentifierTag,
				task.tags
			);
			openEditTaskView(
				plugin,
				isTaskNote,
				false,
				true,
				task,
				task.filePath,
				"window"
			);
			break;
		case EditButtonMode.TasksPluginModal:
			if (isTaskNotePresentInTags(taskNoteIdentifierTag, task.tags)) {
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
			bugReporter(
				plugin,
				"This should never happen, looks like you have not set the setting for Edit button mode or double click action correctly. Or the setting has been corrupted. Please try to change the setting first. If issue still persists, report it to the developer.",
				"NA",
				"TaskItemEventHandlers.ts/handleEditTask"
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
	mode: string
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
			bugReporter(
				plugin,
				"This is a low priority error and it should never happen. Looks like you have not set the setting for Edit button mode or double click action correctly. Or the setting has been corrupted. Please try to change the setting first. If issue still persists, report it to the developer.",
				"NA",
				"TaskItemEventHandlers.ts/handleEditTask"
			);
			// markdownButtonHoverPreviewEvent(app, event, task.filePath);
			break;
	}

	if (file && file instanceof TFile && leaf) {
		await leaf.openFile(file, {
			eState: { line: task.taskLocation.startLine - 1 },
		});
	} else {
		bugReporter(
			plugin,
			"Either file not found or Leaf initialization failed. Please check below details for more information. First try to find if the file exists as per the below path. If the issue is critical, report it to developer.",
			`Trying to open the following file: ${task.filePath}.\nLeaf type: ${
				leaf ? leaf.constructor.name : "undefined"
			}`,
			"AddOrEditTaskModal.tsx/EditTaskContent/onOpenFilBtnClicked"
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
	// 	bugReporter(
	// 		plugin,
	// 		"File not found",
	// 		`The file at path ${newFilePath} could not be found.`,
	// 		"AddOrEditTaskModal.tsx/EditTaskContent/onOpenFilBtnClicked"
	// 	);
	// }
	// }
};
