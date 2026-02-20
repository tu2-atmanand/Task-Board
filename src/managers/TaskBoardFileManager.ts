/**
 * TaskBoardFileManager.ts
 * Manages loading and saving individual board configurations from/to .taskboard files
 * This replaces the previous approach of storing all board data in data.json
 */

import { App, TFile, Notice, normalizePath } from "obsidian";
import { Board } from "src/interfaces/BoardConfigs";
import type TaskBoard from "main";
import { taskBoardFilesRegistryItem } from "src/interfaces/GlobalSettings";
import { generateRandomTempTaskId } from "src/utils/TaskItemUtils";

/**
 * Interface for storing recently loaded board data keyed by file path
 */
interface recentBoardsDataType {
	[filePath: string]: Board;
}

export default class TaskBoardFileManager {
	private app: App;
	private plugin: TaskBoard;
	private recentBoardsData: recentBoardsDataType = {};

	constructor(plugin: TaskBoard) {
		this.plugin = plugin;
		this.app = plugin.app;
	}

	/**
	 * Load board configuration from a .taskboard file from disk.
	 * After loading, checks if the boardID already exists in the registry:
	 * - If exists with same filePath: no action needed
	 * - If exists with different filePath: generates new boardID for this board
	 * - If doesn't exist: adds the board to the registry
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

			if (!decodedData) {
				console.warn(`TaskBoard file is empty: ${filePath}`);
				return null;
			}

			// Parse JSON content
			let boardData: Board = JSON.parse(decodedData);

			// Check if board with this ID already exists in registry
			const taskBoardFilesRegistry =
				this.plugin.settings.data.taskBoardFilesRegistry || {};
			const existingRegistryEntry = Object.entries(
				taskBoardFilesRegistry,
			).find(([, entry]) => entry.boardId === boardData.id);

			if (existingRegistryEntry) {
				const [, registryEntry] = existingRegistryEntry;
				if (registryEntry.filePath === filePath) {
					// Same boardID and same filePath - no action needed
					console.log(
						`Board "${boardData.name}" with ID "${boardData.id}" already registered at: ${filePath}`,
					);
				} else {
					// Same boardID but different filePath - generate new ID
					const oldId = boardData.id;
					boardData.id = generateRandomTempTaskId();
					console.log(
						`Board ID conflict detected. Changed board ID from "${oldId}" to "${boardData.id}" for file: ${filePath}`,
					);
					await this.addNewBoardToRegistry(
						boardData.id,
						filePath,
						boardData,
					);
				}
			} else {
				// Board ID doesn't exist in registry - add it
				await this.addNewBoardToRegistry(
					boardData.id,
					filePath,
					boardData,
				);
			}

			return boardData;
		} catch (error) {
			console.error(`Error loading board from file ${filePath}:`, error);
			return null;
		}
	}

	/**
	 * @deprecated This function is deprecated. Use loadBoardUsingID instead.
	 * Loads the specific board data from the memory cache (recentBoardsData),
	 * Based on the boardIndex passed. This method relies on board indexing which
	 * is being phased out in favor of ID-based lookup.
	 * @param boardIndex - The index of the board to load
	 * @returns The board configuration object, or null if file cannot be loaded
	 */
	async loadBoardUsingIndex(boardIndex: number): Promise<Board | null> {
		console.warn(
			"loadBoardUsingIndex is deprecated. Use loadBoardUsingID instead.",
		);
		try {
			const boardsArray = Object.values(this.recentBoardsData);

			// Validate board index
			if (boardIndex < 0 || boardIndex > boardsArray.length - 1) {
				console.error(
					`Invalid board index: ${boardIndex}. Available boards: ${boardsArray.length}`,
				);
				return null;
			}

			return boardsArray[boardIndex] || null;
		} catch (error) {
			console.error(`Error loading board at index ${boardIndex}:`, error);
			return null;
		}
	}

