import { TFile } from "obsidian";
import { scanFilters } from "src/interfaces/GlobalSettings";
import { extractFrontmatter } from "./ScanningVault";
import TaskBoard from "main";

export function scanFilterForFilesNFoldersNFrontmatter(
	plugin: TaskBoard,
	file: TFile,
	scanFilters: scanFilters
): boolean {
	if (file.extension !== "md") {
		return false; // Only process markdown files
	}

	if (
		scanFilters.files.polarity === 3 &&
		scanFilters.frontMatter.polarity === 3 &&
		scanFilters.folders.polarity === 3
	)
		return true;

	const fileName = file.path; // Extract file name along with the path
	const parentFolder = file.parent?.path || "";

	console.log(
		"scanFilterForFilesNFoldersNFrontmatter: Checking file:",
		fileName,
		"with parent folder:",
		parentFolder
	);

	if (scanFilters.files.polarity !== 3) {
		const result = checkFileFilters(fileName, scanFilters);
		console.log(
			"scanFilterForFilesNFoldersNFrontmatter: File filter result for",
			fileName,
			":",
			result
		);
		if (result !== undefined) {
			return result;
		}
	}

	if (scanFilters.frontMatter.polarity !== 3) {
		const result = checkFrontMatterFilters(plugin, file, scanFilters);
		console.log(
			"scanFilterForFilesNFoldersNFrontmatter: Front matter filter result for",
			fileName,
			":",
			result
		);
		if (result !== undefined) {
			return result;
		}
	}

	if (scanFilters.folders.polarity !== 3) {
		const result = checkFolderFilters(parentFolder, scanFilters);
		console.log(
			"scanFilterForFilesNFoldersNFrontmatter: Folder filter result for",
			parentFolder,
			":",
			result
		);
		if (result !== undefined) {
			return result;
		}
	} else {
		return true;
	}

	console.warn(
		"scanFilterForFilesNFolders: No filters matched for file:",
		fileName
	);
	return false;
}

export function checkFileFilters(
	fileName: string,
	scanFilters: scanFilters
): boolean | undefined {
	const fileInFilters = scanFilters.files.values.includes(fileName);

	if (fileInFilters && scanFilters.files.polarity === 1) {
		return true;
	} else if (fileInFilters && scanFilters.files.polarity === 2) {
		return false;
	}
	// else if (!fileInFilters && scanFilters.files.polarity === 1) {
	// 	return false;
	// } else if (!fileInFilters && scanFilters.files.polarity === 2) {
	// 	return true;
	// }
	// else {
	// 	return false;
	// }

	// return true;
}

export function checkFrontMatterFilters(
	plugin: TaskBoard,
	file: TFile,
	scanFilters: scanFilters
): boolean | undefined {
	const frontmatter = extractFrontmatter(plugin, file);
	console.log("checkFrontMatterFilters: Extracted frontmatter:", frontmatter);
	if (!frontmatter) {
		return; // No front matter found
	}
	const frontMatterInFilters = Object.keys(frontmatter).some((key) => {
		console.log("key:", key);
		const filterString = scanFilters.frontMatter.values.find(
			(filter: string) => filter.includes(`"${key}":`)
		);
		if (filterString) {
			const valueMatch = filterString.match(/"[^"]+":\s*([^,\]]+)/);
			if (valueMatch) {
				const filterValue = valueMatch[1].trim();
				console.log(
					"frontmatter value from the filter :",
					filterValue,
					"\nfrontmatter[key]:",
					frontmatter[key]
				);
				const frontmatterValue = frontmatter[key];
				if (Array.isArray(frontmatterValue)) {
					return frontmatterValue.includes(filterValue); // Check if the filterValue is in the list
				} else {
					return frontmatterValue === filterValue; // Check if the frontmatter value matches the filter value
				}
			}
		}
		return false;
	});
	if (frontMatterInFilters && scanFilters.frontMatter.polarity === 1) {
		return true;
	} else if (frontMatterInFilters && scanFilters.frontMatter.polarity === 2) {
		return false;
	}
}

export function checkFolderFilters(
	parentFolder: string,
	scanFilters: scanFilters
): boolean {
	let folderInFilters = scanFilters.folders.values.includes(parentFolder);

	if (!folderInFilters && parentFolder !== "") {
		folderInFilters = scanFilters.folders.values.some((filter: string) =>
			parentFolder.includes(filter)
		);
	}

	if (scanFilters.folders.polarity === 1) {
		if (folderInFilters) {
			return true;
		} else {
			return false;
		}
	} else if (scanFilters.folders.polarity === 2) {
		if (folderInFilters) {
			return false;
		} else {
			return true;
		}
	} else {
		if (
			scanFilters.files.polarity === 1 &&
			scanFilters.folders.polarity === 1 &&
			scanFilters.frontMatter.polarity === 1
		) {
			return false;
		} else if (
			scanFilters.files.polarity === 2 &&
			scanFilters.folders.polarity === 2 &&
			scanFilters.frontMatter.polarity === 2
		) {
			return true;
		} else if (
			scanFilters.files.polarity === 1 ||
			scanFilters.folders.polarity === 1 ||
			scanFilters.frontMatter.polarity === 1
		) {
			return true;
		} else if (
			scanFilters.files.polarity === 2 ||
			scanFilters.folders.polarity === 2 ||
			scanFilters.frontMatter.polarity === 2
		) {
			return true;
		}

		return true;
	}
}

export function scanFilterForTags(tags: string[], scanFilters: scanFilters) {
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
