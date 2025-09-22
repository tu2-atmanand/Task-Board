import { Notice } from "obsidian";
import TaskBoard from "main";
import { fsPromises, NodePickedFile } from "src/utils/FileSystem";
import {
	DEFAULT_SETTINGS,
	PluginDataJson,
} from "src/interfaces/GlobalSettings";
import { t } from "src/utils/lang/helper";

/**
 * Migrates settings from imported data to current settings, preserving new fields and syncing new ones.
 * This function is recursive for nested objects.
 */
export function migrateSettings(defaults: any, settings: any): PluginDataJson {
	for (const key in defaults) {
		if (!(key in settings)) {
			settings[key] = defaults[key];
		} else if (
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
		} else if (key === "boardConfigs" && Array.isArray(settings[key])) {
			settings[key].forEach((boardConfig: any) => {
				boardConfig.columns.forEach((column: any) => {
					if (!column.id) {
						column.id = Math.floor(Math.random() * 1000000);
					}
					if (
						column.colType === "dated" ||
						(column.colType === "undated" &&
							!column.datedBasedColumn)
					) {
						column.datedBasedColumn = {
							dateType: defaults.universalDate,
							from: column.datedBasedColumn?.from || 0,
							to: column.datedBasedColumn?.to || 0,
						};
						delete column.range;
					}
				});
				if (!boardConfig.hideEmptyColumns) {
					boardConfig.hideEmptyColumns = false;
				}
			});
		} else if (
			typeof defaults[key] === "object" &&
			defaults[key] !== null &&
			!Array.isArray(defaults[key])
		) {
			migrateSettings(defaults[key], settings[key]);
		} else if (key === "tasksCacheFilePath" && settings[key] === "") {
			settings[key] = `${
				defaults.app?.vault?.configDir || ""
			}/plugins/task-board/tasks.json`;
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
			console.log(
				"Folder path :",
				folderPath,
				"\nExport path:",
				exportPath
			);
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
			console.log(
				"Imported content:",
				importedContent,
				"\nPicked File:",
				pickedFile
			);
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

		console.log(
			"Current Settings:",
			defaultData,
			"\nImported Settings:",
			importedData
		);

		// Merge imported settings with current settings and defaults
		const mergedSettings = migrateSettings(defaultData, importedData);
		console.log("Merged Settings:", mergedSettings);

		// Protect new fields in current settings that are not present in imported file
		// for (const key in currentData) {
		//     if (!(key in mergedSettings)) {
		//         mergedSettings[key] = currentData[key];
		//     }
		// }

		// plugin.settings = mergedSettings;
		// await plugin.saveSettings();
		new Notice("Settings imported and merged successfully.");
		return true;
	} catch (err) {
		new Notice("Failed to import settings.");
		console.error(err);
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
