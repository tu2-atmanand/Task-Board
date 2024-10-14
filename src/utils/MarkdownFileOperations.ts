import TaskBoard from "main";
import { TFile } from "obsidian";

export const readDataOfVaultFiles = async (
	plugin: TaskBoard,
	filePath: string
): Promise<string> => {
	try {
		const file = plugin.app.vault.getAbstractFileByPath(filePath);
		if (file && file instanceof TFile) {
			const fileData = await plugin.app.vault.read(file);
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
			await plugin.app.vault.modify(file, content); // Write updated content to the file
			console.log(`Successfully updated file at path: ${filePath}`);
		} else {
			throw new Error(`File not found at path: ${filePath}`);
		}
	} catch (error) {
		console.error("Error writing to file in vault:", error);
		throw error;
	}
};
