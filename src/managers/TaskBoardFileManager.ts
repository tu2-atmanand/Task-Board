/**
 * TaskBoardFileManager.ts
 * Manages loading and saving individual board configurations from/to .taskboard files
 * This replaces the previous approach of storing all board data in data.json
 */

import { App, TFile, Notice, normalizePath } from "obsidian";
import { Board } from "src/interfaces/BoardConfigs";
import type TaskBoard from "main";
import { taskBoardFilesRegistryItem } from "src/interfaces/GlobalSettings";

export default class TaskBoardFileManager {
	private app: App;
	private plugin: TaskBoard;
	private currentBoardIndex: number;
	private allBoardsData: Board[] | [] = [];

	constructor(plugin: TaskBoard) {
		this.plugin = plugin;
		this.app = plugin.app;
		this.currentBoardIndex =
			this.plugin.settings.data.lastViewHistory.boardIndex;
	}

	/**
	 * Load board configuration from a .taskboard file from disk.
	 * @param filePath - The path to the .taskboard file
	 * @returns The board configuration object, or null if file doesn't exist or cannot be parsed
	 */
	async loadBoardFromFile(filePath: string): Promise<Board | null> {
		try {
			// Check if file exists
			const fileExists = await this.app.vault.adapter.exists(filePath);
			if (!fileExists) {
				console.warn(`TaskBoard file not found: ${filePath}`);
				return null;
			}

			// Read the file
			const file = await this.app.vault.adapter.readBinary(filePath);
			const decodedData = new TextDecoder().decode(file);
			console.log(
				"Loaded file :",
				file,
				"\nDecoded data :\n",
				decodedData,
			);

			if (!decodedData) {
				console.warn(`TaskBoard file is empty: ${filePath}`);
				return null;
			}

			// Parse JSON content
			const boardData: Board = JSON.parse(decodedData);
			console.log(
				`Successfully loaded board from: ${filePath}`,
				boardData,
			);
			return boardData;
		} catch (error) {
			console.error(`Error loading board from file ${filePath}:`, error);
			return null;
		}
	}

	/**
	 * Loads the specific/current board data from the memory cache (allBoardsData),
	 * Based on the boardIndex passed
	 * @param boardIndex - The index of the board to load
	 * @returns The board configuration object, or null if file cannot be loaded
	 */
	async loadBoardUsingIndex(boardIndex: number): Promise<Board | null> {
		try {
			const boardIndexToUse = boardIndex ?? this.currentBoardIndex;
			console.log("All boards data :", this.allBoardsData);

			// Validate board index
			if (
				boardIndexToUse < 0 ||
				boardIndexToUse > this.allBoardsData.length - 1
			) {
				console.error(
					`Invalid board index: ${boardIndexToUse}. Available boards: ${this.plugin.settings.data.taskBoardFilesRegistry?.length}`,
				);
				return null;
			}

			const boardData = this.allBoardsData[boardIndexToUse];
			if (boardData) {
				// Cache the board data in memory
				this.currentBoardIndex = boardIndexToUse;
			}

			return boardData;
		} catch (error) {
			console.error(
				`Error loading board at index ${this.currentBoardIndex}:`,
				error,
			);
			return null;
		}
	}

	/**
	 * First tries to see if the board is already cached in memory,
	 * If not, loads the board from the .taskboard file at the given path,
	 * and caches it in memory and updates the currentBoardIndex
	 * @param filePath - The path to the .taskboard file
	 * @returns The board configuration object, or null if file cannot be loaded
	 */
	async loadBoardUsingPath(filePath: string): Promise<Board | null> {
		try {
			if (!filePath || filePath.trim() === "") {
				console.error(`No board file path provided to load the board`);
				return null;
			}

			// Check if board is already cached in memory based on id
			const taskBoardFilesRegistry =
				this.plugin.settings.data.taskBoardFilesRegistry || [];
			const registryItem = taskBoardFilesRegistry.find(
				(item) => item.filePath === filePath,
			);
			if (registryItem) {
				const cachedBoard = this.allBoardsData.find((board) => {
					return board.id === registryItem.boardId;
				});

				if (cachedBoard) {
					this.currentBoardIndex =
						this.getBoardIndexFromRegistry(cachedBoard.id) ??
						this.allBoardsData.length;
					console.log(
						`Board "${cachedBoard.name}" (index: ${this.currentBoardIndex}) loaded from cache for file: ${filePath}`,
					);
					return cachedBoard;
				}
			}

			// Load board from file (disk) since not found in cache
			const boardData = await this.loadBoardFromFile(filePath);

			if (boardData) {
				const newIndex = this.allBoardsData.length;
				// Cache the board data in memory
				this.allBoardsData[newIndex] = boardData;
				console.log(
					`Loaded and cached board "${boardData.name}" (index: ${newIndex}) from: ${filePath}`,
				);
				this.currentBoardIndex = newIndex;

				this.addNewBoardToRegistry(boardData.id, filePath);

				return boardData;
			} else {
				new Notice(
					`Task Board : Error loading board data from file : ${filePath}`,
				);
			}

			return null;
		} catch (error) {
			console.error(`Error loading board from file ${filePath}:`, error);
			return null;
		}
	}

