// src/services/OpenModals.ts

import { App, Notice, TFile, WorkspaceLeaf } from "obsidian";
import {
	addTaskInNote,
	updateTaskInFile,
} from "src/utils/taskLine/TaskItemUtils";
import { AddOrEditTaskView } from "src/views/AddOrEditTaskView";
import { Board } from "../interfaces/BoardConfigs";
import type TaskBoard from "main";
import { eventEmitter } from "./EventEmitter";
import { CommunityPlugins } from "./CommunityPlugins";
import {
	addIdToTaskContent,
	getFormattedTaskContent,
} from "src/utils/taskLine/TaskContentFormatter";
import { t } from "src/utils/lang/helper";
import { taskItem } from "src/interfaces/TaskItem";
import { updateFrontmatterInMarkdownFile } from "src/utils/taskNote/TaskNoteUtils";
import { writeDataToVaultFile } from "src/utils/MarkdownFileOperations";
import { VIEW_TYPE_ADD_OR_EDIT_TASK } from "src/interfaces/Constants";
import { AddOrEditTaskModal } from "src/modals/AddOrEditTaskModal";
import { BoardConfigureModal } from "src/modals/BoardConfigModal";
import { BugReporterModal } from "src/modals/BugReporterModal";
import { DiffContentCompareModal } from "src/modals/DiffContentCompareModal";
import { ScanFilterModal } from "src/modals/ScanFilterModal";
import { ScanVaultModal } from "src/modals/ScanVaultModal";
import { TaskBoardActionsModal } from "src/modals/TaskBoardActionsModal";

// Function to open the BoardConfigModal
export const openBoardConfigModal = (
	plugin: TaskBoard,
	boards: Board[],
	activeBoardIndex: number,
	onSave: (updatedBoards: Board[]) => void
) => {
	new BoardConfigureModal(plugin, boards, activeBoardIndex, onSave).open();
};

// Function to open the BoardConfigModal
export const openScanVaultModal = (app: App, plugin: TaskBoard) => {
	new ScanVaultModal(app, plugin).open();
};

export const openAddNewTaskInCurrentFileModal = (
	app: App,
	plugin: TaskBoard,
	activeFile: TFile,
	cursorPosition?: { line: number; ch: number } | undefined
) => {
	const AddTaskModal = new AddOrEditTaskModal(
		plugin,
		(newTask: taskItem, quickAddPluginChoice: string) => {
			addTaskInNote(plugin, newTask, true, cursorPosition).then(
				(newId) => {
					plugin.realTimeScanning.processAllUpdatedFiles(
						newTask.filePath
					);
				}
			);

			// NOTE : The below code is not required anymore, as I am already scanning the file if its updated using above function.
			// if (
			// 	activeFile &&
			// 	scanFilterForFilesNFolders(activeFile, scanFilters) &&
			// 	scanFilterForTags(newTask.tags, scanFilters)
			// ) {
			// 	addTaskInJson(plugin, newTask);
			// }

			eventEmitter.emit("REFRESH_COLUMN");
			cursorPosition = undefined;
			return true;
		},
		false,
		true,
		false,
		undefined,
		activeFile.path
	);
	AddTaskModal.open();
	return true;
};

export const openAddNewTaskModal = (
	app: App,
	plugin: TaskBoard,
	activeFile?: TFile
) => {
	const preDefinedNoteFile = plugin.app.vault.getAbstractFileByPath(
		plugin.settings.data.globalSettings.preDefinedNote
	);
	const activeTFile = activeFile ? activeFile : preDefinedNoteFile;
	const communityPlugins = new CommunityPlugins(plugin);
	const AddTaskModal = new AddOrEditTaskModal(
		plugin,
		async (newTask: taskItem, quickAddPluginChoice: string) => {
			if (communityPlugins.isQuickAddPluginIntegrationEnabled()) {
				// Call the API of QuickAdd plugin and pass the formatted content.
				let completeTask = await getFormattedTaskContent(newTask);
				const { formattedTaskContent, newId } =
					await addIdToTaskContent(plugin, completeTask);
				completeTask = formattedTaskContent;

				(communityPlugins.quickAddPlugin as any)?.api.executeChoice(
					quickAddPluginChoice,
					{
						value: completeTask + "\n",
					}
				);
			} else {
				await addTaskInNote(plugin, newTask, false).then((newId) => {
					plugin.realTimeScanning.processAllUpdatedFiles(
						newTask.filePath
					);
				});
			}

			// NOTE : The below code is not required anymore, as I am already scanning the file if its updated using above function.
			// if (
			// 	activeTFile instanceof TFile &&
			// 	scanFilterForFilesNFolders(activeTFile, scanFilters) &&
			// 	scanFilterForTags(newTask.tags, scanFilters)
			// ) {
			// 	addTaskInJson(plugin, newTask);
			// }

			eventEmitter.emit("REFRESH_COLUMN");
		},
		false,
		false,
		false,
		undefined,
		activeTFile
			? activeTFile.path
			: plugin.settings.data.globalSettings.preDefinedNote
	);
	AddTaskModal.open();
};

