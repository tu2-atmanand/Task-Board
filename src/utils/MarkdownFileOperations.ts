// /src/utils/MarkdownFileOperations.ts

import { TFile } from "obsidian";
import TaskBoard from "main";
import { bugReporter } from "src/services/OpenModals";

/**
 * Read data from a file in the vault
 * @param plugin - TaskBoard plugin instance
 * @param filePath - Path of the file to read from
 * @returns Promise<string> - Raw content of the file
 */
export const readDataOfVaultFile = async (
	plugin: TaskBoard,
	filePath: string
): Promise<string> => {
	try {
		const file = plugin.app.vault.getAbstractFileByPath(filePath);
		if (file && file instanceof TFile) {
			const fileData = await plugin.app.vault.cachedRead(file);
			return fileData; // Return the raw content of the file
		} else {
			// new Notice(`${t("file-not-found-at-path")} ${filePath}`);
			// console.error(`File not found at path: ${filePath}`);
			bugReporter(
				plugin,
				"File not found in vault.",
				`File not found at path: ${filePath}`,
				"MarkdownFileOperations.ts/readDataOfVaultFile"
			);
			throw `File not found at path: ${filePath}`;
		}
	} catch (error) {
		bugReporter(
			plugin,
			"Error reading data from vault files.",
			String(error),
			"MarkdownFileOperations.ts/readDataOfVaultFile"
		);
		throw error;
	}
};

/**
 * Write data to a file in the vault
 * @param plugin - TaskBoard plugin instance
 * @param filePath - Path of the file to write to
 * @param newContent - New content to write to the file
 * @returns Promise<void>
 */
export const writeDataToVaultFile = async (
	plugin: TaskBoard,
	filePath: string,
	newContent: string
): Promise<void> => {
	try {
		const file = plugin.app.vault.getAbstractFileByPath(filePath);
		if (file && file instanceof TFile) {
			await plugin.app.vault.modify(file, newContent);
			// plugin.fileUpdatedUsingModal = file.path;
		} else {
			// new Notice(`${t("file-not-found-at-path")} ${filePath}`);
			console.error(`File not found at path: ${filePath}`);
			throw `File not found at path: ${filePath}`;
		}
		return;
	} catch (error) {
		bugReporter(
			plugin,
			"Error writing to file in vault.",
			String(error),
			"MarkdownFileOperations.ts/writeDataToVaultFile"
		);
		// throw error;
	}
};

// export const writeDataToVaultFile = async (
// 	plugin: TaskBoard,
// 	filePath: string,
// 	newContent: string
// ): Promise<void> => {
// 	try {
// 		const file = plugin.app.vault.getAbstractFileByPath(filePath);
// 		if (file && file instanceof TFile) {
// 			await plugin.app.vault.process(file, () => newContent);
// 		} else {
// 			new Notice(`File not found at path: ${filePath}`);
// 			console.error(`File not found at path: ${filePath}`);
// 		}
// 	} catch (error) {
// 		console.error("Error writing to file in vault:", error);
// 		throw error;
// 	}
// };
