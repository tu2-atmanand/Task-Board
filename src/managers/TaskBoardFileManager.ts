/**
 * TaskBoardFileManager.ts
 * Manages loading and saving individual board configurations from/to .taskboard files
 * This replaces the previous approach of storing all board data in data.json
 */

import { App, TFile, Notice, normalizePath } from "obsidian";
import { Board } from "src/interfaces/BoardConfigs";
import type TaskBoard from "main";

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
	 * Load board configuration from a .taskboard file
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
	 * Loads all the boards data as per the file paths stored in the global settings.
	 * @returns All boards data as an array or an empty array if failed to load the boards.
	 */
	async loadAllBoards(): Promise<Board[] | []> {
		try {
			const boardFilesLocations =
				this.plugin.settings.data.boardFilesLocation || [];
			let allBoardsData: Board[] | [] = [];

			boardFilesLocations.forEach(async (boardFilePath: string) => {
				if (!boardFilePath || boardFilePath.trim() === "") {
					console.error(
						`No board file path configured for index: ${this.currentBoardIndex}`,
					);
					return [];
				}

				// Load board from file
				const boardData = await this.loadBoardFromFile(boardFilePath);

				if (boardData) {
					// Cache the board data in memory
					allBoardsData[boardData.index] = boardData;
					console.log(
						`Loaded and cached board "${boardData.name}" (index: ${boardData.index}) from: ${boardFilePath}`,
					);

					return boardData;
				} else {
					new Notice(
						`Task Board : Error loading all boards data. Following board not found : ${boardFilePath}`,
					);
				}

				return [];
			});

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
	 * Loads the specific/current board data from the memory cache (allBoardsData)
	 * @param boardIndex - The index of the board to load
	 * @returns The board configuration object, or null if file cannot be loaded
	 */
	async loadBoard(boardIndex?: number): Promise<Board | null> {
		try {
			const currentBoardINdex = boardIndex ?? this.currentBoardIndex;

			// Validate board index
			if (
				currentBoardINdex < 0 ||
				currentBoardINdex > this.allBoardsData.length - 1
			) {
				console.error(
					`Invalid board index: ${currentBoardINdex}. Available boards: ${this.plugin.settings.data.boardFilesLocation.length}`,
				);
				return null;
			}

			const boardData = this.allBoardsData[currentBoardINdex];
			if (boardData) {
				// Cache the board data in memory
				this.currentBoardIndex = currentBoardINdex;
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
			const boardFilesLocation =
				this.plugin.settings.data.boardFilesLocation || [];

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
				boardIndexToUse >= boardFilesLocation.length
			) {
				console.error(
					`Invalid board index: ${boardIndexToUse}. Available boards: ${boardFilesLocation.length}`,
				);
				return false;
			}

			const boardFilePath = boardFilesLocation[boardIndexToUse];
			if (!boardFilePath || boardFilePath.trim() === "") {
				console.error(
					`No board file path configured for index: ${boardIndexToUse}`,
				);
				return false;
			}

			// Save board to file
			const success = await this.saveBoardToFile(
				boardFilePath,
				updatedBoardData,
			);

			if (success) {
				this.allBoardsData[boardIndexToUse] = updatedBoardData;

				console.log(
					`Saved board "${updatedBoardData.name}" (index: ${boardIndexToUse}) to: ${boardFilePath}`,
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
		const boardFilesLocation =
			this.plugin.settings.data.boardFilesLocation || [];
		const missingFiles: string[] = [];

		for (const filePath of boardFilesLocation) {
			const exists = await this.boardFileExists(filePath);
			if (!exists) {
				missingFiles.push(filePath);
				console.warn(
					`Expected board file not found: ${filePath}. It may have been moved or deleted.`,
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
		const boardFilesLocation =
			this.plugin.settings.data.boardFilesLocation || [];
		let createdCount = 0;

		for (let i = 0; i < boardFilesLocation.length; i++) {
			const filePath = boardFilesLocation[i];
			const exists = await this.boardFileExists(filePath);

			if (!exists && i < defaultBoards.length) {
				const created = await this.createNewBoardFile(
					filePath,
					defaultBoards[i],
				);
				if (created) {
					createdCount++;
					console.log(
						`Created default board file: ${filePath}`,
						defaultBoards[i].name,
					);
					new Notice(
						`Created default board file: ${filePath} : ${defaultBoards[i].name}`,
					);
				}
			}
		}

		return createdCount;
	}

	async getAllBoards(): Promise<Board[]> {
		return this.allBoardsData;
	}

	/**
	 * Get the currently cached board data
	 * Returns the board that was last loaded with loadBoard()
	 * @returns The cached board data, or null if no board has been loaded
	 */
	async getCurrentBoardData(): Promise<Board | null> {
		return this.allBoardsData[this.currentBoardIndex];
	}

	/**
	 * Get the index of the currently cached board
	 * @returns The index of the currently loaded board, or null if no board has been loaded
	 */
	getCurrentBoardIndex(): number | null {
		return this.currentBoardIndex;
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
