// src/services/OpenModals.ts

import { App, Plugin, TFile } from "obsidian";
import { addTaskInFile, addTaskInJson } from "src/utils/TaskItemUtils";
import {
	scanFilterForFilesNFolders,
	scanFilterForTags,
} from "src/utils/Checker";

import { AddOrEditTaskModal } from "src/modal/AddOrEditTaskModal";
import { Board } from "../interfaces/BoardConfigs";
import { BoardConfigureModal } from "src/modal/BoardConfigModal";
import { ReScanVaultModal } from "src/modal/ReScanVaultModal";
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
export const openReScanVaultModal = (app: App, plugin: TaskBoard) => {
	new ReScanVaultModal(app, plugin).open();
};

export const openAddNewTaskModal = (
	app: App,
	plugin: TaskBoard,
	activeFile: TFile
) => {
	const scanFilters = plugin.settings.data.globalSettings.scanFilters;
	const AddTaskModal = new AddOrEditTaskModal(
		app,
		(newTask) => {
			addTaskInFile(app, newTask);
			if (
				scanFilterForFilesNFolders(activeFile, scanFilters) &&
				scanFilterForTags(newTask.tag, scanFilters)
			) {
				addTaskInJson(newTask);
			}

			eventEmitter.emit("REFRESH_COLUMN");
		},
		activeFile.path
	);
	AddTaskModal.open();
};
