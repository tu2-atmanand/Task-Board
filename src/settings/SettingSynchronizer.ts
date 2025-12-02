import { Notice } from "obsidian";
import TaskBoard from "main";
import { fsPromises, NodePickedFile } from "src/services/FileSystem";
import {
	DEFAULT_SETTINGS,
	PluginDataJson,
} from "src/interfaces/GlobalSettings";
import { t } from "src/utils/lang/helper";
import { colType, KanbanBoardType } from "src/interfaces/Enums";
import { Board, BoardLegacy, ColumnData, ColumnGroupData, getActiveColumns } from "src/interfaces/BoardConfigs";
import { generateIdForFilters } from "src/components/BoardFilters/ViewTaskFilter";

// Helper function to check if board has legacy structure (columns is an array)
function isLegacyBoard(boardConfig: any): boardConfig is BoardLegacy {
	return Array.isArray(boardConfig.columns);
}

// Helper function to migrate a column
function migrateColumn(column: ColumnData, defaultDateType: string): ColumnData {
	if (!column.id) {
		column.id = Math.floor(Math.random() * 1000000);
	}
	if (
		column.colType === colType.dated ||
		(column.colType === colType.undated &&
			!column.datedBasedColumn)
	) {
		column.datedBasedColumn = {
			dateType:
				column.datedBasedColumn?.dateType ??
				defaultDateType,
			from: column.datedBasedColumn?.from || 0,
			to: column.datedBasedColumn?.to || 0,
		};
		delete column.range;
	}
	return column;
}

/**
 * Recursively migrates settings by adding missing fields from defaults to settings.
 * Also handles specific migrations for certain fields.
 * @param defaults - The default settings object
 * @param settings - The current settings object to migrate
 * @returns The migrated settings object
 */
