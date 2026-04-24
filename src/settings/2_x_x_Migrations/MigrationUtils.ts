import { t } from "i18next";
import { App, Notice, normalizePath } from "obsidian";
import TaskBoard from "../../../main.js";
import { Board, DEFAULT_BOARD, MapView } from "../../interfaces/BoardConfigs.js";
import { newReleaseVersion, NODE_POSITIONS_STORAGE_KEY } from "../../interfaces/Constants.js";
import { viewTypeNames } from "../../interfaces/Enums.js";
import { DEFAULT_SETTINGS } from "../../interfaces/GlobalSettings.js";
import { bugReporterManagerInsatance } from "../../managers/BugReporter.js";
import { createFolderRecursively } from "../../services/FileSystem.js";
import { getCurrentLocalDateTimeString } from "../../utils/DateTimeCalculations.js";
import { generateRandomTempTaskId } from "../../utils/TaskItemUtils.js";
import { migrateSettings } from "../SettingSynchronizer.js";
import { PluginDataJsonLegacy, BoardLegacy } from "./LegacyInterfacesAndTypings.js";

export interface MigrationStepResult {
	stepName: string;
	status: "success" | "error" | "warning";
	message: string;
	details?: string;
}

export interface MigrationResult {
	success: boolean;
	backupPath?: string;
	migratedBoards: Array<{
		boardName: string;
		boardIndex: number;
		filePath: string;
		status: "success" | "error";
		message: string;
	}>;
	errors: string[];
	totalSteps: number;
	completedSteps: number;
	logs?: Array<{
		timestamp: string;
		status: "info" | "success" | "error" | "warning";
		message: string;
		boardName?: string;
	}>;
	logFilePath?: string;
}

export async function readDataFile(
	app: App,
): Promise<PluginDataJsonLegacy | undefined> {
	let path = `${app.vault.configDir}/plugins/task-board/data.json`;
	const normalizedPath = normalizePath(path);

	const fileExists = await app.vault.adapter.exists(normalizedPath);
	if (!fileExists) {
		return;
	}

	const dataContent = await app.vault.adapter.read(normalizedPath);
	const data: PluginDataJsonLegacy = JSON.parse(dataContent);
	return data;
}

/**
 * Get status icon for log file formatting
 */
function getStatusIconForLog(status: string): string {
	switch (status) {
		case "success":
			return "[✓]";
		case "error":
			return "[✗]";
		case "warning":
			return "[⚠]";
		default:
			return "[•]";
	}
}

/**
 * Save migration logs to a file in the plugin config folder
 */
export async function saveMigrationLogsToFile(
	app: App,
	logs: Array<{
		timestamp: string;
		status: "info" | "success" | "error" | "warning";
		message: string;
		boardName?: string;
	}>,
	errors: string[],
): Promise<{ success: boolean; filePath?: string; error?: string }> {
	try {
		const timestamp = getCurrentLocalDateTimeString().replace(
			/[:\s]/g,
			"_",
		);
		const logFilename = `migration-log-${timestamp}.log`;
		const logPath = normalizePath(
			`${app.vault.configDir}/plugins/task-board/${logFilename}`,
		);

		// Format logs as readable text
		const logContent = [
			`=== Task Board Migration Log ===`,
			`Generated: ${new Date().toLocaleString()}`,
			``,
			...logs.map((log) => {
				const icon = getStatusIconForLog(log.status);
				const boardInfo = log.boardName ? ` [${log.boardName}]` : "";
				return `[${log.timestamp}] ${icon} ${log.message}${boardInfo}`;
			}),
			``,
			`=== End of Log ===`,
			`\n`,
			`\n`,
			`\n`,
			`=== ERRORS ===`,
			...errors.join("\n"),
			`=== End of ERRORS`,
		].join("\n");

		await app.vault.adapter.write(logPath, logContent);

		return { success: true, filePath: logPath };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		console.error("Error saving migration logs:", errorMsg);
		return { success: false, error: errorMsg };
	}
}

/**
 * Check if v1 data exists and return legacy board configs if found
 */
