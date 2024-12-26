import { Notice, TFile } from "obsidian";

import TaskBoard from "main";
import store from "src/store";
import { t } from "./lang/helper";

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
			new Notice(`${t(171)} ${filePath}`);
			console.error(`File not found at path: ${filePath}`);
			throw `File not found at path: ${filePath}`;
		}
	} catch (error) {
		console.error("Error reading file from vault:", error);
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
			store.recentUpdatedFilePath.set(filePath);
			await plugin.app.vault.modify(file, newContent);
		} else {
			new Notice(`${t(171)} ${filePath}`);
			console.error(`File not found at path: ${filePath}`);
		}
	} catch (error) {
		console.error("Error writing to file in vault:", error);
		throw error;
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
