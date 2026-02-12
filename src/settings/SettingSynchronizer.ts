import { Notice } from "obsidian";
import TaskBoard from "main";
import { fsPromises, NodePickedFile } from "src/services/FileSystem";
import {
	DEFAULT_SETTINGS,
	PluginDataJson,
} from "src/interfaces/GlobalSettings";
import { t } from "src/utils/lang/helper";
import { KanbanBoardType } from "src/interfaces/Enums";
import { Board, BoardLegacy, ColumnData, ColumnGroupData, swimlaneConfigs } from "src/interfaces/BoardConfigs";
import { generateIdForFilters } from "src/components/BoardFilters/ViewTaskFilter";
import { colTypeNames } from "src/interfaces/Enums";
import { bugReporterManagerInsatance } from "src/managers/BugReporter";
import { generateRandomNumber } from "src/utils/TaskItemUtils";
import { newReleaseVersion } from "src/interfaces/Constants";

// Helper function to check if board has legacy structure (columns is an array)
function isLegacyBoard(boardConfig: any): boardConfig is BoardLegacy {
	return Array.isArray(boardConfig.columns);
}

function cloneColumnArray(columns?: ColumnData[]): ColumnData[] {
	if (!columns || columns.length === 0) {
		return [];
	}
	return columns.map((column) =>
		JSON.parse(JSON.stringify(column)) as ColumnData
	);
}

function resolveDefaultColumns(
	defaults: any,
): ColumnGroupData {
	const defaultBoards = Array.isArray(defaults?.boardConfigs)
		? (defaults.boardConfigs as Board[])
		: [];

	if (defaultBoards.length === 0) {
		return { status: [], time: [], tag: [] };
	}

	const template = defaultBoards[0];

	return {
		status: cloneColumnArray(template.columns.status),
		time: cloneColumnArray(template.columns.time),
		tag: cloneColumnArray(template.columns.tag),
	};
}

/**
 * Recursively migrates settings by adding missing fields from defaults to settings.
 * Also handles specific migrations for certain fields.
 * @param defaults - The default settings object
 * @param settings - The current settings object to migrate
 * @returns The migrated settings object
 */
export function migrateSettings(defaults: any, settings: any): PluginDataJson {
	try {
		if (settings == undefined) return defaults;

		for (const key in defaults) {
			if (!(key in settings)) {
				// This is a cumpulsory migration which will be required in every new version update, since a new field should be added into the users settings.
				settings[key] = defaults[key];
			}

			// -----------------------------------
			/**
			 * @since v1.2.0
			 * @type Temporary
			 * @note Remove this after around 6 months.
			 *
			 * This is a temporary migration to convert tagColors from object to array format.
			 */
			if (
				!Array.isArray(settings[key]) &&
				key === "tagColors" &&
				typeof settings[key] === "object" &&
				settings[key] !== null
			) {
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
			}

			// -----------------------------------
			/**
			 * @since v1.9.0
			 * @type Temporary
			 * @note Remove this on the next version release where this migration will run.
			 *
			 * This is migration is only applied to replace the older settings available in users configs with the new settings as per the new Settinsg section added in the global settings.
			 */
			if (key === "customStatuses") {
				settings[key] =
					DEFAULT_SETTINGS.data.globalSettings.customStatuses;
			}

			// -----------------------------------
			/**
			 * @since v1.9.2
			 * @type Temporary
			 * @note Remove this on the next version release where this migration will run.
			 *
			 * Because of the name change, we had to do this migration.
			 */
			if (key === "frontmatter" && settings["frontMatter"]) {
				settings[key] = settings["frontMatter"];
				delete settings["frontMatter"];
			}

			// -------------------------------------
			/**
			 * Migration for boardConfigs - handles both legacy format and new format.
			 * Legacy boards have columns as a flat array; new boards use ColumnGroupData.
			 */
			if (key === "boardConfigs" && Array.isArray(settings[key])) {
				settings[key] = settings[key].map((boardConfig: any) => {
					// Check if this is a legacy board (columns is an array)
					if (isLegacyBoard(boardConfig)) {
						const newColumns: ColumnGroupData = resolveDefaultColumns(defaults);
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
							swimlanes: boardConfig.swimlanes,
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
						// Board is already in new format; ensure columns align with defaults
						const board = boardConfig as Board;

						// Ensure columns are set
						if (!board.columns) {
							board.columns = resolveDefaultColumns(defaults);
						} else {
							const resolvedColumns = resolveDefaultColumns(defaults);
							// Ensure each column group exists
							if (!board.columns.status) {
								board.columns.status = resolvedColumns.status;
							}
							if (!board.columns.time) {
								board.columns.time = resolvedColumns.time;
							}
							if (!board.columns.tag) {
								board.columns.tag = resolvedColumns.tag;
							}
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
			}

			// -------------------------------------
			/**
			 * @type Reqruired
			 *
			 * This is a cumpulsory case, which will recursively iterate all the object type settings.
			 */
			if (
				typeof defaults[key] === "object" &&
				defaults[key] !== null &&
				!Array.isArray(defaults[key])
			) {
				migrateSettings(defaults[key], settings[key]);
			}
		}
		return settings;
	} catch (error) {
		bugReporterManagerInsatance.showNotice(
			181,
			`There was an issue while applying the migrations to the configurations for this new version ${newReleaseVersion}.\nIt will be recommended to bring this issue to the developers notice to get some suggestion on this.`,
			JSON.stringify(error),
			"SettingSynchronizer.ts",
		);
		if (settings != undefined) return settings;
		else return defaults;
	}
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
				new Blob([fileContent], { type: "application/json" }),
			);
			a.download = exportFileName;
			document.body.appendChild(a);
			a.click();
			setTimeout(() => {
				document.body.removeChild(a);
				URL.revokeObjectURL(a.href);
			}, 1000);
			new Notice(
				"Settings exported. Check the folder where you downloaded the file.",
			);
		}
	} catch (err) {
		new Notice("Failed to export settings.");
		bugReporterManagerInsatance.addToLogs(
			150,
			String(err),
			"SettingSynchronizer.ts/exportConfigurations",
		);
	}
}

/**
 * Imports plugin settings from a file chosen by the user, merging with existing settings.
 * Preserves new fields in both files.
 */
export async function importConfigurations(
	plugin: TaskBoard,
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
		bugReporterManagerInsatance.addToLogs(
			151,
			String(err),
			"SettingSynchronizer.ts/importConfigurations",
		);
		return false;
	}
}

/**
 * Shows a notice prompting the user to reload Obsidian to apply certain changes.
 * @param plugin - TaskBoard plugin instance
 */
export async function showReloadObsidianNotice(
	plugin: TaskBoard,
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
		0,
	);

	reloadObsidianNotice.messageEl.onClickEvent((e) => {
		if (!(e.target instanceof HTMLButtonElement)) {
			e.stopPropagation();
			e.preventDefault();
			e.stopImmediatePropagation();
		}
	});
}
