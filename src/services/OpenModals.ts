// src/services/OpenModals.ts

import { App, Notice, TFile } from "obsidian";
import { addTaskInNote } from "src/utils/TaskItemUtils";

import { AddOrEditTaskModal } from "src/modal/AddOrEditTaskModal";
import { Board } from "../interfaces/BoardConfigs";
import { BoardConfigureModal } from "src/modal/BoardConfigModal";
import { ScanVaultModal } from "src/modal/ScanVaultModal";
import type TaskBoard from "main";
import { eventEmitter } from "./EventEmitter";
import { BugReporterModal } from "src/modal/BugReporterModal";
import { CommunityPlugins } from "./CommunityPlugins";
import { getFormattedTaskContent } from "src/utils/TaskContentFormatter";
import { t } from "src/utils/lang/helper";
import { DiffContentCompareModal } from "src/modal/DiffContentCompareModal";
import { TaskBoardActionsModal } from "src/modal/TaskBoardActionsModal";
import { ScanFilterModal } from "src/modal/ScanFilterModal";

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
	const scanFilters = plugin.settings.data.globalSettings.scanFilters;
	const AddTaskModal = new AddOrEditTaskModal(
		app,
		plugin,
		(newTask, quickAddPluginChoice) => {
			addTaskInNote(plugin, newTask, true, cursorPosition).then(() => {
				const currentFile = plugin.app.vault.getFileByPath(
					newTask.filePath
				);
				plugin.realTimeScanning.processAllUpdatedFiles(currentFile);
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
	const scanFilters = plugin.settings.data.globalSettings.scanFilters;
	const preDefinedNoteFile = plugin.app.vault.getAbstractFileByPath(
		plugin.settings.data.globalSettings.preDefinedNote
	);
	const activeTFile = activeFile ? activeFile : preDefinedNoteFile;
	const communityPlugins = new CommunityPlugins(plugin);
	const AddTaskModal = new AddOrEditTaskModal(
		app,
		plugin,
		async (newTask, quickAddPluginChoice) => {
			if (communityPlugins.isQuickAddPluginEnabled()) {
				// Call the API of QuickAdd plugin and pass the formatted content.
				const completeTask = await getFormattedTaskContent(newTask);
				(communityPlugins.quickAddPlugin as any)?.api.executeChoice(
					quickAddPluginChoice,
					{
						value: completeTask + "\n",
					}
				);
			} else {
				await addTaskInNote(plugin, newTask, false).then(() => {
					const currentFile = plugin.app.vault.getFileByPath(
						newTask.filePath
					);
					plugin.realTimeScanning.processAllUpdatedFiles(currentFile);
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
		undefined,
		activeTFile
			? activeTFile.path
			: plugin.settings.data.globalSettings.preDefinedNote
	);
	AddTaskModal.open();
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