export const openAddNewTaskNoteModal = (app: App, plugin: TaskBoard) => {
	if (!plugin.settings.data.globalSettings.experimentalFeatures) {
		new Notice(t("enable-experimental-features-message"), 5000);
		return;
	}

	const AddTaskModal = new AddOrEditTaskModal(
		plugin,
		async (
			newTask: taskItem,
			quickAddPluginChoice: string,
			noteContent: string | undefined
		) => {
			if (!noteContent) {
				// console.warn("This code should not run...");
			} else {
				// If noteContent is provided, it means user wants to save this task as a TaskNote.
				// Create the note content with frontmatter
				try {
					// Check if the directory exists, create if not
					const parts = newTask.filePath.split("/");
					if (parts.length > 1) {
						const dirPath = parts.slice(0, -1).join("/");
						if (!(await plugin.app.vault.adapter.exists(dirPath))) {
							await plugin.app.vault.createFolder(dirPath);
						}
					}

					// Create or update the file
					const existingFile = plugin.app.vault.getFileByPath(
						newTask.filePath
					);
					if (!existingFile) {
						await plugin.app.vault
							.create(newTask.filePath, noteContent)
							.then(() => {
								// This is required to rescan the updated file and refresh the board.
								plugin.realTimeScanning.onFileModified(
									newTask.filePath
								);
								sleep(2000).then(() => {
									// TODO : Is 2 seconds really required ?
									plugin.realTimeScanning.processAllUpdatedFiles();
								});
							});
					} else {
						new Notice(
							t("file-note-already-exists") +
								t(
									"creating a new file with the following name :"
								) +
								` Copy-${newTask.filePath}`,
							10000
						);
						await plugin.app.vault
							.create(`Copy-${newTask.filePath}`, noteContent)
							.then(() => {
								// This is required to rescan the updated file and refresh the board.
								plugin.realTimeScanning.onFileModified(
									`Copy-${newTask.filePath}`
								);
								sleep(2000).then(() => {
									plugin.realTimeScanning.processAllUpdatedFiles();
								});
							});
					}
				} catch (error) {
					console.error(
						"Error creating or updating task note:",
						error
					);
					new Notice(t("error-creating-task-note"), 5000);
					return false;
				}
			}

			eventEmitter.emit("REFRESH_COLUMN");
		},
		true,
		false,
		false,
		undefined,
		""
	);
	AddTaskModal.open();
};

export const openEditTaskModal = async (
	plugin: TaskBoard,
	existingTask: taskItem
) => {
	const EditTaskModal = new AddOrEditTaskModal(
		plugin,
		(updatedTask: taskItem) => {
			updatedTask.filePath = existingTask.filePath;
			// Update the task in the file and JSON
			updateTaskInFile(plugin, updatedTask, existingTask).then(
				(newId) => {
					plugin.realTimeScanning.processAllUpdatedFiles(
						updatedTask.filePath
					);
				}
			);

			// updateTaskInJson(plugin, updatedTask); // NOTE : This is not necessary any more as I am scanning the file after it has been updated.

			// setTasks((prevTasks) =>
			// 	prevTasks.map((task) =>
			// 		task.id === updatedTask.id ? { ...task, ...updatedTask } : task
			// 	)
			// );
			// NOTE : The eventEmitter.emit("REFRESH_COLUMN") is being sent from the updateTaskInJson function, because if i add that here, then all the things are getting executed parallely instead of sequential.
		},
		false,
		false,
		true,
		existingTask,
		existingTask.filePath
	);
	EditTaskModal.open();
};

