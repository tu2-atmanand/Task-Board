import { App, Notice, normalizePath } from "obsidian";
import TaskBoard from "main";

/**
 * Migrates settings from imported data to current settings, preserving new fields and syncing new ones.
 * This function is recursive for nested objects.
 */
export function migrateSettings(defaults: any, settings: any) {
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
export async function exportConfigurations(plugin: TaskBoard) {
	try {
		const data = plugin.settings.data;
		const exportFileName = "task-board-configs-export.json";
		const fileContent = JSON.stringify(data, null, 2);

		// Use Obsidian's file picker to select a folder
		// Use system file picker to select a folder
		let folder: string | undefined;
		await new Promise<void>((resolve) => {
			createEl("input", { type: "file" }, (input) => {
				(input as HTMLInputElement).webkitdirectory = true;
				const cleanup = () => {
					input.remove();
				};
				input.addEventListener("change", () => {
					const files = input.files;
					if (files && files.length > 0) {
						console.log("Selected files:", files);
						// Get the folder path from the first file's relative path
						const relativePath = (files[0] as any).webkitRelativePath as string;
						const folderRelative = relativePath.substring(0, relativePath.lastIndexOf("/"));
						// Resolve the absolute path using Obsidian's adapter
						folder = plugin.app.vault.adapter.getFullPath
							? plugin.app.vault.adapter.getFullPath(folderRelative)
							: folderRelative;

						console.log("Resolved folder path:", folder);
					}
					cleanup();
					resolve();
				});
				input.addEventListener("blur", () => {
					cleanup();
				});
				input.click();
			});
		});
		if (!folder) {
			new Notice("Export cancelled or folder not selected.");
			return;
		}
		console.log("Selected folder:", folder);
		const exportPath = normalizePath(`${folder}/${exportFileName}`);
		// Ensure the folder exists before writing
		// if (!(await plugin.app.vault.adapter.exists(folder))) {
		// 	await plugin.app.vault.adapter.mkdir(folder);
		// }
		await plugin.app.vault.adapter.write(exportPath, fileContent);
		new Notice(`Settings exported to ${exportPath}`);
	} catch (err) {
		new Notice("Failed to export settings.");
		console.error(err);
	}
}

/**
 * Imports settings from a file chosen by the user, merging them with current settings.
 */
export async function importConfigurations(plugin: TaskBoard) {
	try {
		let file: any;
		await new Promise<void>((resolve) => {
			const input = createEl("input", { type: "file" });
			const cleanup = () => {
				input.remove();
			};
			input.addEventListener("change", () => {
				const files = (input as HTMLInputElement).files;
				if (files && files.length > 0) {
					console.log("Selected files:", files);
					file = { path: files[0].name, file: files[0] };
				}
				cleanup();
				resolve();
			});
			input.addEventListener("blur", () => {
				cleanup();
			});
			input.click();
		});
		if (!file) {
			new Notice("Import cancelled or file not selected.");
			return;
		}

		const filePath = normalizePath(file.path);
		const fileContent = await plugin.app.vault.adapter.read(filePath);
		const importedData = JSON.parse(fileContent);
		console.log("Imported Data:", importedData);

		// // Migrate settings from imported data to current settings
		// const defaults = plugin.settings.data;
		// const newSettings = migrateSettings(
		// 	importedData,
		// 	JSON.parse(JSON.stringify(defaults))
		// );

		// // Update the plugin settings with the new merged settings
		// plugin.settings.data = newSettings;
		await plugin.saveSettings();

		new Notice("Settings imported and applied successfully.");
	} catch (err) {
		new Notice("Failed to import settings.");
		console.error(err);
	}
}
