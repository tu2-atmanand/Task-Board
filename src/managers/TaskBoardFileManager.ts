/**
 * @name TaskBoardFileManager.ts
 * @path /src/managers/TaskBoardFileManager.ts
 * Manages loading and saving individual board configurations from/to .taskboard files
 * This replaces the previous approach of storing all board data in data.json
 */

import { App, TFile, Notice, normalizePath } from "obsidian";
import { Board, DEFAULT_BOARD } from "src/interfaces/BoardConfigs";
import type TaskBoard from "main";
import { generateRandomTempTaskId } from "src/utils/TaskItemUtils";
import { LEAFID_FILEPATH_MAPPING_KEY } from "src/interfaces/Constants";
import { bugReporterManagerInsatance } from "./BugReporter";
import { taskBoardFilesRegistryType } from "src/interfaces/GlobalSettings";

/**
 * Interface for storing recently loaded board data keyed by file path
 */
interface recentBoardsDataType {
	[filePath: string]: Board;
}

interface leafIdFilePathMapType {
	[leafID: string]: string;
}

export default class TaskBoardFileManager {
	private app: App;
	private plugin: TaskBoard;
	private recentBoardsData: recentBoardsDataType = {}; // This will hold the board-files data which user opened in the current Obsidian session. So, opening them again becomes faster.
	private leafIdFilePathMapping: leafIdFilePathMapType = {}; // This will hold the mapping of all the older leafs(Obsidian tabs) and which board-file they are rendering, opened in the past.
	private debouncedSaveBoardTimers: Map<string, NodeJS.Timeout> = new Map(); // Track debounce timers per board
	private currentPluginVersion: string;

	constructor(plugin: TaskBoard) {
		this.plugin = plugin;
		this.app = plugin.app;
		this.currentPluginVersion = plugin.settings.version;

		const mappingData: leafIdFilePathMapType = JSON.parse(
			this.app.loadLocalStorage(LEAFID_FILEPATH_MAPPING_KEY),
		);
		this.leafIdFilePathMapping = mappingData;
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
	async loadBoardFromDisk(filePath: string): Promise<Board | null> {
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
				}
			}

			boardData = this.applyMigrationIfNeeded(boardData);

