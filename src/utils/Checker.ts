import { TFile } from "obsidian";

export function scanFilterForFilesNFolders(file: TFile, scanFilters: any) {
	console.log("The currently edited file :", file);
	// Separate the parent folder and file name from the file path
	// const filePathParts = file.path.split("/");
	const fileName = file.path; // Extract file name
	// const parentFolder = filePathParts.join("/").trim() + "/"; // Rebuild the parent folder path
	const parentFolder = file.parent?.path;

	console.log("The fileName is : ", fileName);
	console.log("The parentFolder is : ", parentFolder);

	// Check folder filters
	const folderFilters = scanFilters.folders.values;
	let folderInFilters = folderFilters.includes(parentFolder);

	if (!folderInFilters && parentFolder) {
		console.log("--------------------------------");
		folderInFilters = folderFilters.some((filter: string) =>
			parentFolder.includes(filter)
		);
	} 

	const folderCheckPass =
		(folderInFilters && scanFilters.folders.polarity === 1) ||
		(!folderInFilters && scanFilters.folders.polarity === 2) ||
		scanFilters.folders.polarity === 3;

	if (folderCheckPass) {
		// Check file filters
		const fileInFilters = scanFilters.files.values.includes(fileName);
		const fileCheckPass =
			(fileInFilters && scanFilters.files.polarity === 1) ||
			(!fileInFilters && scanFilters.files.polarity === 2) ||
			scanFilters.files.polarity === 3;

		if (fileCheckPass) {
			return true;
		} else {
			return false;
		}
	} else {
		return false;
	}
}

export function scanFilterForTags(tags: string[], scanFilters: any) {
	// console.log(
	// 	"The value of tag i am checking using .includes :",
	// 	tag,
	// 	": There shouldnt be any thing in between."
	// );
	console.log("scanFilterForTags : The value of scanFilters :", scanFilters, "| Value of task.tags :", tags);
	const tagInFilters = tags.some((tag) =>
		scanFilters.tags.values.includes(tag)
	);

	const tagPolarity = scanFilters.tags.polarity;

	const tagCheck =
		(tagPolarity === 1 && tagInFilters) ||
		(tagPolarity === 2 && !tagInFilters) ||
		tagPolarity === 3;
	if (tagCheck) {
		return true;
	} else {
		return false;
	}
}