export const openEditTaskNoteModal = (
	plugin: TaskBoard,
	existingTask: taskItem
) => {
	const EditTaskModal = new AddOrEditTaskModal(
		plugin,
		async (
			updatedTask: taskItem,
			quickAddPluginChoice: string,
			newTaskContent: string | undefined
		) => {
			try {
				if (!newTaskContent) {
					// Update frontmatter with task properties
					await updateFrontmatterInMarkdownFile(
						plugin,
						updatedTask
					).then(() => {
						// This is required to rescan the updated file and refresh the board.
						plugin.realTimeScanning.processAllUpdatedFiles(
							updatedTask.filePath
						);
					});
				} else {
					writeDataToVaultFile(
						plugin,
						updatedTask.filePath,
						newTaskContent
					).then(() => {
						sleep(2000).then(() => {
							// TODO : Is 2 sec really required ?
							// This is required to rescan the updated file and refresh the board.
							plugin.realTimeScanning.processAllUpdatedFiles(
								updatedTask.filePath
							);
						});
					});
				}
			} catch (error) {
				bugReporter(
					plugin,
					"Error updating task note",
					error as string,
					"TaskNoteEventHandlers.ts/handleTaskNoteEdit"
				);
			}
		},
		true,
		false,
		true,
		existingTask,
		existingTask.filePath
	);
	EditTaskModal.open();
};

export const bugReporter = (
	plugin: TaskBoard,
	message: string,
	bugContent: string,
	context: string
) => {
	// const leaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_TASKBOARD);
	// if (leaves.length > 0) {
	// 	const firstLeaf = leaves.at(0);
	// 	if (firstLeaf) {
	// 		const actionButton = firstLeaf.view.addAction("Report Bug", "Open Bug Reporter", "bug");
	// 		actionButton.addEventListener("click", () => {
	// 			bugReportModal.open();
	// 		});
	// 	}
	// }

	// const bugReportNotice = new Notice(
	// 	"Task board encountered an issue while completing the bug. Please click on this message and report the bug. Right-click to dismiss.",
	// 	0
	// );

	// bugReportNotice.noticeEl.oncontextmenu = () => {
	// 	// Perform an action here
	// };

	// bugReportNotice.messageEl.oncontextmenu = () => {
	// 	bugReportNotice.hide();
	// };

	// bugReportNotice.messageEl.oncontextmenu = () => {
	// 	bugReportModal.open();
	// 	bugReportNotice.hide();
	// };

	// Anotehr method to open the bug reporter modal

	const bugReportNotice = new Notice(
		createFragment((f) => {
			f.createDiv("bugReportNotice", (el) => {
				el.createEl("p", {
					text: t("bug-report-notice-message"),
				});
				el.createEl("button", {
					text: t("show-error"),
					cls: "reportBugButton",
					onclick: () => {
						const bugReportModal = new BugReporterModal(
							plugin,
							message,
							bugContent,
							context
						);
						bugReportModal.open();
						el.hide();
					},
				});
				el.createEl("button", {
					text: t("ignore-this-bug"),
					cls: "ignoreBugButton",
					onclick: () => {
						el.hide();
					},
				});
			});
		}),
		0
	);

	bugReportNotice.messageEl.onClickEvent((e) => {
		if (!(e.target instanceof HTMLButtonElement)) {
			e.stopPropagation();
			e.preventDefault();
			e.stopImmediatePropagation();
		}
	});

	// ------- Working Code --------
	// const bugReportNotice = new Notice(
	// 	"Task board encountered an issue while completing the bug. Please click on this message and report the bug. Right-click to dismiss.",
	// 	0
	// );
	// bugReportNotice.messageEl.oncontextmenu = () => {
	// 	const bugReportModal = new BugReporterModal(
	// 		plugin.app,
	// 		message,
	// 		bugContent,
	// 		context
	// 	);
	// 	bugReportModal.open();

	// 	bugReportNotice.hide();
	// };

	// bugReportNotice.messageEl.onclick = () => {
	// 	bugReportNotice.hide();
	// };
};

