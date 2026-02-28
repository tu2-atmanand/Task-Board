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

	if (fileInFilters && scanFilters.files.polarity === 1) return [true, true];
	if (fileInFilters && scanFilters.files.polarity === 2) return [true, false];
	if (!fileInFilters && scanFilters.files.polarity === 1)
		return [false, false];
	if (!fileInFilters && scanFilters.files.polarity === 2)
		return [false, true];
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
	if (
		scanFilters.files.polarity === 3 &&
		scanFilters.frontmatter.polarity === 3 &&
		scanFilters.folders.polarity === 3
	) {
		return true;
	}

	const fileName = file.path; // Extract file name along with the path
	const parentFolder = file.parent?.path || "";
	let fileRes: boolean[] | undefined;
	let fmRes: boolean[] | undefined;
	let folderRes: boolean[] | undefined;

	if (
		scanFilters.files.polarity !== 3 &&
		scanFilters.files.values.length > 0
	) {
		fileRes = checkFileFilters(fileName, scanFilters);
	}
	// Explicit mention precedence
	if (fileRes?.[0]) return fileRes[1];

	if (
		scanFilters.frontmatter.polarity !== 3 &&
		scanFilters.frontmatter.values.length > 0
	) {
		fmRes = checkFrontMatterFilters(plugin, file, scanFilters);
	}
	if (fmRes?.[0]) return fmRes[1];

	if (
		scanFilters.folders.polarity !== 3 &&
		scanFilters.folders.values.length > 0
	) {
		folderRes = checkFolderFilters(parentFolder, scanFilters);
	}
	if (folderRes?.[0]) return folderRes[1];

	// Otherwise combine enabled filters deterministically (AND across enabled filters)
	let allowed = true;
	if (fileRes) allowed = allowed && fileRes[1];
	if (fmRes) allowed = allowed && fmRes[1];
	if (folderRes) allowed = allowed && folderRes[1];

	// If no enabled filter produced a result, default allow
	return fileRes || fmRes || folderRes ? allowed : true;
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
