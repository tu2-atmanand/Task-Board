import { TFile } from "obsidian";
import { scanFilters } from "src/interfaces/GlobalSettings";
import TaskBoard from "main";
import { extractFrontmatter } from "./FrontmatterOperations";

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
	) {
		return true;
	}

	const fileName = file.path; // Extract file name along with the path
	const parentFolder = file.parent?.path || "";

	if (
		scanFilters.files.polarity !== 3 &&
		scanFilters.files.values.length > 0
	) {
		const result = checkFileFilters(fileName, scanFilters);
		if (result !== undefined) {
			return result;
		} else {
			// console.log("This comment should not run");
			// return false; // If no specific filter matches, default to true
		}
	}

	if (
		scanFilters.frontMatter.polarity !== 3 &&
		scanFilters.frontMatter.values.length > 0
	) {
		const result = checkFrontMatterFilters(plugin, file, scanFilters);
		if (result !== undefined) {
			return result;
		} else {
			// console.log("This comment should not run");
			// return false; // If no specific filter matches, default to true
		}
	}

	if (
		scanFilters.folders.polarity !== 3 &&
		scanFilters.folders.values.length > 0
	) {
		const result = checkFolderFilters(parentFolder, scanFilters);
		if (result !== undefined) {
			return result;
		} else {
			// console.log("This comment should not run");
			// return false; // If no specific filter matches, default to true
		}
	}

	return true;
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

	if (!frontmatter) {
		return; // No front matter found
	}
	const frontMatterInFilters = Object.keys(frontmatter).some((key) => {
		const filterString = scanFilters.frontMatter.values.find(
			(filter: string) => filter.includes(`"${key}":`)
		);
		if (filterString) {
			const valueMatch = filterString.match(/"[^"]+":\s*([^,\]]+)/);
			if (valueMatch) {
				const filterValue = valueMatch[1].trim();
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
	} else {// This else body will never run because this function is only called if the scanFilters.folders.polarity !== 3.
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