export const openDiffContentCompareModal = (
	plugin: TaskBoard,
	oldContent: string,
	newContent: string,
	onSelect: (which: "old" | "new") => void
) => {
	const contentMismatchNotice = new Notice(
		createFragment((f) => {
			f.createDiv("bugReportNotice", (el) => {
				el.createEl("p", {
					text: `${t("safe-guard")} : ${t(
						"content-mismatch-notice-message"
					)}`,
				});
				el.createEl("button", {
					text: t("show-conflicts"),
					cls: "reportBugButton",
					onclick: () => {
						const modal = new DiffContentCompareModal(
							plugin,
							oldContent,
							newContent,
							onSelect
						);
						modal.open();
						el.hide();
					},
				});
			});
		}),
		0
	);

	contentMismatchNotice.messageEl.onClickEvent((e) => {
		if (!(e.target instanceof HTMLButtonElement)) {
			e.stopPropagation();
			e.preventDefault();
			e.stopImmediatePropagation();
		}
	});
};

export const openTaskBoardActionsModal = (
	plugin: TaskBoard,
	activeBoardIndex: number
) => {
	const actionModal = new TaskBoardActionsModal(
		plugin,
		plugin.settings.data.boardConfigs[activeBoardIndex].columns
	);
	actionModal.open();
};

export const openScanFiltersModal = (
	plugin: TaskBoard,
	filterType: "files" | "frontMatter" | "folders" | "tags",
	onSave: (scanFilters: string[]) => void
) => {
	new ScanFilterModal(plugin, filterType, async (newValues) => {
		onSave(newValues);
	}).open();
};

/**
 * Open AddOrEditTask as a view in a new leaf (tab or popout window)
 * This allows the task editor to be used in tabs alongside other content
 *
 * @param plugin - The TaskBoard plugin instance
 * @param saveTask - Callback function to handle task saving
 * @param isTaskNote - Whether this is a task note
 * @param activeNote - Whether the active note should be used
 * @param taskExists - Whether editing an existing task
 * @param task - Optional task to edit
 * @param filePath - Optional file path for the task
 * @param location - Where to open the view: "tab" (new tab), "split" (split pane), or "window" (popout window)
 * @returns Promise resolving to the WorkspaceLeaf or null
 *
 * @example
 * // Open in a new tab for editing an existing task
 * openAddOrEditTaskView(
 *   plugin,
 *   (updatedTask, quickAddChoice, noteContent) => {
 *     // Handle task update
 *     updateTaskInFile(plugin, updatedTask);
 *   },
 *   false,
 *   false,
 *   true,
 *   existingTask,
 *   "path/to/file.md",
 *   "tab"
 * );
 *
 * @example
 * // Open in a popout window for creating a new task
 * openAddOrEditTaskView(
 *   plugin,
 *   (newTask, quickAddChoice, noteContent) => {
 *     // Handle new task creation
 *     addTaskInNote(plugin, newTask, false);
 *   },
 *   false,
 *   false,
 *   false,
 *   undefined,
 *   "path/to/file.md",
 *   "window"
 * );
 */
