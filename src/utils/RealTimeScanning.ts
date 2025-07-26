// /src/utils/RealTimeScanning.ts

import { App, TFile, getFrontMatterInfo } from "obsidian";

import type ScanningVault from "src/utils/ScanningVault";
import type TaskBoard from "main";
import { scanFilterForFilesNFolders } from "./FiltersVerifier";
import { bugReporter } from "src/services/OpenModals";

export class RealTimeScanning {
	app: App;
	plugin: TaskBoard;
	taskBoardFileStack: string[] = [];
	scanningVault: ScanningVault;

	constructor(app: App, plugin: TaskBoard, scanningVault: ScanningVault) {
		this.app = app;
		this.plugin = plugin;
		this.scanningVault = scanningVault;
	}

	async initializeStack() {
		try {
			const storedStack = localStorage.getItem("taskBoardFileStack");
			if (storedStack) {
				this.taskBoardFileStack = JSON.parse(storedStack);
			}
			// this.startScanTimer();
		} catch (error) {
			console.error("Error loading file stack:", error);
		}
	}

	saveStack() {
		try {
			localStorage.setItem(
				"taskBoardFileStack",
				JSON.stringify(this.taskBoardFileStack)
			);
		} catch (error) {
			bugReporter(
				this.plugin,
				"Error saving file stack to localStorage.",
				String(error),
				"RealTimeScanning.ts/saveStack"
			);
		}
	}

	async processAllUpdatedFiles(currentFile?: TFile | null) {
		console.log(
			"RealTimeScanning.ts : processAllUpdatedFiles called with currentFile:",
			currentFile?.path
		);
		const filesToProcess = this.taskBoardFileStack.slice();
		this.taskBoardFileStack = [];
		const files = filesToProcess
			.map((filePath) => this.getFileFromPath(filePath))
			.filter((file) => !!file);

		if (currentFile) {
			// If a current file is provided, ensure it's included in the processing
			const currentFilePath = currentFile.path;
			if (!filesToProcess.includes(currentFilePath)) {
				filesToProcess.push(currentFilePath);
				files.push(currentFile);
			}
		}
		if (filesToProcess.length > 0) {
			// Send all files for scanning and updating tasks
			await this.scanningVault.refreshTasksFromFiles(files);
		}
		// Save updated stack (which should now be empty)
		this.saveStack();
	}

	getFileFromPath(filePath: string): TFile | null {
		return this.plugin.app.vault.getFileByPath(filePath);
	}

	onFileModified(file: TFile) {
		console.log(
			"RealTimeScanning.ts : onFileModified called for the updated file:",
			file.path
		);
		if (
			this.taskBoardFileStack.at(0) === undefined ||
			!this.taskBoardFileStack.includes(file.path)
		) {
			this.taskBoardFileStack.push(file.path); // Add the file to the stack
			this.saveStack(); // Save the updated stack
		}
	}
}
