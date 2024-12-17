import { TFile } from "obsidian";
import TaskBoard from "main";

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
			throw new Error(`File not found at path: ${filePath}`);
		}
	} catch (error) {
		console.error("Error reading file from vault:", error);
		throw error;
	}
};



export const writeDataToVaultFiles = async (
	plugin: TaskBoard,
	filePath: string,
	content: string
): Promise<void> => {
	try {
		const file = plugin.app.vault.getAbstractFileByPath(filePath);
		if (file && file instanceof TFile) {
			await plugin.app.vault.modify(file, content);
		} else {
			throw new Error(`File not found at path: ${filePath}`);
		}
	} catch (error) {
		console.error("Error writing to file in vault:", error);
		throw error;
	}
};
