import { Notice } from "obsidian";
import TaskBoard from "main";
import { fsPromises, NodePickedFile } from "src/services/FileSystem";
import {
	DEFAULT_SETTINGS,
	PluginDataJson,
} from "src/interfaces/GlobalSettings";
import { t } from "src/utils/lang/helper";
import { Board, ColumnData } from "src/interfaces/BoardConfigs";
import { generateIdForFilters } from "src/components/BoardFilters/ViewTaskFilter";
import { colTypeNames } from "src/interfaces/Enums";
import { bugReporterManagerInsatance } from "src/managers/BugReporter";
import { generateRandomNumber } from "src/utils/TaskItemUtils";

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
			settings[key] = DEFAULT_SETTINGS.data.globalSettings.customStatuses;
		}

		// -----------------------------------
		/**
		 * @since v1.9.2
		 * @type Temporary
		 * @note Remove this on the next version release where this migration will run.
		 *
		 * Because of the name change, we had to do this migration.
		 */
		if (key === "frontmatter") {
			settings[key] = settings["frontMatter"];
			delete settings["frontMatter"];
		}

		// -------------------------------------
		/**
		 * @since v1.5.0
		 * @type Temporary
		 * @note Remove this in 6 months.
		 *
		 * This is a temporary solution to sync the boardConfigs. This is required to replace the range object with the new 'datedBasedColumn', which will have three values 'dateType', 'from' and 'to'. So, basically we need to copy `range.rangedata.from` value to `datedBasedColumn.from` and similarly for `range.rangedatato`. And for `datedBasedColumn.dateType`, put the value this.settings.data.globalSettings.universalDate
		 */
		if (key === "boardConfigs" && Array.isArray(settings[key])) {
			settings[key].forEach((boardConfig: Board, index: number) => {
				boardConfig.columns.forEach((column: ColumnData) => {
					// Older IDs were smaller number. Will change them to 10 digit numbers.
					column.id = generateRandomNumber();

					if (
						column.colType === colTypeNames.dated ||
						(column.colType === colTypeNames.undated &&
							!column.datedBasedColumn)
					) {
						column.datedBasedColumn = {
							dateType:
								column.datedBasedColumn?.dateType ??
								defaults.universalDate,
							from: column.datedBasedColumn?.from || 0,
							to: column.datedBasedColumn?.to || 0,
						};
						delete column.range;
					}
				});

				// FIX : This is a fix becauase of my silly mistake, in the third board I hardcoded the index as 1 instead of 2.
				boardConfig.index = index;

				// Migration applied since version 1.4.0
				if (!boardConfig?.hideEmptyColumns) {
					boardConfig.hideEmptyColumns = false;
				}

				// Migration applied since version 1.8.0
				if (boardConfig?.filters && boardConfig.filters.length > 0) {
					if (
						boardConfig?.filterPolarity &&
						boardConfig.filterPolarity === "1"
					) {
						boardConfig.boardFilter = {
							rootCondition: "any",
							filterGroups: [
								{
									id: generateIdForFilters(),
									groupCondition: "any",
									filters: boardConfig.filters.map(
										(f: string) => ({
											id: generateIdForFilters(),
											property: "tags",
											condition: "contains",
											value: f,
										}),
									),
								},
							],
						};

						delete boardConfig?.filters;
						delete boardConfig?.filterPolarity;
					}
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
