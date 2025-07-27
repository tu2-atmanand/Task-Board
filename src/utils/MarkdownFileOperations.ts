// /src/utils/MarkdownFileOperations.ts

import { TFile } from "obsidian";

import TaskBoard from "main";
import { bugReporter } from "src/services/OpenModals";

export const readDataOfVaultFiles = async (
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
				"MarkdownFileOperations.ts/readDataOfVaultFiles"
			);
			throw `File not found at path: ${filePath}`;
		}
	} catch (error) {
		bugReporter(
			plugin,
			"Error reading data from vault files.",
			String(error),
			"MarkdownFileOperations.ts/readDataOfVaultFiles"
		);
		throw error;
	}
};

export const writeDataToVaultFiles = async (
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
	} catch (error) {
		bugReporter(
			plugin,
			"Error writing to file in vault.",
			String(error),
			"MarkdownFileOperations.ts/writeDataToVaultFiles"
		);
		// throw error;
	}
};

// export const writeDataToVaultFiles = async (
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