	/**
	 * Loads all the boards data from disk,
	 * as per the file paths stored in the global settings.
	 * @returns All boards data as an array or an empty array if failed to load the boards.
	 */
	async loadAllBoards(): Promise<Board[] | []> {
		console.log("loadAllBoards : Starting to load all boards...");
		try {
			const taskBoardFilesRegistry =
				this.plugin.settings.data.taskBoardFilesRegistry || [];
			let allBoardsData: Board[] | [] = [];

			taskBoardFilesRegistry.forEach(
				async (taskBoardFileEntry: taskBoardFilesRegistryItem) => {
					if (
						!taskBoardFileEntry.filePath ||
						taskBoardFileEntry.filePath.trim() === ""
					) {
						console.error(
							`No board file path configured for index: ${this.currentBoardIndex}`,
						);
						return [];
					}

					// Load board from file
					const boardData = await this.loadBoardFromFile(
						taskBoardFileEntry.filePath,
					);

					if (boardData) {
						const boardIndex =
							this.getBoardIndexFromRegistry(boardData.id) ??
							this.allBoardsData.length;
						// Cache the board data in memory
						allBoardsData[boardIndex] = boardData;
						console.log(
							`Loaded and cached board "${boardData.name}" (index: ${boardIndex}) from: ${taskBoardFileEntry.filePath}`,
						);
					} else {
						new Notice(
							`Task Board : Error loading all boards data. Following board not found : ${taskBoardFileEntry.filePath}`,
						);
					}
				},
			);

			this.allBoardsData = allBoardsData;
			return allBoardsData;
		} catch (error) {
			console.error(
				`Error loading board at index ${this.currentBoardIndex}:`,
				error,
			);
			return [];
		}
	}

	/**
	 * Save board configuration to a .taskboard file
	 * @param filePath - The path to the .taskboard file
	 * @param boardData - The board configuration object to save
	 * @returns boolean - True if saved successfully, false otherwise
	 */
	async saveBoardToFile(
		filePath: string,
		boardData: Board,
	): Promise<boolean> {
		try {
			// Check if file exists, if not create it
			const fileExists = await this.app.vault.adapter.exists(filePath);

			// Convert board data to JSON string, then to Uint8Array for binary storage
			const jsonString = JSON.stringify(boardData);
			const uint8Array = new TextEncoder().encode(jsonString);
			const arrayBuffer = uint8Array.buffer.slice(
				uint8Array.byteOffset,
				uint8Array.byteOffset + uint8Array.byteLength,
			);

			if (!fileExists) {
				// Create new file with binary data
				await this.app.vault.createBinary(filePath, arrayBuffer);
				console.log(`Created new TaskBoard file: ${filePath}`);
			} else {
				// Update existing file with binary data
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (!file || !(file instanceof TFile)) {
					console.error(`Cannot find file to update: ${filePath}`);
					return false;
				}
				await this.app.vault.modifyBinary(file, arrayBuffer);
				console.log(`Updated TaskBoard file: ${filePath}`);
			}

			return true;
		} catch (error) {
			console.error(`Error saving board to file ${filePath}:`, error);
			return false;
		}
	}

