// src/services/OpenModals.ts

import { App, TFile } from "obsidian";
import { addTaskInActiveEditor, addTaskInJson } from "src/utils/TaskItemUtils";
import {
	scanFilterForFilesNFolders,
	scanFilterForTags,
} from "src/utils/FiltersVerifier";

import type { Board } from "src/interfaces/BoardConfigs";
import type TaskBoard from "main";
import { eventEmitter } from "./EventEmitter";

// Function to open the BoardConfigModal
export const openBoardConfigModal = (
	app: App,
	plugin: TaskBoard,
	boards: Board[],
	activeBoardIndex: number,
	onSave: (updatedBoards: Board[]) => void
) => {
	new BoardConfigureModal(
		app,
		plugin,
		boards,
		activeBoardIndex,
		onSave
	).open();
};

// Function to open the BoardConfigModal
export const openScanVaultModal = (app: App, plugin: TaskBoard) => {
	new ScanVaultModal(app, plugin).open();
};

export const openAddNewTaskModal = (
	app: App,
	plugin: TaskBoard,
	activeFile: TFile
) => {
	const scanFilters = plugin.settings.data.globalSettings.scanFilters;
	const AddTaskModal = new AddOrEditTaskModal(
		app,
		plugin,
		(newTask) => {
			addTaskInActiveEditor(app, plugin, newTask);
			if (
				scanFilterForFilesNFolders(activeFile, scanFilters) &&
				scanFilterForTags(newTask.tags, scanFilters)
			) {
				addTaskInJson(plugin, newTask);
			}

			eventEmitter.emit("REFRESH_COLUMN");
		},
		activeFile.path
	);
	AddTaskModal.open();
};
