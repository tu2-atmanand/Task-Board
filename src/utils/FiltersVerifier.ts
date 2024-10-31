import { TFile } from "obsidian";

export function scanFilterForFilesNFolders(file: TFile, scanFilters: any) {
	const fileName = file.path; // Extract file name along with the path
	const parentFolder = file.parent?.path;

	// Check folder filters
	const folderFilters = scanFilters.folders.values;
	let folderInFilters = folderFilters.includes(parentFolder);

	if (!folderInFilters && parentFolder) {
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