export function migrateSettings(defaults: any, settings: any): PluginDataJson {
	for (const key in defaults) {
		if (!(key in settings)) {
			// This is a cumpulsory migration which will be required in every new version update, since a new field should be added into the users settings.
			settings[key] = defaults[key];
		} else if (
			!Array.isArray(settings[key]) &&
			key === "tagColors" &&
			typeof settings[key] === "object" &&
			settings[key] !== null
		) {
			// This is a temporary migration applied since version 1.2.0. Can be removed, after around 6 months.
			settings[key] = Object.entries(
				settings[key] as Record<string, string>
			).map(
				([name, color], idx) =>
					({
						name,
						color,
						priority: idx + 1,
					} as any)
			);
		} else if (key === "boardConfigs" && Array.isArray(settings[key])) {
			// Migration for boardConfigs - handles both legacy format and new format
			settings[key] = settings[key].map((boardConfig: any) => {
				// Check if this is a legacy board (columns is an array)
				if (isLegacyBoard(boardConfig)) {
					// Migrate from BoardLegacy to Board
					const legacyColumns = boardConfig.columns as ColumnData[];
					
					// Migrate each column
					legacyColumns.forEach((column: ColumnData) => {
						migrateColumn(column, defaults.universalDate);
					});

					// Convert to new ColumnGroupData structure
					const newColumns: ColumnGroupData = {
						status: legacyColumns,
						time: [],
					};

					// Create the migrated board with new structure
					const migratedBoard: Board = {
						name: boardConfig.name,
						description: boardConfig.description,
						index: boardConfig.index,
						boardType: KanbanBoardType.statusBoard, // Default to status board
						columns: newColumns,
						hideEmptyColumns: boardConfig.hideEmptyColumns ?? false,
						showColumnTags: boardConfig.showColumnTags,
						showFilteredTags: boardConfig.showFilteredTags,
						boardFilter: boardConfig.boardFilter ?? {
							rootCondition: "any",
							filterGroups: [],
						},
						filterConfig: boardConfig.filterConfig,
						taskCount: boardConfig.taskCount,
						filters: boardConfig.filters,
						filterPolarity: boardConfig.filterPolarity,
					};

					// Apply filter migration if needed (version 1.8.0)
					if (migratedBoard.filters && migratedBoard.filters.length > 0) {
						if (
							migratedBoard.filterPolarity &&
							migratedBoard.filterPolarity === "1"
						) {
							migratedBoard.boardFilter = {
								rootCondition: "any",
								filterGroups: [
									{
										id: generateIdForFilters(),
										groupCondition: "any",
										filters: migratedBoard.filters.map(
											(f: string) => ({
												id: generateIdForFilters(),
												property: "tags",
												condition: "contains",
												value: f,
											})
										),
									},
								],
							};

							delete migratedBoard.filters;
							delete migratedBoard.filterPolarity;
						}
					}

					return migratedBoard;
				} else {
					// Board is already in new format, just migrate columns
					const board = boardConfig as Board;
					
					// Migrate status columns (with null check)
					if (board.columns?.status) {
						board.columns.status.forEach((column: ColumnData) => {
							migrateColumn(column, defaults.universalDate);
						});
					}
					
					// Migrate time columns (with null check)
					if (board.columns?.time) {
						board.columns.time.forEach((column: ColumnData) => {
							migrateColumn(column, defaults.universalDate);
						});
					}

					// Ensure columns structure exists
					if (!board.columns) {
						board.columns = { status: [], time: [] };
					}
					if (!board.columns.status) {
						board.columns.status = [];
					}
					if (!board.columns.time) {
						board.columns.time = [];
					}

					// Ensure boardType is set
					if (!board.boardType) {
						board.boardType = KanbanBoardType.statusBoard;
					}

					// Migration applied since version 1.4.0
					if (!board.hideEmptyColumns) {
						board.hideEmptyColumns = false;
					}

					// Migration applied since version 1.8.0
					if (board.filters && board.filters.length > 0) {
						if (
							board.filterPolarity &&
							board.filterPolarity === "1"
						) {
							board.boardFilter = {
								rootCondition: "any",
								filterGroups: [
									{
										id: generateIdForFilters(),
										groupCondition: "any",
										filters: board.filters.map(
											(f: string) => ({
												id: generateIdForFilters(),
												property: "tags",
												condition: "contains",
												value: f,
											})
										),
									},
								],
							};

							delete board.filters;
							delete board.filterPolarity;
						}
					}

					return board;
				}
			});
		} else if (
			typeof defaults[key] === "object" &&
			defaults[key] !== null &&
			!Array.isArray(defaults[key])
		) {
			migrateSettings(defaults[key], settings[key]);
		}
	}
	return settings;
}

/**
 * Exports the plugin settings to a file chosen by the user.
 */
export async function exportConfigurations(plugin: TaskBoard): Promise<void> {
	try {
		const data = plugin.settings;
		const exportFileName = "task-board-configs-export.json";
		const fileContent = JSON.stringify(data, null, 2);

		// Desktop folder picker
		if (
			(window as any).electron &&
			(window as any).electron.remote &&
			(window as any).electron.remote.dialog
		) {
			let folderPaths: string[] = (
				window as any
			).electron.remote.dialog.showOpenDialogSync({
				title: "Pick folder to export settings",
				properties: ["openDirectory", "dontAddToRecent"],
			});
			if (!folderPaths || folderPaths.length === 0) {
				new Notice("Export cancelled or folder not selected.");
				return;
			}
			const folderPath = folderPaths[0];
			const exportPath =
				folderPath.endsWith("/") || folderPath.endsWith("\\")
					? folderPath + exportFileName
					: folderPath +
					  (folderPath.includes("/") ? "/" : "\\") +
					  exportFileName;
			await fsPromises.writeFile(exportPath, fileContent, "utf8");
			new Notice(`Settings exported to ${exportPath}`);
		} else {
			// Web: use file save dialog
			let a = document.createElement("a");
			a.href = URL.createObjectURL(
				new Blob([fileContent], { type: "application/json" })
			);
			a.download = exportFileName;
			document.body.appendChild(a);
			a.click();
			setTimeout(() => {
				document.body.removeChild(a);
				URL.revokeObjectURL(a.href);
			}, 1000);
			new Notice(
				"Settings exported. Check the folder where you downloaded the file."
			);
		}
	} catch (err) {
		new Notice("Failed to export settings.");
		console.error(err);
	}
}