export async function checkForV1Data(
	oldPluginSettings: PluginDataJsonLegacy,
): Promise<{
	hasV1Data: boolean;
	version?: string;
	legacyBoards?: BoardLegacy[];
}> {
	try {
		// Try to load the legacy data.json file from the plugin directory
		const data = oldPluginSettings;

		// Check if version exists and starts with "1."
		if (!data.version || !data.version.toString().startsWith("1.")) {
			return { hasV1Data: false, version: data.version };
		}

		// Extract legacy boards from data
		const legacyBoards = data.data.boardConfigs || [];
		return {
			hasV1Data: true,
			version: data.version,
			legacyBoards,
		};
	} catch (error) {
		console.error("Error checking for v1 data:", error);
		return { hasV1Data: false };
	}
}

// Function to open the MigrationModal
export const openMigrationModal = (
	plugin: TaskBoard,
	onMigrationComplete?: (result: any) => void,
) => {
	// Dynamic import to avoid circular dependencies
	import("./MigrationModal.js").then(
		({ MigrationModal }) => {
			new MigrationModal(plugin, onMigrationComplete).open();
		},
	);
};

/**
 * Check if v1 data exists and show a notification with migration option
 */
export async function checkAndNotifyV2Migration(
	plugin: TaskBoard,
): Promise<boolean> {
	try {
		const oldPluginSettings = await readDataFile(plugin.app);
		if (oldPluginSettings) {
			const v1Check = await checkForV1Data(oldPluginSettings);

			if (v1Check.hasV1Data) {
				const migrationNotice = new Notice(
					createFragment((f) => {
						f.createDiv("bugReportNotice", (el) => {
							el.createEl("h4", {
								text: `⚠ Task Board migration required`,
							});
							el.createEl("p", {
								text: `Task Board has been updated from version ${v1Check.version} (v1.x.x series) to version ${newReleaseVersion} (v2.x.x series). You are required to run the migrations for this new version to work.`,
							});
							el.createEl("button", {
								text: t("open-migration-modal"),
								cls: "reportBugButton",
								onclick: () => {
									openMigrationModal(plugin);
									el.hide();
								},
							});
						});
					}),
					0,
				);

				migrationNotice.messageEl.onClickEvent((e) => {
					if (!(e.target instanceof HTMLButtonElement)) {
						e.stopPropagation();
						e.preventDefault();
						e.stopImmediatePropagation();
					}
				});
				return true;
			}
			return false;
		} else {
			bugReporterManagerInsatance.addToLogs(
				188,
				"There was an issue while reading the current plugin configurations. If this is a fresh install ignore this log message. But, if this message is appearing after updating this plugin. Kindly take a backup of your current configuration, using the 'Export' setting button under the General tab. Then you can uninstall the plugin and re-install the previous version of Task Board and import the exported configurations. Please refer the following documentation : https://tu2-atmanand.github.io/task-board-docs/docs/Migrating_To_2.x.x/#how-to-revert-back-to-the-previous-version",
				"main.ts/checkAndNotifyV2Migration",
			);
			return false;
		}
	} catch (error) {
		console.error("Error checking for v1 migration:", error);
		return false;
	}
}

// ---------------------------------------------------
// UTILS FOR PROCESSING THE MIGRATIONS
// ---------------------------------------------------

/**
 * Create a backup of the current data.json file in the vault root
 */
export async function createBackupConfigFile(
	plugin: TaskBoard,
	oldPluginSettings: PluginDataJsonLegacy,
	onProgress?: (message: string) => void,
): Promise<{ success: boolean; backupPath?: string; error?: string }> {
	try {
		onProgress?.("Creating backup of current configuration...");

		const dataContent = oldPluginSettings;

		const timestamp = getCurrentLocalDateTimeString().replace(
			/[:\s]/g,
			"_",
		);
		const backupFilename = `taskboard-configs-export-${timestamp}.json`;
		const backupPath = normalizePath(backupFilename);

		await plugin.app.vault.adapter.write(
			backupPath,
			JSON.stringify(dataContent),
		);

		await sleep(500);
		onProgress?.(
			`✓ Backup created at the root of the vault with the following name: ${backupFilename}`,
		);

		return { success: true, backupPath };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		onProgress?.(`✗ Failed to create backup: ${errorMsg}`);
		return { success: false, error: errorMsg };
	}
}

