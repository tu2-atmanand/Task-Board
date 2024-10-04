import { TFile } from "obsidian";

export function scanFilterForFilesNFolders(file: TFile, scanFilters: any) {
	// Separate the parent folder and file name from the file path
	const filePathParts = file.path.split("/");
	const fileName = filePathParts.pop(); // Extract file name
	const parentFolder = filePathParts.join("/") + "/"; // Rebuild the parent folder path

	console.log("The fileName is : ", fileName);
	console.log("The parentFolder is : ", parentFolder);

	// Check folder filters
	const folderInFilters = scanFilters.folders.values.includes(parentFolder);
	const folderCheckPass =
		(folderInFilters && scanFilters.folders.polarity !== 2) ||
		!folderInFilters;

	// Check file filters
	const fileInFilters = scanFilters.files.values.includes(fileName);
	const fileCheckPass =
		(fileInFilters && scanFilters.files.polarity !== 2) || !fileInFilters;

	// If both checks pass, proceed with the scanning logic
	if (folderCheckPass && fileCheckPass) {
		return true;
	} else {
		return false;
	}
}


export function scanFilterForTags(tag: string, scanFilters: any) {
	console.log("The value of tag i am checking using .includes :", tag, ": There shouldnt be any thing in between.")
	const tagInFilters = scanFilters.tags.values.includes(tag);
	const tagPolarity = scanFilters.tags.polarity;

	const tagCheck = (tagPolarity === 1 && tagInFilters) || (tagPolarity === 2 && !tagInFilters) || tagPolarity === 3;
	if(tagCheck) {
		return true;
	} else {
		return false;
	}
}
