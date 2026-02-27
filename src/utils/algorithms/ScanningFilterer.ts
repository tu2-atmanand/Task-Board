import { TFile } from "obsidian";
import { scanFilters } from "src/interfaces/GlobalSettings";
import TaskBoard from "main";
import { taskItem } from "src/interfaces/TaskItem";
import { isTaskCompleted, isTaskLine } from "../CheckBoxUtils";
import { extractFrontmatterFromFile } from "../taskNote/FrontmatterOperations";
import { getTaskFromId } from "../TaskItemUtils";

/**
 * Checks whether the file is mentioned in the "Files" filter or not and based on the logic returns a truth array to specify if the file is explicitely mentioned inside the filter and whether its allowed for scanning or not.
 *
 * @param fileName Full path of the file along with extension.
 * @param scanFilters All scanning filters.
 * @returns [explicitelyMentioned: boolean, isAllowedToScan: boolean] - An truth array where the first element specifies, whether the file is explicitely mentioned inside the filters or not. The second element specifies whether algorithm-wise the file should be scanned or not.
 */
export function checkFileFilters(
	fileName: string,
	scanFilters: scanFilters,
): boolean[] | undefined {
	// const fileInFilters = scanFilters.files.values.includes(fileName);
	const fileInFilters = scanFilters.files.values.some((value) => {
		if (value.startsWith("/") && value.endsWith("/")) {
			// Try to create a RegExp from the pattern
			try {
				const pattern = value.slice(1, -1);
				const regex = new RegExp(pattern);
				return regex.test(fileName);
			} catch {
				// Invalid regex, skip this value
				return true;
			}
		} else {
			return value === fileName;
		}
	});

	if (fileInFilters && scanFilters.files.polarity === 1) {
		return [true, true];
	} else if (fileInFilters && scanFilters.files.polarity === 2) {
		return [true, false];
	} else if (!fileInFilters && scanFilters.files.polarity === 1) {
		return [false, false];
	} else if (!fileInFilters && scanFilters.files.polarity === 2) {
		return [false, true];
	}
	// else {
	// 	return false;
	// }

	// return true;
}

/**
 * Checks whether the frontmatter is mentioned in the "Frontmatter" filter or not and based on the logic returns a truth array to specify if the frontmatter is explicitely mentioned inside the filter and whether the file is allowed for scanning or not.
 *
 * @param fileName Full path of the file along with extension.
 * @param scanFilters All scanning filters.
 * @returns [explicitelyMentioned: boolean, isAllowedToScan: boolean] - An truth array where the first element specifies, whether the frontmatter is explicitely mentioned inside the filters or not. The second element specifies whether algorithm-wise the file should be scanned or not.
 */