/**
 * Imports plugin settings from a file chosen by the user, merging with existing settings.
 * Preserves new fields in both files.
 */
export async function importConfigurations(
	plugin: TaskBoard
): Promise<boolean> {
	try {
		let importedContent: string | undefined = undefined;
		let extensions = ["json"];
		let name = "JSON Files";

		// Desktop file picker
		if (
			(window as any).electron &&
			(window as any).electron.remote &&
			(window as any).electron.remote.dialog
		) {
			let filePaths: string[] = (
				window as any
			).electron.remote.dialog.showOpenDialogSync({
				title: "Pick settings file to import",
				properties: ["openFile", "dontAddToRecent"],
				filters: [{ name, extensions }],
			});
			if (!filePaths || filePaths.length === 0) {
				new Notice("Import cancelled or file not selected.");
				return false;
			}
			const pickedFile = new NodePickedFile(filePaths[0]);
			importedContent = await pickedFile.readText();
		} else {
			// Web file picker
			await new Promise<void>((resolve) => {
				let inputEl = document.createElement("input");
				inputEl.type = "file";
				inputEl.accept = extensions
					.map((e) => "." + e.toLowerCase())
					.join(",");
				inputEl.addEventListener("change", async () => {
					if (!inputEl.files || inputEl.files.length === 0) {
						new Notice("Import cancelled or file not selected.");
						resolve();
						return;
					}
					const file = inputEl.files[0];
					importedContent = await file.text();
					resolve();
				});
				inputEl.click();
			});
			if (!importedContent) {
				new Notice("Import cancelled or file not selected.");
				return false;
			}
		}

		const importedData: PluginDataJson = JSON.parse(importedContent);

		// Get current settings and defaults
		const currentData = plugin.settings;
		const defaultData = DEFAULT_SETTINGS;

		// Merge imported settings with current settings and defaults
		const mergedSettings = migrateSettings(defaultData, importedData);

		// Protect new fields in current settings that are not present in imported file
		// for (const key in currentData) {
		//     if (!(key in mergedSettings)) {
		//         mergedSettings[key] = currentData[key];
		//     }
		// }

		plugin.settings = mergedSettings;
		await plugin.saveSettings();
		new Notice("Settings imported and merged successfully.");
		return true;
	} catch (err) {
		new Notice("Failed to import settings.");
		console.error(
			"SettingSynchronizer.ts/importConfigurations : Following error occured while importing settings : ",
			err
		);
		return false;
	}
}

/**
 * Shows a notice prompting the user to reload Obsidian to apply certain changes.
 * @param plugin - TaskBoard plugin instance
 */
export async function showReloadObsidianNotice(
	plugin: TaskBoard
): Promise<void> {
	const reloadObsidianNotice = new Notice(
		createFragment((f) => {
			f.createDiv("reloadObsidianNotice", (el) => {
				el.createEl("p", {
					text: t("reload-obsidian-notice-message"),
				});
				el.createEl("button", {
					text: t("reload-now"),
					cls: "reloadNowButton",
					onclick: () => {
						plugin.app.commands.executeCommandById("app:reload");
						el.hide();
					},
				});
				el.createEl("button", {
					text: t("ignore"),
					cls: "ignoreButton",
					onclick: () => {
						el.hide();
					},
				});
			});
		}),
		0
	);

	reloadObsidianNotice.messageEl.onClickEvent((e) => {
		if (!(e.target instanceof HTMLButtonElement)) {
			e.stopPropagation();
			e.preventDefault();
			e.stopImmediatePropagation();
		}
	});
}