export const openEditTaskView = async (
	plugin: TaskBoard,
	isTaskNote: boolean,
	activeNote: boolean,
	taskExists: boolean,
	task: taskItem,
	filePath: string,
	location: "tab" | "split" | "window" = "tab"
): Promise<WorkspaceLeaf | null> => {
	const { workspace } = plugin.app;

	const viewTypeId = task.legacyId
		? `${VIEW_TYPE_ADD_OR_EDIT_TASK}-${task.legacyId}`
		: `${VIEW_TYPE_ADD_OR_EDIT_TASK}-${String(task.id)}`;

	const taskId = task.legacyId ? task.legacyId : String(task.id);

	const leaves = workspace.getLeavesOfType(viewTypeId);
	console.log("Leaves : ", leaves);
	const matchLeaf = leaves.find((leaf) => {
		// const viewEphemeralState = leaf.getEphemeralState();
		// console.log("empheral states of : ", viewEphemeralState);

		const customView = leaf.view as AddOrEditTaskView;
		const leafTaskId = customView?.task.legacyId
			? customView.task.legacyId
			: String(customView?.task.id);
		console.log("taskId :", taskId, "\nleafTaskId :", leafTaskId);

		return taskId === leafTaskId;
	});
	console.log("Matched leaf :", matchLeaf);

	if (matchLeaf) {
		// Set the view on the leaf
		// await matchLeaf.setViewState(
		// 	{
		// 		type: VIEW_TYPE_ADD_OR_EDIT_TASK,
		// 		active: true,
		// 	},
		// 	{ viewTaskId: taskId }
		// );

		matchLeaf.setEphemeralState({ viewTaskId: taskId });

		// Reveal the leaf
		workspace.revealLeaf(matchLeaf);

		return leaves[0];
	} else {
		// Detach any existing AddOrEditTask views
		// workspace.detachLeavesOfType(VIEW_TYPE_ADD_OR_EDIT_TASK);

		let leaf: WorkspaceLeaf | null = null;

		if (location === "window") {
			// Open in a new popout window
			leaf = workspace.getLeaf("window");
		} else if (location === "split") {
			// Open in a split pane
			leaf = workspace.getLeaf("split");
		} else {
			// Open in a new tab
			leaf = workspace.getLeaf("tab");
		}

		if (leaf) {
			try {
				// For the first time after the plugin has loaded, a new view will be registered only if this openEditTaskView has been called. If any error occurs then eter the 'catch' body and simply replace the old view of the leaf with the new view created.

				// Register AddOrEditTask view (can be opened in tabs or popout windows)
				plugin.registerView(viewTypeId, (leaf) => {
					leaf.setEphemeralState({
						viewTaskId: taskId,
					});

					return new AddOrEditTaskView(
						plugin,
						leaf,
						viewTypeId,
						async (
							updatedTask,
							quickAddPluginChoice,
							updatedNoteContent
						) => {
							if (!isTaskNote) {
								// Update the task in the file and JSON
								updateTaskInFile(
									plugin,
									updatedTask,
									task
								).then((newId) => {
									plugin.realTimeScanning.processAllUpdatedFiles(
										updatedTask.filePath
									);
								});
							} else {
								if (!updatedNoteContent) {
									// Update frontmatter with task properties
									await updateFrontmatterInMarkdownFile(
										plugin,
										updatedTask
									).then(() => {
										// This is required to rescan the updated file and refresh the board.
										plugin.realTimeScanning.processAllUpdatedFiles(
											updatedTask.filePath
										);
									});
								} else {
									writeDataToVaultFile(
										plugin,
										updatedTask.filePath,
										updatedNoteContent
									).then(() => {
										sleep(2000).then(() => {
											// TODO : Is 2 sec really required ?
											// This is required to rescan the updated file and refresh the board.
											plugin.realTimeScanning.processAllUpdatedFiles(
												updatedTask.filePath
											);
										});
									});
								}
							}
						},
						isTaskNote,
						activeNote,
						taskExists,
						task,
						filePath
					);
				});
			} catch {
				const view = new AddOrEditTaskView(
					plugin,
					leaf,
					viewTypeId,
					async (
						updatedTask,
						quickAddPluginChoice,
						updatedNoteContent
					) => {
						if (!isTaskNote) {
							// Update the task in the file and JSON
							updateTaskInFile(plugin, updatedTask, task).then(
								(newId) => {
									plugin.realTimeScanning.processAllUpdatedFiles(
										updatedTask.filePath
									);
								}
							);
						} else {
							if (!updatedNoteContent) {
								// Update frontmatter with task properties
								await updateFrontmatterInMarkdownFile(
									plugin,
									updatedTask
								).then(() => {
									// This is required to rescan the updated file and refresh the board.
									plugin.realTimeScanning.processAllUpdatedFiles(
										updatedTask.filePath
									);
								});
							} else {
								writeDataToVaultFile(
									plugin,
									updatedTask.filePath,
									updatedNoteContent
								).then(() => {
									sleep(2000).then(() => {
										// TODO : Is 2 sec really required ?
										// This is required to rescan the updated file and refresh the board.
										plugin.realTimeScanning.processAllUpdatedFiles(
											updatedTask.filePath
										);
									});
								});
							}
						}
					},
					isTaskNote,
					activeNote,
					taskExists,
					task,
					filePath
				);

				// Replace the leaf's view with our configured view
				// This is a workaround since registerView creates a default instance
				// (leaf as any).view = view;
				await view.onOpen();
			}

			// Set the view on the leaf
			await leaf.setViewState({
				type: viewTypeId,
				active: true,
			});
			leaf.setEphemeralState({
				viewTaskId: taskId,
			});
			console.log("EphemeralState : ", leaf.getEphemeralState());

			// Reveal the leaf
			workspace.revealLeaf(leaf);
		}
		return leaf;
	}
};