	/**
	 * Load board configuration from memory cache using board ID
	 * @param boardId - The ID of the board to load
	 * @returns The board configuration object, or null if board not found in cache
	 */
	async loadBoardUsingID(boardId: string): Promise<Board | null> {
		try {
			if (!boardId || boardId.trim() === "") {
				console.error(`No board ID provided to load the board`);
				return null;
			}

			// Search for board by ID in the cached data
			const cachedBoard = Object.values(this.recentBoardsData).find(
				(board) => board.id === boardId,
			);

			if (cachedBoard) {
				console.log(
					`Found board "${cachedBoard.name}" (ID: ${boardId}) in cache`,
				);
				return cachedBoard;
			}

			console.warn(`Board with ID "${boardId}" not found in cache`);
			return null;
		} catch (error) {
			console.error(`Error loading board with ID ${boardId}:`, error);
			return null;
		}
	}

	/**
	 * First tries to see if the board is already cached in memory,
	 * If not, loads the board from the .taskboard file at the given path,
	 * and caches it in memory
	 * @param filePath - The path to the .taskboard file
	 * @returns The board configuration object, or null if file cannot be loaded
	 */
	async loadBoardUsingPath(filePath: string): Promise<Board | null> {
		try {
			if (!filePath || filePath.trim() === "") {
				console.error(`No board file path provided to load the board`);
				return null;
			}

			// Check if board is already cached in memory by file path
			if (this.recentBoardsData[filePath]) {
				console.log(
					`Board "${this.recentBoardsData[filePath].name}" already exists in cache for file: ${filePath}`,
				);
				return this.recentBoardsData[filePath];
			}

			// Load board from file (disk) since not found in cache
			const boardData = await this.loadBoardFromFile(filePath);

			if (boardData) {
				// Cache the board data in memory using file path as key
				this.recentBoardsData[filePath] = boardData;
				console.log(
					`Loaded and cached board "${boardData.name}" from: ${filePath}`,
				);
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
	 * @returns All boards data as an object keyed by file path or an empty object if failed to load the boards.
	 */
	async loadAllBoards(): Promise<recentBoardsDataType | {}> {
		console.log("loadAllBoards : Starting to load all boards...");
		try {
			const taskBoardFilesRegistry =
				this.plugin.settings.data.taskBoardFilesRegistry || {};
			let loadedBoardsData: recentBoardsDataType = {};

			for (const [, registryEntry] of Object.entries(
				taskBoardFilesRegistry,
			)) {
				if (
					!registryEntry.filePath ||
					registryEntry.filePath.trim() === ""
				) {
					console.error(
						`No board file path configured for registry entry`,
					);
					continue;
				}

				// Load board from file
				const boardData = await this.loadBoardFromFile(
					registryEntry.filePath,
				);

				if (boardData) {
					// Cache the board data in memory using file path as key
					loadedBoardsData[registryEntry.filePath] = boardData;
					console.log(
						`Loaded and cached board "${boardData.name}" from: ${registryEntry.filePath}`,
					);
				} else {
					console.warn(
						`Error loading board data from file: ${registryEntry.filePath}`,
					);
				}
			}

			this.recentBoardsData = loadedBoardsData;
			return loadedBoardsData;
		} catch (error) {
			console.error(`Error loading all boards:`, error);
			return {};
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
				await this.app.vault.createBinary(
					filePath,
					arrayBuffer as ArrayBuffer,
				);
				console.log(`Created new TaskBoard file: ${filePath}`);
			} else {
				// Update existing file with binary data
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (!file || !(file instanceof TFile)) {
					console.error(`Cannot find file to update: ${filePath}`);
					return false;
				}
				await this.app.vault.modifyBinary(
					file,
					arrayBuffer as ArrayBuffer,
				);
				console.log(`Updated TaskBoard file: ${filePath}`);
			}

			return true;
		} catch (error) {
			console.error(`Error saving board to file ${filePath}:`, error);
			return false;
		}
	}

	/**
	 * @deprecated This function is deprecated. Use saveBoard(updatedBoardData) instead.
	 * Save board configuration to disk by board index passed
	 * If no boardIndex has been passed, it will update currentBoard data
	 * Also updates the cached board data in memory
	 * @param updatedBoardData - The updated board configuration object
	 * @param boardIndex - (Optional) The index of the board to save
	 * @returns boolean - True if saved successfully, false otherwise
	 */
	async saveBoardDeprecated(
		updatedBoardData: Board,
		boardIndex?: number,
	): Promise<boolean> {
		console.warn(
			"saveBoardDeprecated is deprecated. Use saveBoard(updatedBoardData) instead.",
		);
		try {
			const taskBoardFilesRegistry =
				this.plugin.settings.data.taskBoardFilesRegistry || {};

			if (!boardIndex && boardIndex !== 0) {
				console.error(`No board index provided`);
				return false;
			}

			const registryEntries = Object.entries(taskBoardFilesRegistry);
			if (boardIndex < 0 || boardIndex >= registryEntries.length) {
				console.error(
					`Invalid board index: ${boardIndex}. Available boards: ${registryEntries.length}`,
				);
				return false;
			}

			const [, registryEntry] = registryEntries[boardIndex];
			if (
				!registryEntry.filePath ||
				registryEntry.filePath.trim() === ""
			) {
				console.error(
					`No board file path configured for index: ${boardIndex}`,
				);
				return false;
			}

			// Save board to file
			const success = await this.saveBoardToFile(
				registryEntry.filePath,
				updatedBoardData,
			);

			if (success) {
				this.recentBoardsData[registryEntry.filePath] =
					updatedBoardData;

				console.log(
					`Saved board "${updatedBoardData.name}" to: ${registryEntry.filePath}`,
				);
			}

			return success;
		} catch (error) {
			console.error(`Error saving board:`, error);
			return false;
		}
	}

	/**
	 * Save board configuration to disk using the board ID from the board data.
	 * The boardID in the updatedBoardData is used to look up the file path from the registry.
	 * Also updates the cached board data in memory.
	 * @param updatedBoardData - The updated board configuration object (must contain valid id)
	 * @returns boolean - True if saved successfully, false otherwise
	 */
	async saveBoard(updatedBoardData: Board): Promise<boolean> {
		try {
			if (!updatedBoardData.id || updatedBoardData.id.trim() === "") {
				console.error(`Board data does not contain a valid ID`);
				return false;
			}

			const taskBoardFilesRegistry =
				this.plugin.settings.data.taskBoardFilesRegistry || {};

			// Find the registry entry using the board ID
			const registryEntry = Object.entries(taskBoardFilesRegistry).find(
				([, entry]) => entry.boardId === updatedBoardData.id,
			)?.[1];

			if (!registryEntry) {
				console.error(
					`No registry entry found for board ID: ${updatedBoardData.id}`,
				);
				return false;
			}

			if (
				!registryEntry.filePath ||
				registryEntry.filePath.trim() === ""
			) {
				console.error(
					`No file path configured for board ID: ${updatedBoardData.id}`,
				);
				return false;
			}

			// Save board to file
			const success = await this.saveBoardToFile(
				registryEntry.filePath,
				updatedBoardData,
			);

			if (success) {
				// Update the cached board data in memory
				this.recentBoardsData[registryEntry.filePath] =
					updatedBoardData;

				console.log(
					`Saved board "${updatedBoardData.name}" (ID: ${updatedBoardData.id}) to: ${registryEntry.filePath}`,
				);
			}

			return success;
		} catch (error) {
			console.error(
				`Error saving board with ID ${updatedBoardData.id}:`,
				error,
			);
			return false;
		}
	}

	/**
	 * Adds a new .taskboard file to the registry in settings
	 * if it does not already exist. Updates the registry as a map keyed by boardId.
	 * @param boardId - The ID of the board
	 * @param filePath - The path to the .taskboard file
	 * @param boardData - (Optional) The board data to cache
	 */
	async addNewBoardToRegistry(
		boardId: string,
		filePath: string,
		boardData?: Board,
	): Promise<void> {
		try {
			const taskBoardFilesRegistry =
				this.plugin.settings.data.taskBoardFilesRegistry || {};

			// Check if board with this ID already exists
			if (taskBoardFilesRegistry[boardId]) {
				console.log(
					`Board ID "${boardId}" already exists in registry at: ${taskBoardFilesRegistry[boardId].filePath}`,
				);
				return;
			}

			// Add or update the registry entry using boardId as key
			taskBoardFilesRegistry[boardId] = {
				boardId: boardId,
				filePath: filePath,
				boardName: boardData?.name || "",
				boardDescription: boardData?.description || "",
			};

			this.plugin.settings.data.taskBoardFilesRegistry =
				taskBoardFilesRegistry;
			await this.plugin.saveSettings();

			// Cache the board data if provided
			if (boardData) {
				this.recentBoardsData[filePath] = boardData;
			}

			console.log(
				`Added new board to registry: ID="${boardId}", filePath="${filePath}"`,
			);
		} catch (error) {
			console.error(`Error adding board to registry:`, error);
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
			this.plugin.settings.data.taskBoardFilesRegistry || {};
		const missingFiles: string[] = [];

		for (const [, entry] of Object.entries(taskBoardFilesRegistry)) {
			const exists = await this.boardFileExists(entry.filePath);
			if (!exists) {
				missingFiles.push(entry.filePath);
				console.warn(
					`Expected board file not found: ${entry.filePath}. It may have been moved or deleted.`,
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
			this.plugin.settings.data.taskBoardFilesRegistry || {};
		let createdCount = 0;

		const registryEntries = Object.entries(taskBoardFilesRegistry);
		for (let i = 0; i < registryEntries.length; i++) {
			const [, registryEntry] = registryEntries[i];
			const exists = await this.boardFileExists(registryEntry.filePath);

			if (!exists && i < defaultBoards.length) {
				const created = await this.createNewBoardFile(
					registryEntry.filePath,
					defaultBoards[i],
				);
				if (created) {
					createdCount++;
					console.log(
						`Created default board file: ${registryEntry.filePath}`,
						defaultBoards[i].name,
					);
					new Notice(
						`Created default board file: ${registryEntry.filePath} : ${defaultBoards[i].name}`,
					);
				}
			}
		}

		return createdCount;
	}

	/**
	 * Returns all the boards data cached in memory
	 * @returns Object of all board configurations keyed by file path
	 */
	async getAllBoards(): Promise<Board[]> {
		const allBoardsData = Object.values(this.recentBoardsData);
		return allBoardsData;
	}

	/**
	 * Returns the board data for a specific board ID
	 * @param boardId - The ID of the board to retrieve
	 * @returns The board configuration object, or null if not found
	 */
	async getBoardData(boardId: string): Promise<Board | null> {
		const board = Object.values(this.recentBoardsData).find(
			(b) => b.id === boardId,
		);
		return board || null;
	}

	/**
	 * @deprecated This method is deprecated. Use getBoardData(boardId) instead.
	 * Returns the board data that was last active/used by user.
	 * @returns The cached board data, or null if no board has been loaded
	 */
	async getCurrentBoardData(): Promise<Board | null> {
		console.warn(
			"getCurrentBoardData is deprecated. Use getBoardData(boardId) instead.",
		);
		const boards = Object.values(this.recentBoardsData);
		return boards.length > 0 ? boards[0] : null;
	}

	/**
	 * @deprecated This method is deprecated. currentBoardIndex is no longer used.
	 * Get the index of the last used board as per the saved files registry
	 * @returns The index of the currently loaded board, or null if no board has been loaded
	 */
	getCurrentBoardIndex(): number | null {
		console.warn(
			"getCurrentBoardIndex is deprecated. Index-based lookup is no longer supported.",
		);
		return null;
	}

	/**
	 * @deprecated This method is deprecated. Use getBoardFilepathFromRegistry instead.
	 * Get the index of a board from the registry based on its boardId
	 * @param boardId - The ID of the board
	 * @returns The index of the board in the registry, or null if not found
	 */
	getBoardIndexFromRegistry(boardId: string): number | null {
		console.warn(
			"getBoardIndexFromRegistry is deprecated. Use getBoardFilepathFromRegistry instead.",
		);
		const taskBoardFilesRegistry =
			this.plugin.settings.data.taskBoardFilesRegistry || {};
		const index = Object.values(taskBoardFilesRegistry).findIndex(
			(entry) => entry.boardId === boardId,
		);
		return index >= 0 ? index : null;
	}

	/**
	 * Get the file path of a board from the registry based on its boardId
	 * @param boardId - The ID of the board
	 * @returns The file path of the board, or null if not found
	 */
	getBoardFilepathFromRegistry(boardId: string): string | null {
		const taskBoardFilesRegistry =
			this.plugin.settings.data.taskBoardFilesRegistry || {};
		const entry = Object.values(taskBoardFilesRegistry).find(
			(e) => e.boardId === boardId,
		);
		return entry ? entry.filePath : null;
	}

	/**
	 * Clear the cached board data
	 * Useful when switching between different boards or clearing state
	 */
	clearCurrentBoardCache(): void {
		this.recentBoardsData = {};
		console.log("Cleared cached board data");
	}
}
