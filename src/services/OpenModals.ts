// src/services/OpenModals.ts

import { addTaskInActiveEditor, addTaskInJson } from "src/utils/TaskItemUtils";
import {
	scanFilterForFilesNFolders,
	scanFilterForTags,
} from "src/utils/FiltersVerifier";

import { AddOrEditTaskModal } from "src/modal/AddOrEditTaskModal";
import { Board } from "../interfaces/BoardConfigs";
import { BoardConfigureModal } from "src/modal/BoardConfigModal";
import { ScanVaultModal } from "src/modal/ScanVaultModal";
import { TFile } from "obsidian";
import type TaskBoard from "main";
import { eventEmitter } from "./EventEmitter";

// Function to open the BoardConfigModal
export const openBoardConfigModal = (
	plugin: TaskBoard,
	boards: Board[],
	activeBoardIndex: number,
	onSave: (updatedBoards: Board[]) => void
) => {
	new BoardConfigureModal(
		plugin,
		boards,
		activeBoardIndex,
		onSave
	).open();
};

// Function to open the BoardConfigModal
export const openScanVaultModal = (plugin: TaskBoard) => {
	new ScanVaultModal(plugin).open();
};

export const openAddNewTaskModal = (
	plugin: TaskBoard,
	activeFile: TFile
) => {
	const scanFilters = plugin.settings.data.globalSettings.scanFilters;
	const AddTaskModal = new AddOrEditTaskModal(
		plugin,
		(newTask) => {
			addTaskInActiveEditor(plugin, newTask);
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