			return boardData;
		} catch (error) {
			console.error(`Error loading board from file ${filePath}:`, error);
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
	async loadBoardUsingPath(filePath: string): Promise<Board | undefined> {
		try {
			if (!filePath || filePath.trim() === "") {
				console.error(`No board file path provided to load the board`);
				return undefined;
			}

			// Check if board is already cached in memory by file path
			if (this.recentBoardsData[filePath]) {
				console.log(
					`Board "${this.recentBoardsData[filePath].name}" already exists in cache for file: ${filePath}`,
				);
				return this.recentBoardsData[filePath];
			}

			// Load board from file (disk) since not found in cache
			const boardData = await this.loadBoardFromDisk(filePath);

			if (boardData) {
				// Cache the board data in memory using file path as key
				this.recentBoardsData[filePath] = boardData;
				// Update the registry to move this board on top
				this.addNewBoardToRegistry(boardData.id, filePath, boardData);
				console.log(
					`Loaded and cached board "${boardData.name}" from: ${filePath}`,
				);
				return boardData;
			} else {
				new Notice(
					`Task Board : Error loading board data from file : ${filePath}`,
				);
			}

			return undefined;
		} catch (error) {
			console.error(`Error loading board from file ${filePath}:`, error);
			return undefined;
		}
	}

	/**
	 * Save board configuration to a .taskboard file
	 * @param filePath - The path to the .taskboard file
	 * @param boardData - The board configuration object to save
	 * @returns boolean - True if saved successfully, false otherwise
	 */
	async saveBoardToDisk(
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
	 * Save board configuration to disk using the filePath passed.
	 * If no filePath is passed, will try to get the filePath by matching the board.id
	 * from the fileRegistry.
	 * @param updatedBoardData - The updated board configuration object (must contain valid id)
	 * @param filePath (OPTIONAL) - The filepath of the .taskboard file.
	 * @returns boolean - True if saved successfully, false otherwise
	 */
	async saveBoard(
		updatedBoardData: Board,
		filePath?: string,
	): Promise<boolean> {
		try {
			if (!updatedBoardData.id || updatedBoardData.id.trim() === "") {
				console.error(`Board data does not contain a valid ID`);
				return false;
			}

			let filepathLocal: string;

			if (filePath) {
				filepathLocal = filePath;
			} else {
				const taskBoardFilesRegistry =
					this.plugin.settings.data.taskBoardFilesRegistry || {};

				// Find the registry entry using the board ID
				const registryEntry = Object.entries(
					taskBoardFilesRegistry,
				).find(
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

				filepathLocal = registryEntry.filePath;
			}

			// Save board to file
			const success = await this.saveBoardToDisk(
				filepathLocal,
				updatedBoardData,
			);

			if (success) {
				// Update the cached board data in memory
				this.recentBoardsData[filepathLocal] = updatedBoardData;

				console.log(
					`Saved board "${updatedBoardData.name}" (ID: ${updatedBoardData.id}) to: ${filepathLocal}`,
				);

				/**
				 * @todo - Probably I shouldnt call this from saveBoard as its called too many times.
				 */
				// this.addNewBoardToRegistry(
				// 	updatedBoardData.id,
				// 	filepathLocal,
				// 	updatedBoardData,
				// );
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
	 * Debounced version of saveBoard that prevents rapid successive saves.
	 * Each board ID has its own debounce timer. If called multiple times within the debounce window,
	 * only the most recent save operation will execute.
	 * @param updatedBoardData - The updated board configuration object (must contain valid id)
	 * @param filePath - (Optional) The file path to save to
	 * @param delayMs - (Optional) Debounce delay in milliseconds, default 1000ms
	 */
	debouncedSaveBoard(
		updatedBoardData: Board,
		filePath?: string,
		delayMs: number = 1000,
	): void {
		const boardId = updatedBoardData.id;

		if (!boardId || boardId.trim() === "") {
			console.error(
				`Cannot debounce save: Board data does not contain a valid ID`,
			);
			return;
		}

		// Clear any existing timer for this board
		const existingTimer = this.debouncedSaveBoardTimers.get(boardId);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		// Set a new timer to save after the debounce delay
		const newTimer = setTimeout(async () => {
			try {
				await this.saveBoard(updatedBoardData, filePath);
				this.debouncedSaveBoardTimers.delete(boardId);
			} catch (error) {
				console.error(
					`Error in debounced save for board ID ${boardId}:`,
					error,
				);
				this.debouncedSaveBoardTimers.delete(boardId);
			}
		}, delayMs);

		// Store the timer for potential cancellation
		this.debouncedSaveBoardTimers.set(boardId, newTimer);
	}

	/**
	 * Clear all pending debounced saves. Useful for cleanup on plugin unload.
	 */
	clearAllDebouncedSaves(): void {
		this.debouncedSaveBoardTimers.forEach((timer) => {
			clearTimeout(timer);
		});
		this.debouncedSaveBoardTimers.clear();
	}

	/**
	 * Force save immediately, canceling any pending debounced save for this board.
	 * @param updatedBoardData - The board configuration to save immediately
	 * @param filePath - (Optional) The file path to save to
	 * @returns Promise resolving to true if saved successfully
	 */
	async forceSaveBoard(
		updatedBoardData: Board,
		filePath?: string,
	): Promise<boolean> {
		const boardId = updatedBoardData.id;

		// Cancel any pending debounced save for this board
		const existingTimer = this.debouncedSaveBoardTimers.get(boardId);
		if (existingTimer) {
			clearTimeout(existingTimer);
			this.debouncedSaveBoardTimers.delete(boardId);
		}

		// Save immediately
		return await this.saveBoard(updatedBoardData, filePath);
	}

	/**
	 * Add a new task board file (.taskboard) inside the files registry maintained in
	 * the plugin's global setting which stores a mapping of boardID <-> and some board
	 * properties for quick reference.
	 *
	 * If boardData is passed, the board name and the description will be also saved inside
	 * registry data. Also, the data will be updated in the this.recentBoardsData memory.
	 *
	 * @param boardId - The board id of the board to add inside the registry.
	 * @param filePath - The file path of the board file.
	 * @param boardData (OPTIONAL) - The board data of the board file.
	 */
	async addNewBoardToRegistry(
		boardId: string,
		filePath: string,
		boardData?: Board,
	): Promise<void> {
		try {
			let updatedTaskBoardFilesRegistry =
				this.plugin.settings.data.taskBoardFilesRegistry || {};

			// Clean up old numeric index entries (migrate from old format to boardId-based format)
			// Filter out entries where the key is a numeric string (e.g., "0", "1", "2")
			// const cleanedRegistry: typeof updatedTaskBoardFilesRegistry = {};
			// for (const [key, value] of Object.entries(
			// 	updatedTaskBoardFilesRegistry,
			// )) {
			// 	// Skip numeric string keys (old format)
			// 	if (isNaN(Number(key))) {
			// 		cleanedRegistry[key] = value;
			// 	} else {
			// 		console.log(
			// 			`Cleaning up old numeric index entry: key="${key}", boardId="${value.boardId}"`,
			// 		);
			// 	}
			// }

			// updatedTaskBoardFilesRegistry = cleanedRegistry;

			// Check if board with this ID already exists
			if (updatedTaskBoardFilesRegistry[boardId]) {
				// Delete the older entry incase user wants to update some configuration and to move the last viewed board on top.
				delete updatedTaskBoardFilesRegistry[boardId];
			}

			// Add or update the registry entry using boardId as key
			const newEntry = {
				boardId: boardId,
				filePath: filePath,
				boardName: boardData?.name || "",
				boardDescription: boardData?.description || "",
			};

			this.plugin.settings.data.taskBoardFilesRegistry = {
				[boardId]: newEntry,
				...updatedTaskBoardFilesRegistry,
			};
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
	 * Check if a .taskboard file exists for the given .taskboard file path.
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
	 * @returns boolean - True if the file is created successfully. False if the file already
	 * exists or there was some error while creating the board file.
	 */
	async createNewBoardFile(
		filePath: string,
		boardData: Board,
	): Promise<boolean> {
		try {
			// Check if file already exists
			const exists = await this.boardFileExists(filePath);
			if (exists) {
				new Notice(
					`Task Board : The board file already exists at the path : ${normalizePath(filePath)}`,
				);
				return false;
			}

			const normalizedFilePath = normalizePath(filePath);

			const parts = normalizedFilePath.split("/");
			parts.pop();
			const folderPath = parts.join("/");
			if (!(await this.plugin.app.vault.adapter.exists(folderPath))) {
				await this.plugin.app.vault.createFolder(folderPath);
			}

			this.addNewBoardToRegistry(boardData.id, filePath, boardData);

			return await this.saveBoardToDisk(filePath, boardData);
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
	 * Get all .taskboard files from the vault and creates a list of their paths.
	 *
	 * @returns Array of .taskboard file paths
	 */
	getAllTaskboardFilePaths(): string[] {
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
	 * Scans all .taskboard files in the vault, loads their data, and adds them to the registry and cache.
	 * This can be called by the user through the 'Vault scanner'.
	 * @returns Array of file paths that were scanned and loaded successfully
	 */
	async scanAllTaskBoardFiles(): Promise<string[]> {
		const allFilePaths = this.getAllTaskboardFilePaths();

		if (allFilePaths.length < 1) return [];

		for (const filepath of allFilePaths) {
			const boardData = await this.loadBoardFromDisk(filepath);

			if (boardData) {
				// Add board to registry and cache it in memory
				await this.addNewBoardToRegistry(
					boardData.id,
					filepath,
					boardData,
				);
			}
		}

		return allFilePaths;
	}

	/**
	 * Returns all the boards data cached in memory as a list of boards.
	 * The order doesnt mean anything.
	 * @returns Object of all board configurations as a list (Board[]).
	 */
	async getAllBoards(): Promise<Board[]> {
		const allBoardsData = Object.values(this.recentBoardsData);
		return allBoardsData;
	}

	/**
	 * Fetches the first entry from the taskBoardFilesRegistry.
	 * Attempts to first get the board data if present in the cache.
	 * Otherwise, load the board from disk.
	 *
	 * @returns The last opened board data. undefined if there is any error.
	 */
	async getLastOpenedBoard(): Promise<Board | undefined> {
		const taskBoardFilesRegistry =
			this.plugin.settings.data.taskBoardFilesRegistry || {};

		// Get the first entry from the registry (regardless of key name)
		// Filter out old numeric index entries and get the first valid boardId entry
		// const registryEntries = Object.entries(taskBoardFilesRegistry)
		// 	.filter(([key]) => isNaN(Number(key))) // Filter out numeric string keys
		// 	.slice(0, 1); // Get the first entry

		// if (registryEntries.length === 0) {
		// 	console.error(`No board entries found in the registry.`);
		// 	return undefined;
		// }

		const firstItemFromRegistry = Object.values(taskBoardFilesRegistry)[0];

		if (!firstItemFromRegistry?.filePath) {
			console.error(
				`First registry entry does not have a valid filePath.`,
			);
			return undefined;
		}

		let boardData: Board | undefined;

		if (this.recentBoardsData[firstItemFromRegistry.filePath]) {
			boardData = this.recentBoardsData[firstItemFromRegistry.filePath];
		}

		if (!boardData) {
			boardData = await this.loadBoardUsingPath(
				firstItemFromRegistry.filePath,
			);
		}

		if (boardData) {
			return boardData;
		}

		console.error(`Error loading the last opened board.`);
		return undefined;
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
		// const index = Object.values(taskBoardFilesRegistry).findIndex(
		// 	(entry) => entry.boardId === boardId,
		// );

		const allBoardIDs = Object.keys(taskBoardFilesRegistry);
		const index = allBoardIDs.indexOf(boardId);
		return index >= 0 ? index : null;
	}

	/**
	 * Clear the cached board data
	 * Useful when switching between different boards or clearing state
	 */
	clearCurrentBoardCache(): void {
		this.recentBoardsData = {};
		console.log("Cleared cached board data");
	}

	// --------------------------------------------------------------------
	// BELOW ARE ALL THE MIGRATION FUNCTIONS
	// --------------------------------------------------------------------

	/**
	 * Migration for the following new properties :
	 * - boardData.viewPanel
	 *
	 * @Date - 2026-04-01
	 */
	runMigrationForVersion_2_0_0(oldBoardData: Board): Board {
		let newBoardData = { ...oldBoardData };
		if (!oldBoardData?.viewsPanel) {
			newBoardData["viewsPanel"] = DEFAULT_BOARD.viewsPanel;
		}

		return newBoardData;
	}

	/**
	 * This function will be used to run a migration check whenever any board is loaded.
	 * Based on the pluginVersion property in the board data, we can decide if we need to
	 * run any migration steps to update the board data structure to be compatible with the
	 * current plugin version.
	 * This is important to ensure that users can still load their existing boards even
	 * after we release updates that may change the board data structure.
	 *
	 * First will check if the boardData.pluginVersion is different from the currentPluginVersion.
	 * If they are different, it means the board data was last saved with an older version of the
	 * plugin, and we may need to run migrations.
	 * Then based on the pluginVersion in the board data, we can determine which migration steps
	 * to run to update the board data structure to be compatible with the current plugin version.
	 * After running the necessary migrations, we should also update the pluginVersion in the board
	 * data to the currentPluginVersion, so that we don't run the same migrations again in the future.
	 * Finally, we save the migrated board data back to disk and return the updated board data object.
	 *
	 * @param boardData - The old board data to check if it needs migrations
	 *
	 * @returns - The migrated board data that is compatible with the current plugin version. If no migration was needed, it returns the original board data.
	 */
	applyMigrationIfNeeded(boardData: Board): Board {
		try {
			if (boardData.pluginVersion === this.currentPluginVersion) {
				//Board data plugin version matches current plugin version. No migration needed.
				return boardData;
			} else {
				// There are two situations :
				// 1. boardData.pluginVersion === "";
				// 2. boardData.pluginVersion !== this.currentPluginVersion;
				// In both these cases, will apply all the migrations.
				// Here we can run all the migrations sequentially since we don't know which version it was last saved with.
				// Will add a date to the version specific migration function to remember when that migration was introduced.
				// If the date has crossed 6 months, will remove that migration, since its very old now.

				boardData = this.runMigrationForVersion_2_0_0(boardData);
			}

			// After applying necessary migrations, update the pluginVersion in the board data
			boardData.pluginVersion = this.currentPluginVersion;

			this.saveBoard(boardData);

			return boardData;
		} catch (error) {
			console.error(`Error applying migration to board data:`, error);
			return boardData; // Return original data if migration fails to prevent data loss
		}
	}

	// --------------------------------------------------------------------
	// BELOW ARE SOME ONE TIME USE FUNCTIONS USED DURING PLUGIN INSTALLATION
	// --------------------------------------------------------------------

	/**
	 * Validate that all board files path present in the global setting registry are also present on the disk.
	 * Clear the entries whose files are no longer present on the disk.
	 * This function basically keeps the registry valid, so we dont face issues during runtime.
	 * This function should run during plugin load time, that is when Obsidian opens.
	 *
	 * @returns void once the function has finished with its operations.
	 */
	async validateBoardFiles(): Promise<void> {
		let taskBoardFilesRegistry: taskBoardFilesRegistryType =
			this.plugin.settings.data.taskBoardFilesRegistry || {};

		// Iterate through registry entries and check file existence
		for (const [boardId, entry] of Object.entries(taskBoardFilesRegistry)) {
			try {
				const exists = await this.boardFileExists(entry.filePath);

				if (!exists) {
					// Remove the orphaned entry from the registry
					delete taskBoardFilesRegistry[boardId];
				}
			} catch (error) {
				// Handle potential errors during file check (permissions, invalid path, etc.)
				console.error(error);
			}
		}

		// Update settings with cleaned registry
		this.plugin.settings.data.taskBoardFilesRegistry =
			taskBoardFilesRegistry;
		await this.plugin.saveSettings(this.plugin.settings);
	}

	// --------------------------------------------------------------------
	// DEPRECATED FUNCTIONS
	// --------------------------------------------------------------------

	/**
	 * @deprecated This function is deprecated. Use loadBoardUsingID instead.
	 *
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
	 * @deprecated This function is deprecated. Use saveBoard(updatedBoardData) instead.
	 *
	 * Save board configuration to disk by board index passed
	 * If no boardIndex has been passed, it will update currentBoard data
	 * Also updates the cached board data in memory
	 * @param updatedBoardData - The updated board configuration object
	 * @param boardIndex - (Optional) The index of the board to save
	 * @returns boolean - True if saved successfully, false otherwise
	 */
	async saveBoardUsingIndex(
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
			const success = await this.saveBoardToDisk(
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
	 * @deprecated This method is deprecated. Use getBoardData(boardId) instead. We should no longer manage boards based on their boardIndex.
	 *
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
	 * @deprecated This method is deprecated. currentBoardIndex is no longer used. We should no longer manage boards based on their boardIndex.
	 *
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
	 * @deprecated - Found a better approach provide by Obsidian APIs itself for set and get viewState.
	 * Dont use this functions, as I am not storing the mapping inside localStorage, hence these funcs
	 * will not work.
	 *
	 * Store the mapping between a leaf ID and file path in localStorage
	 * This allows us to restore the correct board when a leaf tab is reopened
	 * @param leafID - The ID of the Obsidian leaf (tab)
	 * @param filePath - The path to the .taskboard file
	 */
	async setFilepathToLeafID(leafID: string, filePath: string): Promise<void> {
		try {
			if (!leafID) {
				console.error(
					"Cannot set filepath to leaf ID: leafID is empty",
				);
				return;
			}

			if (!filePath || filePath.trim() === "") {
				console.error(
					"Cannot set filepath to leaf ID: filePath is empty",
				);
				return;
			}
			let oldMappingData: leafIdFilePathMapType =
				this.leafIdFilePathMapping;
			// if (oldMappingData[leafID]) delete oldMappingData[leafID];

			oldMappingData = {
				[leafID]: filePath,
				...oldMappingData,
			};

			// const key = `taskboard-leaf-${leafID}`;
			this.app.saveLocalStorage(
				LEAFID_FILEPATH_MAPPING_KEY,
				JSON.stringify(oldMappingData),
			);
			console.log(
				`Stored filepath mapping: leaf ${leafID} -> ${filePath}`,
			);
		} catch (error) {
			console.error(
				`Error storing filepath mapping for leaf ${leafID}:`,
				error,
			);
		}
	}

	/**
	 * @deprecated - Found a better approach provide by Obsidian APIs itself for set and get viewState.
	 * Dont use this functions, as I am not storing the mapping inside localStorage, hence these funcs
	 * will not work.
	 *
	 * Retrieve the file path associated with a leaf ID from localStorage
	 * @param leafID - The ID of the Obsidian leaf (tab)
	 * @returns
	 * string - The stored file path if found for the particular leafID
	 *
	 * undefined - If there was some error encountered
	 */
	async getFilepathFromLeafID(leafID: string): Promise<string | undefined> {
		try {
			if (!leafID) {
				console.error(
					"Cannot get filepath from leaf ID: leafID is empty",
				);
				return undefined;
			}

			console.log("Mapping data : ", this.leafIdFilePathMapping);
			const leafFilepath = this.leafIdFilePathMapping[leafID];
			if (leafFilepath) {
				console.log(
					`Retrieved filepath mapping: leaf ${leafID} -> ${leafFilepath}`,
				);
				return leafFilepath;
			} else {
				console.warn(`No filepath mapping found for leaf ${leafID}`);
				return undefined;
			}
		} catch (error) {
			console.error(
				`Error retrieving filepath mapping for leaf ${leafID}:`,
				error,
			);
			return undefined;
		}
	}

	/**
	 * @deprecated - We will going to create only a single template board file using the {@link createNewBoardFile} function.
	 * Hence no need of this function anymore.
	 *
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
	 * @deprecated - This is a very bad design to load all the boards.
	 * A new approach has been adopted to have multiple views, instead of loading
	 * all the boards. Refer this {@link https://github.com/tu2-atmanand/Task-Board/issues/723}
	 *
	 * Loads all the boards data from disk,
	 * as per the file paths stored in the task board file path registry saved in the global settings.
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
				const boardData = await this.loadBoardFromDisk(
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
}