/**
 * Create board files from legacy board configs
 */
export async function createBoardFiles(
	plugin: TaskBoard,
	legacyBoards: BoardLegacy[],
	onProgress: (
		message: string,
		boardName?: string,
		status?: "success" | "error",
	) => void,
): Promise<
	Array<{
		boardName: string;
		boardIndex: number;
		filePath: string;
		status: "success" | "error";
		message: string;
	}>
> {
	const results: Array<{
		boardName: string;
		boardIndex: number;
		filePath: string;
		status: "success" | "error";
		message: string;
	}> = [];

	onProgress(
		`The Task Board's board files (.taskboard) will be created at the following path: Meta/Task_Board/Boards/`,
		"All",
		"success",
	);

	try {
		// Ensure the boards directory exists
		const boardsDir = normalizePath("Meta/Task_Board/Boards/");
		const dirExists = await plugin.app.vault.adapter.exists(boardsDir);

		if (!dirExists) {
			try {
				const result = await createFolderRecursively(plugin, boardsDir);
				if (result) onProgress?.(`✓ Created directory: ${boardsDir}`);
				else
					throw "There was an error while creating the default directory for storing the board files.";
			} catch (folderError) {
				const errorMsg =
					folderError instanceof Error
						? folderError.message
						: String(folderError);
				onProgress?.(`✗ Failed to create directory: ${errorMsg}`);
				return results;
			}
		}

		onProgress(`Processing ${legacyBoards.length} boards...`);
		let boardIndex = -1;

		for (const board of legacyBoards) {
			boardIndex = boardIndex + 1;
			try {
				const boardFileName = `${board.name}.taskboard`;
				const boardFilePath = normalizePath(
					`Meta/Task_Board/Boards/${boardFileName}`,
				);

				// Create the board file content (v2 format)
				const boardContent: Board = {
					id: generateRandomTempTaskId(),
					pluginVersion: newReleaseVersion,
					viewsPanel: DEFAULT_BOARD.viewsPanel,
					name: board.name,
					description: board.description || "",
					filterConfig: board.filterConfig,
					views: [
						{
							viewId: generateRandomTempTaskId(),
							viewName: "Kanban View",
							viewType: viewTypeNames.kanban,
							showFilteredTags: board.showFilteredTags,
							viewFilter: board.boardFilter,
							taskCount: {
								pending: 0,
								completed: 0,
							},
							kanbanView: {
								columns: board.columns,
								hideEmptyColumns: board.hideEmptyColumns,
								showColumnTags: board.showColumnTags,
								swimlanes: board.swimlanes,
							},
						},
					],
					lastViewId: "",
				};

				const lastViewId = boardContent.views[0]?.viewId ?? "";
				boardContent.lastViewId = lastViewId;

				const saveBoardResult =
					await plugin.taskBoardFileManager.saveBoardToDisk(
						boardFilePath,
						boardContent,
					);
				await sleep(500);

				if (saveBoardResult) {
					onProgress(
						`✓ Created: ${board.name}`,
						board.name,
						"success",
					);
					results.push({
						boardName: board.name,
						boardIndex: boardIndex,
						filePath: boardFilePath,
						status: "success",
						message: `Board file created successfully`,
					});
				} else {
					throw `Failed to create the board.`;
				}
			} catch (boardError) {
				const errorMsg =
					boardError instanceof Error
						? boardError.message
						: String(boardError);
				onProgress(
					`✗ Failed to create ${board.name}: ${errorMsg}`,
					board.name,
					"error",
				);
				results.push({
					boardName: board.name,
					boardIndex: boardIndex,
					filePath: "",
					status: "error",
					message: `Failed to create board file: ${errorMsg}`,
				});
			}
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		onProgress(
			`✗ Unexpected error during boards creation process: ${errorMsg}\nNo boards were created.`,
		);
	}

	return results;
}

/**
 * Migrate map view data from localStorage to board files
 */
export async function migrateMapViewData(
	plugin: TaskBoard,
	boardResults: Array<{
		boardName: string;
		boardIndex: number;
		filePath: string;
	}>,
	onProgress?: (message: string, boardName?: string) => void,
): Promise<void> {
	try {
		onProgress?.("Migrating map view data...");
		await sleep(500);

		// Query localStorage for map view data using board name as key
		// Note: localStorage in Obsidian is scoped per workspace
		let mapViewData;
		const mapViewPostionsDataStr = localStorage.getItem(
			NODE_POSITIONS_STORAGE_KEY,
		);
		if (mapViewPostionsDataStr) {
			mapViewData = JSON.parse(mapViewPostionsDataStr);
		} else {
			onProgress?.(
				`⚠ No map view data found in the LocalStorge. Safely moving for the next operation.`,
				"All Boards",
			);
			await sleep(500);
		}

		for (const board of boardResults) {
			try {
				// Try to read existing board file
				const fileExists = await plugin.app.vault.adapter.exists(
					board.filePath,
				);
				if (!fileExists) {
					onProgress?.(
						`⚠ Board file does note exists for the following board: ${board.boardName}. Safely moving for the next board.`,
						board.boardName,
					);
					await sleep(500);
					continue;
				}

				const boardData =
					await plugin.taskBoardFileManager.loadBoardFromDisk(
						board.filePath,
					);
				if (!boardData) {
					onProgress?.(
						`⚠ Error while reading the following board file: ${board.filePath}. Safely moving for the next board.`,
						board.boardName,
					);
					await sleep(500);
					continue;
				}
				const boardIndexKey = String(board.boardIndex);

				if (
					mapViewData &&
					typeof mapViewData === "object" &&
					!Array.isArray(mapViewData) &&
					boardIndexKey in mapViewData &&
					typeof mapViewData[boardIndexKey] === "object" &&
					mapViewData[boardIndexKey] !== null &&
					!Array.isArray(mapViewData[boardIndexKey])
				) {
					if (boardData && !boardData?.views) {
						boardData.views = [];
					}

					let newMapViewData: MapView = {
						viewPortData: {
							x: 0,
							y: 0,
							zoom: 0.5,
						},
						nodesData: mapViewData[boardIndexKey], // ✅ Safely accessed now
					};

					const mapViewExists = boardData.views.some(
						(v: any) => v.type === "map",
					);
					if (!mapViewExists) {
						boardData.views.push({
							viewId: generateRandomTempTaskId(),
							viewName: "Map View",
							viewType: viewTypeNames.map,
							mapView: newMapViewData,
							showFilteredTags: true,
							viewFilter: boardData.views[0]?.viewFilter ?? {
								rootCondition: "none",
								filterGroups: [],
							},
							taskCount: {
								pending: 0,
								completed: 0,
							},
						});
					}

					const saveBoardResult =
						await plugin.taskBoardFileManager.saveBoardToDisk(
							board.filePath,
							boardData,
						);

					if (saveBoardResult) {
						onProgress?.(
							`✓ Map view data migrated for following board: ${board.boardName}`,
							board.boardName,
						);
						await sleep(500);
					} else {
						onProgress?.(
							`⚠ There was an error while saving the map view data in the board file ${board.filePath}`,
							board.boardName,
						);
					}
				} else {
					onProgress?.(
						`⚠ The map view data doesnt exists for the following board in LocalStorage: ${board.boardName}. Safely moving for the next board.`,
						board.boardName,
					);
					await sleep(500);
				}
			} catch (error) {
				const errorMsg =
					error instanceof Error ? error.message : String(error);
				onProgress?.(
					`⚠ Failed to migrate map view for the following board: ${board.boardName}. ERROR: ${errorMsg}. Safely moving for the next board.`,
					board.boardName,
				);
				await sleep(500);
			}
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		onProgress?.(
			`⚠ Unexpected error during map view migration process. ERROR: ${errorMsg}`,
		);
		await sleep(500);
	}
}

/**
 * Update plugin registry and settings with migrated boards
 */
export async function updateRegistryAndSettings(
	plugin: TaskBoard,
	oldPluginSettings: any,
	onProgress?: (message: string) => void,
): Promise<{ success: boolean; error?: string }> {
	try {
		onProgress?.("Updating plugin settings...");
		await sleep(500);

		const migratedSettings = migrateSettings(
			DEFAULT_SETTINGS,
			oldPluginSettings,
		);

		if (migratedSettings.version === "") {
			// There was an error while migrating the settings. => ABORT
			return { success: false };
		} else {
			migratedSettings.version = newReleaseVersion;
			await plugin.saveSettings(migratedSettings);
		}
		await sleep(500);
		onProgress?.("✓ Plugin settings updated");

		return { success: true };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		onProgress?.(`✗ Failed to update plugin settings: ${errorMsg}`);
		return { success: false, error: errorMsg };
	}
}

/**
 * Main migration orchestrator function
 */
export async function migrateVersion1_to_Version2(
	plugin: TaskBoard,
	onStepStart: (
		stepNumber: number,
		totalSteps: number,
		stepName: string,
	) => void,
	onStepProgress: (
		message: string,
		boardName?: string,
		status?: "success" | "error",
	) => void,
	onStepComplete: (
		stepNumber: number,
		totalSteps: number,
		stepName: string,
	) => void,
): Promise<MigrationResult> {
	const result: MigrationResult = {
		success: false,
		migratedBoards: [],
		errors: [],
		totalSteps: 4,
		completedSteps: 0,
	};

	try {
		const oldPluginSettings = await readDataFile(plugin.app);
		if (oldPluginSettings === undefined) {
			result.success = true;
			result.completedSteps = 4;
			return result;
		}

		// Step 0: Check for v1 data
		const v1Check = await checkForV1Data(oldPluginSettings);
		if (!v1Check.hasV1Data) {
			result.success = true;
			result.completedSteps = 4;
			return result;
		}

		// Step 1: Create backup
		onStepStart?.(1, 4, "Creating backup...");
		const backupResult = await createBackupConfigFile(
			plugin,
			oldPluginSettings,
			onStepProgress,
		);
		if (backupResult.success) {
			result.backupPath = backupResult.backupPath;
			result.completedSteps++;
		} else {
			result.errors.push(`Backup failed: ${backupResult.error}`);
			result.success = false;
			result.completedSteps = 0;
			return result;
		}
		onStepComplete?.(1, 4, "Backup creation");
		await sleep(500);

		// Step 2: Create board files
		onStepStart?.(2, 4, "Creating board files (.taskboard) ...");
		if (v1Check.legacyBoards && v1Check.legacyBoards.length > 0) {
			const boardResults = await createBoardFiles(
				plugin,
				v1Check.legacyBoards,
				onStepProgress,
			);
			result.migratedBoards = boardResults;
			result.completedSteps++;
		} else {
			result.errors.push("No legacy boards found to migrate");
		}
		onStepComplete?.(2, 4, "Board file creation");
		await sleep(500);

		// Step 3: Migrate map view data
		onStepStart?.(3, 4, "Migrating map view data...");
		const successfulBoards = result.migratedBoards.filter(
			(b) => b.status === "success",
		);
		await migrateMapViewData(plugin, successfulBoards, onStepProgress);
		result.completedSteps++;
		onStepComplete?.(3, 4, "Map view data migration");
		await sleep(500);

		// Step 4: Update the main settings file (data.json) and the registry inside it.
		onStepStart?.(4, 4, "Finalizing migration...");
		const modifiedOldPluginSettings = {
			version: oldPluginSettings.version,
			data: oldPluginSettings.data.globalSettings,
		};
		const registryResult = await updateRegistryAndSettings(
			plugin,
			modifiedOldPluginSettings,
			onStepProgress,
		);
		if (registryResult.success) {
			result.completedSteps++;
		} else {
			result.errors.push(
				`Plugin settings updation process failed. ERROR: ${registryResult.error}`,
			);
		}
		onStepComplete?.(4, 4, "Registry update");

		result.success =
			result.migratedBoards.length > 0 && result.errors.length === 0;

		return result;
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		result.errors.push(`Unexpected migration error: ${errorMsg}`);
		return result;
	}
}
