// /src/utils/RealTimeScanning.ts

import { App, TAbstractFile, TFile, TFolder } from "obsidian";

import type ScanningVault from "src/utils/ScanningVault";
import type TaskBoard from "main";
import { bugReporter } from "src/services/OpenModals";
import { eventEmitter } from "src/services/EventEmitter";

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

	async processAllUpdatedFiles(currentFile?: TFile | string | undefined) {
		let newFile: TFile | null | undefined = null;
		if (currentFile && typeof currentFile === "string") {
			newFile = this.plugin.app.vault.getFileByPath(currentFile);
		} else {
			newFile = currentFile as TFile | undefined;
		}

		const filesToProcess = this.taskBoardFileStack.slice();
		this.taskBoardFileStack = [];
		const files = filesToProcess
			.map((filePath) => this.getFileFromPath(filePath))
			.filter((file) => !!file);

		if (newFile) {
			// If a current file is provided, ensure it's included in the processing
			const currentFilePath = newFile.path;
			if (!filesToProcess.includes(currentFilePath)) {
				filesToProcess.push(currentFilePath);
				files.push(newFile);
			}
		}
		if (filesToProcess.length > 0) {
			// Send all files for scanning and updating tasks
			await this.scanningVault.refreshTasksFromFiles(files, false);
		}
		// Save updated stack (which should now be empty)
		this.saveStack();

		// Reset the editorModified flag after the scan.
		this.plugin.editorModified = false;
	}

	getFileFromPath(filePath: string): TFile | null {
		return this.plugin.app?.vault.getFileByPath(filePath);
	}

	onFileModified(file: TFile) {
		if (
			this.taskBoardFileStack.at(0) === undefined ||
			!this.taskBoardFileStack.includes(file.path)
		) {
			this.taskBoardFileStack.push(file.path); // Add the file to the stack
			this.saveStack(); // Save the updated stack
		}
	}

	onFileRenamed(file: TAbstractFile, oldPath: string) {
		let foundFlag = false;
		// Find the oldPath inside the plugin.scanningVault.tasksCache and replace it with the new file path. Please dont update it inside taskBoardFileStack.
		const { Pending, Completed, Notes } =
			this.plugin.scanningVault.tasksCache;

		[Pending, Completed].forEach((cache) => {
			if (cache && typeof cache === "object") {
				if (file instanceof TFile && cache.hasOwnProperty(oldPath)) {
					cache[file.path] = cache[oldPath];
					cache[file.path].forEach((task) => {
						if (task.filePath === oldPath) {
							task.filePath = file.path; // Update the file path in the task
							foundFlag = true;
						}
					});
					delete cache[oldPath];
				} else if (file instanceof TFolder) {
					// Actually this is not at all needed as I am only running this function when a file is renamed. Also it was required because, it will anyways going to run of TFile, and if I run it for TFolder as well, it will run two files for the same file. If in case of child folders, it will too many times for the same file unnecessarily.
					const keysToUpdate = Object.keys(cache).filter((key) =>
						key.startsWith(oldPath + "/")
					);
					keysToUpdate.forEach((oldKey) => {
						const newKey =
							file.path + oldKey.substring(oldPath.length);
						cache[newKey] = cache[oldKey];
						cache[newKey].forEach((task) => {
							if (task.filePath.startsWith(oldPath + "/")) {
								task.filePath =
									file.path +
									task.filePath.substring(oldPath.length);
								foundFlag = true;
							}
						});
						delete cache[oldKey];
					});
					cache[file.path] = cache[oldPath];
					delete cache[oldPath];
				}
			}
		});

		if (file instanceof TFile) {
			// Update the file path in the Notes cache
			Notes.forEach((note) => {
				if (note.filePath === oldPath) {
					note.filePath = file.path; // Update the file path in the note
					foundFlag = true;
				}
			});
		} else if (file instanceof TFolder) {
			// Actually this is not at all needed as I am only running this function when a file is renamed. Also it was required because, it will anyways going to run of TFile, and if I run it for TFolder as well, it will run two files for the same file. If in case of child folders, it will too many times for the same file unnecessarily.
			Notes.forEach((note) => {
				if (note.filePath.startsWith(oldPath + "/")) {
					note.filePath =
						file.path + note.filePath.substring(oldPath.length);
					foundFlag = true;
				}
			});
		}

		// Also remove the old path from the stack if it exists
		const index = this.taskBoardFileStack.indexOf(oldPath);
		if (index !== -1) {
			this.taskBoardFileStack.splice(index, 1);
			this.saveStack(); // Save the updated stack
		}
		// if (file instanceof TFile) {
		// 	this.onFileModified(file); // Re-add the file to the stack
		// 	this.plugin.editorModified = true; // Set the editorModified flag to true
		// }

		if (foundFlag) {
			this.plugin.scanningVault.tasksCache.Pending = Pending;
			this.plugin.scanningVault.tasksCache.Completed = Completed;
			this.plugin.scanningVault.tasksCache.Notes = Notes;
			this.plugin.scanningVault.saveTasksToJsonCache();
			eventEmitter.emit("REFRESH_COLUMN");
		}
	}

	onFileDeleted(file: TAbstractFile) {
		let foundFlag = false;
		// Remove the file from the stack if it exists
		const index = this.taskBoardFileStack.indexOf(file.path);
		if (index !== -1) {
			this.taskBoardFileStack.splice(index, 1);
			this.saveStack(); // Save the updated stack
		}

		// Also remove the file from the tasks cache
		const { Pending, Completed, Notes } =
			this.plugin.scanningVault.tasksCache;
		[Pending, Completed].forEach((cache) => {
			if (cache && typeof cache === "object") {
				if (file instanceof TFile && cache.hasOwnProperty(file.path)) {
					delete cache[file.path];
					foundFlag = true;
				} else if (file instanceof TFolder) {
					// Actually this is not at all needed as I am only running this function when a file is deleted. Also it was required because, it will anyways going to run of TFile, and if I run it for TFolder as well, it will run two files for the same file. If in case of child folders, it will too many times for the same file unnecessarily.
					const keysToDelete = Object.keys(cache).filter((key) =>
						key.startsWith(file.path + "/")
					);
					keysToDelete.forEach((key) => {
						delete cache[key];
						foundFlag = true;
					});
				}
			}
		});

		if (file instanceof TFile) {
			// Update the file path in the Notes cache
			Notes.forEach((note) => {
				if (note.filePath === file.path) {
					// remove this object from Notes
					const noteIndex = Notes.indexOf(note);
					if (noteIndex !== -1) {
						Notes.splice(noteIndex, 1);
						foundFlag = true;
					}
				}
			});
		} else if (file instanceof TFolder) {
			// Actually this is not at all needed as I am only running this function when a file is deleted. Also it was required because, it will anyways going to run of TFile, and if I run it for TFolder as well, it will run two files for the same file. If in case of child folders, it will too many times for the same file unnecessarily.
			Notes.forEach((note) => {
				if (note.filePath.startsWith(file.path + "/")) {
					// remove this object from Notes
					const noteIndex = Notes.indexOf(note);
					if (noteIndex !== -1) {
						Notes.splice(noteIndex, 1);
						foundFlag = true;
					}
				}
			});
		}

		if (foundFlag) {
			this.plugin.scanningVault.tasksCache.Pending = Pending;
			this.plugin.scanningVault.tasksCache.Completed = Completed;
			this.plugin.scanningVault.tasksCache.Notes = Notes;
			this.plugin.scanningVault.saveTasksToJsonCache();
			eventEmitter.emit("REFRESH_COLUMN");
		}
	}
}