export function checkFrontMatterFilters(
	plugin: TaskBoard,
	file: TFile,
	scanFilters: scanFilters,
): boolean[] | undefined {
	const frontmatter = extractFrontmatterFromFile(plugin, file);

	if (!frontmatter) {
		return; // No front matter found
	}
	const frontMatterInFilters = Object.keys(frontmatter).some((key) => {
		const filterString = scanFilters.frontmatter.values.find(
			(filter: string) => filter.includes(`"${key}":`),
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
	if (frontMatterInFilters && scanFilters.frontmatter.polarity === 1) {
		return [true, true];
	} else if (frontMatterInFilters && scanFilters.frontmatter.polarity === 2) {
		return [true, false];
	} else if (
		!frontMatterInFilters &&
		scanFilters.frontmatter.polarity === 1
	) {
		return [false, false];
	} else if (
		!frontMatterInFilters &&
		scanFilters.frontmatter.polarity === 2
	) {
		return [false, true];
	}
}

/**
 * Checks whether the folder is mentioned in the "Folder" filter or not and based on the logic returns a truth array to specify if the folder is explicitely mentioned inside the filter and whether the file is allowed for scanning or not.
 *
 * @param fileName Full path of the file along with extension.
 * @param scanFilters All scanning filters.
 * @returns [explicitelyMentioned: boolean, isAllowedToScan: boolean] -  An truth array where the first element specifies, whether the frontmatter is explicitely mentioned inside the filters or not. The second element specifies whether algorithm-wise the file should be scanned or not.
 */
export function checkFolderFilters(
	parentFolder: string,
	scanFilters: scanFilters,
): boolean[] | undefined {
	let folderInFilters = scanFilters.folders.values.includes(parentFolder);

	if (!folderInFilters && parentFolder !== "") {
		folderInFilters = scanFilters.folders.values.some((filter: string) => {
			if (filter.startsWith("/") && filter.endsWith("/")) {
				// Try to create a RegExp from the pattern
				try {
					const pattern = filter.slice(1, -1);
					const regex = new RegExp(pattern);
					return regex.test(parentFolder);
				} catch {
					// Invalid regex, skip this value
					return false;
				}
			} else {
				// Check if parentFolder is exactly the filter OR is a subfolder of the filter
				return (
					parentFolder === filter ||
					parentFolder.startsWith(filter + "/")
				);
			}
		});
	}

	if (folderInFilters && scanFilters.folders.polarity === 1) {
		return [true, true];
	} else if (folderInFilters && scanFilters.folders.polarity === 2) {
		return [true, false];
	} else if (!folderInFilters && scanFilters.folders.polarity === 1) {
		return [false, false];
	} else if (!folderInFilters && scanFilters.folders.polarity === 2) {
		return [false, true];
	}
	// else {
	// 	// This else body will never run because this function is only called if the scanFilters.folders.polarity !== 3.
	// 	if (
	// 		scanFilters.files.polarity === 1 &&
	// 		scanFilters.folders.polarity === 1 &&
	// 		scanFilters.frontmatter.polarity === 1
	// 	) {
	// 		return false;
	// 	} else if (
	// 		scanFilters.files.polarity === 2 &&
	// 		scanFilters.folders.polarity === 2 &&
	// 		scanFilters.frontmatter.polarity === 2
	// 	) {
	// 		return true;
	// 	} else if (
	// 		scanFilters.files.polarity === 1 ||
	// 		scanFilters.folders.polarity === 1 ||
	// 		scanFilters.frontmatter.polarity === 1
	// 	) {
	// 		return true;
	// 	} else if (
	// 		scanFilters.files.polarity === 2 ||
	// 		scanFilters.folders.polarity === 2 ||
	// 		scanFilters.frontmatter.polarity === 2
	// 	) {
	// 		return true;
	// 	}

	// 	return true;
	// }
}

/**
 * Scans a file and its front-matter for specific filters.
 * @param plugin The main plugin instance.
 * @param file The file to scan.
 * @param scanFilters The filters to apply.
 * @returns True if the file and its front-matter match the filters for scanning, false otherwise.
 */
export function scanFilterForFilesNFoldersNFrontmatter(
	plugin: TaskBoard,
	file: TFile,
	scanFilters: scanFilters,
): boolean {
	// if (allowedFileExtensionsRegEx.test(file.path) === false) {
	// 	return false; // Only process markdown files
	// }

	debugger;

	let allowedForScanning_Files: boolean[] = [];
	let allowedForScanning_Frontmatter: boolean[] = [];
	let allowedForScanning_Folder: boolean[] = [];

	if (
		scanFilters.files.polarity === 3 &&
		scanFilters.frontmatter.polarity === 3 &&
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
			// Whether the file is allowed for scanning or not allowed for scanning, will return it as it is.
			// return result;
			allowedForScanning_Files = result;
		} else {
			// Otherwise, will continue to test this file as per the "Frontmatter" and "Folder" criteria.
			allowedForScanning_Files = [];
		}
	}

	if (
		scanFilters.frontmatter.polarity !== 3 &&
		scanFilters.frontmatter.values.length > 0
	) {
		const result = checkFrontMatterFilters(plugin, file, scanFilters);
		if (result !== undefined) {
			// return result;
			allowedForScanning_Frontmatter = result;
		} else {
			// Otherwise, will continue to test this file as per the "Folder" criteria.
			allowedForScanning_Frontmatter = [];
		}
	}

	if (
		scanFilters.folders.polarity !== 3 &&
		scanFilters.folders.values.length > 0
	) {
		const result = checkFolderFilters(parentFolder, scanFilters);
		if (result !== undefined) {
			// return result;
			allowedForScanning_Folder = result;
		} else {
			allowedForScanning_Folder = [];
			// console.log("This comment should not run");
			// return false; // If no specific filter matches, default to true
		}
	}

	// If the file is explicitely mentioned in the scanFilters.files then will directly go for the result without depending on the other type of scan filters.
	if (allowedForScanning_Files.length > 0 && allowedForScanning_Files[0]) {
		if (allowedForScanning_Files[1]) return true;
		else return false;
	}

	// If the frontmatter is explicitely mentioned in the scanFilters.frontmatter then will directly go for the result without depending on the other type of scan filters.
	if (
		allowedForScanning_Frontmatter.length > 0 &&
		allowedForScanning_Frontmatter[0]
	) {
		if (allowedForScanning_Frontmatter[1]) return true;
		else return false;
	}

	// If the folder is explicitely mentioned in the scanFilters.folders then will directly go for the result without depending on the other type of scan filters.
	if (allowedForScanning_Folder.length > 0 && allowedForScanning_Folder[0]) {
		if (allowedForScanning_Folder[1]) return true;
		else return false;
	}

	// --------------------------------------------
	// The below logic is to test if two or more filters are enabled and how they are related to each other.
	// --------------------------------------------

	if (allowedForScanning_Files.length > 0) {
		if (allowedForScanning_Files[1]) return true;
		else return false;
	}

	if (allowedForScanning_Frontmatter.length > 0) {
		if (allowedForScanning_Frontmatter[1]) return true;
		else return false;
	}

	if (allowedForScanning_Folder.length > 0) {
		if (allowedForScanning_Folder[1]) return true;
		else return false;
	}

	// This logic is getting too complex here.
	return false;
}

/**
 * Check if a task matches the tag filters
 * @param tags - Array of task tags
 * @param scanFilters - Object containing filter values
 * @returns boolean - true if the task matches the filter, false otherwise
 */
export function scanFilterForTags(tags: string[], scanFilters: scanFilters) {
	const tagPolarity = scanFilters.tags.polarity;
	if (tagPolarity === 3) return true;

	const tagInFilters = tags.some((tag) => {
		// return scanFilters.tags.values.includes(tag);
		const result = matchTagsWithWildcards(scanFilters.tags.values, tag);
		return result !== null;
	});

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

/**
 * Matches user input tags against settings tags that may include wildcards (*).
 * Wildcard (*) can be used at the start or end of a tag to match any sequence of characters.
 * Examples:
 *   - "#tag*" matches "#tag1", "#tag-abc", etc.
 *   - "*tag" matches "#mytag", "#yourtag", etc.
 *   - "*tag*" matches "#mytag123", "#123tag456", etc.
 * @param settingsTags - Tags from settings which may include wildcards
 * @param userInputTags - Tags from user input to match against settings tags
 * @returns An array of matching tags or null if no match is found
 */
export function matchTagsWithWildcards(
	settingsTags: string | string[],
	userInputTags: string | string[],
): string[] | null {
	if (!settingsTags || !userInputTags) return null;

	// Normalize to arrays
	const settingsArr = Array.isArray(settingsTags)
		? settingsTags
		: [settingsTags];
	const userArr = Array.isArray(userInputTags)
		? userInputTags
		: [userInputTags];

	// Convert settings tags to regex patterns
	const patterns = settingsArr.map((tag) => {
		// Escape regex special chars except *
		let pattern = tag.toLowerCase().replace("#", ""); // Remove leading #

		pattern = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
		// Replace * with .+ (at least one character)
		pattern = pattern.replace(/\\\*/g, ".*").replace(/\*/g, ".+");
		// If wildcard is at the start, allow anything before
		if (pattern.startsWith(".+")) pattern = "^" + pattern;
		else pattern = "^" + pattern;
		// If wildcard is at the end, allow anything after
		if (pattern.endsWith(".+")) pattern = pattern + "$";
		else pattern = pattern + "$";
		return new RegExp(pattern);
	});

	// Find matches
	const matches = userArr.filter((userTag) =>
		patterns.some((regex) =>
			regex.test(userTag.toLowerCase().replace("#", "")),
		),
	);

	return matches.length > 0 ? matches : null;
}

/**
 * Verifies that all sub-tasks in the task body and all child-tasks (dependsOn)
 * are completed.
 * @param plugin - The TaskBoard plugin instance
 * @param task - The task item to verify
 * @returns A promise that resolves to true if all sub-tasks and child-tasks are completed, false otherwise
 */
export async function verifySubtasksAndChildtasksAreComplete(
	plugin: TaskBoard,
	task: taskItem,
): Promise<boolean> {
	if (!plugin.settings.data.globalSettings.boundTaskCompletionToChildTasks)
		return true;

	let flag = true;

	// Check sub-tasks in body
	const subTasks = (task.body ?? []).filter((line) => isTaskLine(line));
	if (subTasks.length > 0) {
		// Check if all sub-tasks are completed
		const allSubTasksCompleted = subTasks.every((line) =>
			isTaskCompleted(line, false, plugin.settings),
		);
		if (!allSubTasksCompleted) flag = false;
	}

	// Check if all child-tasks (dependsOn) are completed
	if (task?.dependsOn && (task?.dependsOn?.length ?? 0) > 0) {
		for (const childId of task?.dependsOn ?? []) {
			const childTask = await getTaskFromId(plugin, childId);
			if (
				!childTask ||
				!(childTask.status === "X" || childTask.status === "x")
			) {
				flag = false;
			}
		}
	}

	return flag;
}