	/**
	 * Save board configuration to disk by board index passed
	 * If no boardIndex has been passed, it will update currentBoard data
	 * Also updates the cached board data in memory
	 * @param updatedBoardData - The updated board configuration object
	 * @param boardIndex - (Optional) The index of the board to save
	 * @returns boolean - True if saved successfully, false otherwise
	 */
	async saveBoard(
		updatedBoardData: Board,
		boardIndex?: number,
	): Promise<boolean> {
		try {
			const taskBoardFilesRegistry =
				this.plugin.settings.data.taskBoardFilesRegistry || [];

			let boardIndexToUse = boardIndex;
			if (!boardIndexToUse) {
				boardIndexToUse = this.currentBoardIndex;
				// if (!boardIndexToUse) {
				// 	bugReporterManagerInsatance.showNotice(
				// 		90,
				// 		"The TaskBoardFileManager instance dont contain an currentBoardIndex number",
				// 		"ERROR : this.currentBoardIndex not found",
				// 		"TaskBoardFileManager/saveCurrentBoard",
				// 	);
				// 	return false;
				// }
			}

			// Validate board index
			if (
				boardIndexToUse < 0 ||
				boardIndexToUse >= taskBoardFilesRegistry.length
			) {
				console.error(
					`Invalid board index: ${boardIndexToUse}. Available boards: ${taskBoardFilesRegistry.length}`,
				);
				return false;
			}

			const taskBoardFileEntry = taskBoardFilesRegistry[boardIndexToUse];
			if (
				!taskBoardFileEntry.filePath ||
				taskBoardFileEntry.filePath.trim() === ""
			) {
				console.error(
					`No board file path configured for index: ${boardIndexToUse}`,
				);
				return false;
			}

			// Save board to file
			const success = await this.saveBoardToFile(
				taskBoardFileEntry.filePath,
				updatedBoardData,
			);

			if (success) {
				this.allBoardsData[boardIndexToUse] = updatedBoardData;

				console.log(
					`Saved board "${updatedBoardData.name}" (index: ${boardIndexToUse}) to: ${taskBoardFileEntry.filePath}`,
				);
			}

			return success;
		} catch (error) {
			console.error(
				`Error saving board at index ${boardIndex ?? this.currentBoardIndex}:`,
				error,
			);
			return false;
		}
	}

	/**
	 * Adds a new .taskboard file path to the registry in settings
	 * if it does not already exist
	 * @param filePath - The path to the .taskboard file
	 */
	async addNewBoardToRegistry(
		boardId: string,
		filePath: string,
	): Promise<void> {
		const taskBoardFilesRegistry =
			this.plugin.settings.data.taskBoardFilesRegistry || [];
		if (
			!taskBoardFilesRegistry.find((item) => item.filePath === filePath)
		) {
			taskBoardFilesRegistry.push({
				filePath: filePath,
				boardId: boardId,
			});
			this.plugin.settings.data.taskBoardFilesRegistry =
				taskBoardFilesRegistry;
			await this.plugin.saveSettings();
			console.log(`Added new board file to registry: ${filePath}`);
		} else {
			console.log(`Board file already exists in registry: ${filePath}`);
		}
	}

	/**
	 * Check if a .taskboard file exists
	 * @param filePath - The path to the .taskboard file
	 * @returns boolean - True if file exists, false otherwise
	 */
	async boardFileExists(filePath: string): Promise<boolean> {
		try {
			return await this.app.vault.adapter.exists(filePath);
		} catch (error) {
			console.error(`Error checking if file exists ${filePath}:`, error);
			return false;
		}
	}

	/**
	 * Create a new .taskboard file with initial board configuration
	 * @param filePath - The path where the new .taskboard file should be created
	 * @param boardData - The initial board configuration
	 * @returns boolean - True if created successfully, false otherwise
	 */
	async createNewBoardFile(
		filePath: string,
		boardData: Board,
	): Promise<boolean> {
		try {
			// Check if file already exists
			const exists = await this.boardFileExists(filePath);
			if (exists) {
				console.warn(`TaskBoard file already exists: ${filePath}`);
				return false;
			}

			const normalizedFilePath = normalizePath(filePath);
			console.log(
				"Original path :",
				filePath,
				"\nNormalized file path :",
				normalizedFilePath,
			);

			const parts = normalizedFilePath.split("/");
			parts.pop();
			const folderPath = parts.join("/");
			if (!(await this.plugin.app.vault.adapter.exists(folderPath))) {
				await this.plugin.app.vault.createFolder(folderPath);
			}

			return await this.saveBoardToFile(filePath, boardData);
		} catch (error) {
			console.error(`Error creating new board file ${filePath}:`, error);
			return false;
		}
	}

