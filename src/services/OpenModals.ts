// src/services/OpenModals.ts

import { App, Notice, TFile } from "obsidian";
import { addTaskInNote, updateTaskInFile } from "src/utils/TaskItemUtils";

import { AddOrEditTaskModal } from "src/modal/AddOrEditTaskModal";
import { Board } from "../interfaces/BoardConfigs";
import { BoardConfigureModal } from "src/modal/BoardConfigModal";
import { ScanVaultModal } from "src/modal/ScanVaultModal";
import type TaskBoard from "main";
import { eventEmitter } from "./EventEmitter";
import { BugReporterModal } from "src/modal/BugReporterModal";
import { CommunityPlugins } from "./CommunityPlugins";
import {
	addIdToTaskContent,
	getFormattedTaskContent,
} from "src/utils/TaskContentFormatter";
import { t } from "src/utils/lang/helper";
import { DiffContentCompareModal } from "src/modal/DiffContentCompareModal";
import { TaskBoardActionsModal } from "src/modal/TaskBoardActionsModal";
import { ScanFilterModal } from "src/modal/ScanFilterModal";
import { taskItem } from "src/interfaces/TaskItem";
import { updateTaskNoteFrontmatter } from "src/utils/TaskNoteUtils";
import { writeDataToVaultFile } from "src/utils/MarkdownFileOperations";

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
			addTaskInNote(plugin, newTask, true, cursorPosition).then(() => {
				plugin.realTimeScanning.processAllUpdatedFiles(
					newTask.filePath
				);
			});

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
				completeTask = addIdToTaskContent(plugin, completeTask);

				(communityPlugins.quickAddPlugin as any)?.api.executeChoice(
					quickAddPluginChoice,
					{
						value: completeTask + "\n",
					}
				);
			} else {
				await addTaskInNote(plugin, newTask, false).then(() => {
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
				console.warn("This code should not run...");
			} else {
				// If noteContent is provided, it means user wants to save this task as a TaskNote.
				// Create the note content with frontmatter

				console.log(
					"The newTask received : ",
					newTask,
					"\nThe noteContent received :\n",
					noteContent
				);

				try {
					// Check if the directory exists, create if not
					const parts = newTask.filePath.split("/");
					if (parts.length > 1) {
						const dirPath = parts.slice(0, -1).join("/");
						console.log("Directory Path:", dirPath);
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
									console.log(
										"New file is scanning after 1000 milliseconds : ",
										newTask.filePath
									);
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
	existingTask: taskItem,
	isTaskNote: boolean
) => {
	const EditTaskModal = new AddOrEditTaskModal(
		plugin,
		(updatedTask: taskItem) => {
			updatedTask.filePath = existingTask.filePath;
			// Update the task in the file and JSON
			updateTaskInFile(plugin, updatedTask, existingTask)
				.then(() => {
					plugin.realTimeScanning.processAllUpdatedFiles(
						updatedTask.filePath
					);
				})
				.catch((error) => {
					// bugReporter(
					// 	plugin,
					// 	"Error updating task in file",
					// 	error as string,
					// 	"TaskItemEventHandlers.ts/handleEditTask"
					// );
					console.error(
						"TaskItemEventHandlers.ts : Error updating task in file",
						error
					);
				});

			// updateTaskInJson(plugin, updatedTask); // NOTE : This is not necessary any more as I am scanning the file after it has been updated.

			// setTasks((prevTasks) =>
			// 	prevTasks.map((task) =>
			// 		task.id === updatedTask.id ? { ...task, ...updatedTask } : task
			// 	)
			// );
			// NOTE : The eventEmitter.emit("REFRESH_COLUMN") is being sent from the updateTaskInJson function, because if i add that here, then all the things are getting executed parallely instead of sequential.
		},
		isTaskNote,
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
					await updateTaskNoteFrontmatter(plugin, updatedTask).then(
						() => {
							// This is required to rescan the updated file and refresh the board.
							plugin.realTimeScanning.processAllUpdatedFiles(
								updatedTask.filePath
							);
						}
					);
				} else {
					writeDataToVaultFile(
						plugin,
						updatedTask.filePath,
						newTaskContent
					).then(() => {
						sleep(2000).then(() => {
							console.log(
								"This will run after updateTaskNoteFrontmatter has successfully run."
							);
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
							plugin.app,
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
