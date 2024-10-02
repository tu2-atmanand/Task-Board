// src/services/OpenModals.ts

import { App, Plugin } from "obsidian";

import { Board } from "../interfaces/KanbanBoard";
import { BoardConfigureModal } from "src/modal/BoardConfigModal";
import { ReScanVaultModal } from "src/modal/ReScanVaultModal";
import TaskBoard from "main";
import fs from "fs";
import path from "path";

// Function to open the BoardConfigModal
export const openBoardConfigModal = (
	app: App,
	boards: Board[],
	activeBoardIndex: number,
	onSave: (updatedBoards: Board[]) => void
) => {
	new BoardConfigureModal(app, boards, activeBoardIndex, onSave).open();
};

// Function to open the BoardConfigModal
export const openReScanVaultModal = (
	app: App,
	plugin: TaskBoard
) => {
	new ReScanVaultModal(app, plugin).open();
};