	/**
	 * Delete a .taskboard file
	 * @param filePath - The path to the .taskboard file
	 * @returns boolean - True if deleted successfully, false otherwise
	 */
	async deleteBoardFile(filePath: string): Promise<boolean> {
		try {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!file || !(file instanceof TFile)) {
				console.warn(`Cannot find file to delete: ${filePath}`);
				return false;
			}

			await this.app.vault.delete(file);
			console.log(`Deleted TaskBoard file: ${filePath}`);
			return true;
		} catch (error) {
			console.error(`Error deleting board file ${filePath}:`, error);
			return false;
		}
	}

	/**
	 * Get all .taskboard files from the vault
	 * Filters files with .taskboard extension
	 * @returns Array of .taskboard file paths
	 */
	getAllTaskboardFiles(): string[] {
		try {
			const allFiles = this.app.vault.getAllLoadedFiles();
			const taskboardFiles = allFiles
				.filter(
					(file) =>
						file instanceof TFile && file.extension === "taskboard",
				)
				.map((file) => (file as TFile).path);

			console.log(
				`Found ${taskboardFiles.length} .taskboard files:`,
				taskboardFiles,
			);
			return taskboardFiles;
		} catch (error) {
			console.error("Error getting all .taskboard files:", error);
			return [];
		}
	}

	/**
	 * Validate that all board files path present in settings also exist in the vault
	 * @returns Array of missing file paths
	 */
	async validateBoardFiles(): Promise<string[]> {
		const taskBoardFilesRegistry =
			this.plugin.settings.data.taskBoardFilesRegistry || [];
		const missingFiles: string[] = [];

		for (const taskBoardFileEntry of taskBoardFilesRegistry) {
			const exists = await this.boardFileExists(
				taskBoardFileEntry.filePath,
			);
			if (!exists) {
				missingFiles.push(taskBoardFileEntry.filePath);
				console.warn(
					`Expected board file not found: ${taskBoardFileEntry.filePath}. It may have been moved or deleted.`,
				);
			}
		}

		return missingFiles;
	}

	/**
	 * Create default board files that are configured in settings but don't exist yet
	 * This is called during plugin initialization
	 * @param defaultBoards - The default board configurations to create
	 * @returns number - Count of files created
	 */
	async createMissingDefaultBoardFiles(
		defaultBoards: Board[],
	): Promise<number> {
		const taskBoardFilesRegistry =
			this.plugin.settings.data.taskBoardFilesRegistry || [];
		let createdCount = 0;

		for (let i = 0; i < taskBoardFilesRegistry.length; i++) {
			const taskBoardFileEntry = taskBoardFilesRegistry[i];
			const exists = await this.boardFileExists(
				taskBoardFileEntry.filePath,
			);

			if (!exists && i < defaultBoards.length) {
				const created = await this.createNewBoardFile(
					taskBoardFileEntry.filePath,
					defaultBoards[i],
				);
				if (created) {
					createdCount++;
					console.log(
						`Created default board file: ${taskBoardFileEntry.filePath}`,
						defaultBoards[i].name,
					);
					new Notice(
						`Created default board file: ${taskBoardFileEntry.filePath} : ${defaultBoards[i].name}`,
					);
				}
			}
		}

		return createdCount;
	}

	/**
	 * Returns all the boards data cached in memory
	 * @returns Array of all board configurations
	 */
	async getAllBoards(): Promise<Board[]> {
		return this.allBoardsData;
	}

	/**
	 * Returns the board data that was last active/used by user.
	 * @returns The cached board data, or null if no board has been loaded
	 */
	async getCurrentBoardData(): Promise<Board | null> {
		return this.allBoardsData[this.currentBoardIndex];
	}

	/**
	 * Get the index of the last used board as per the saved files registry
	 * @returns The index of the currently loaded board, or null if no board has been loaded
	 */
	getCurrentBoardIndex(): number | null {
		return this.currentBoardIndex;
	}

	/**
	 * Get the index of a board from the registry based on its boardId
	 * @param boardId - The ID of the board
	 * @returns The index of the board in the registry, or null if not found
	 */
	getBoardIndexFromRegistry(boardId: string): number | null {
		const taskBoardFilesRegistry =
			this.plugin.settings.data.taskBoardFilesRegistry || [];
		const registryItem = taskBoardFilesRegistry.find(
			(item) => item.boardId === boardId,
		);
		if (registryItem) {
			return taskBoardFilesRegistry.indexOf(registryItem);
		}
		return null;
	}

	/**
	 * Get the file path of a board from the registry based on its boardId
	 * @param boardId - The ID of the board
	 * @returns The file path of the board, or null if not found
	 */
	getBoardFilepathFromRegistry(boardId: string): string | null {
		const taskBoardFilesRegistry =
			this.plugin.settings.data.taskBoardFilesRegistry || [];
		const registryItem = taskBoardFilesRegistry.find(
			(item) => item.boardId === boardId,
		);
		if (registryItem) {
			return registryItem.filePath;
		}
		return null;
	}

	/**
	 * Clear the cached board data
	 * Useful when switching between different boards or clearing state
	 */
	clearCurrentBoardCache(): void {
		this.allBoardsData = [];
		console.log("Cleared cached board data");
	}
}
