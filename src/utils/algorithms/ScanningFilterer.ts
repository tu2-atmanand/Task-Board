import { TFile } from "obsidian";
import { scanFilters } from "src/interfaces/GlobalSettings";
import TaskBoard from "main";
import { taskItem } from "src/interfaces/TaskItem";
import { isTaskLine, isCompleted } from "../CheckBoxUtils";
import { getTaskFromId } from "../taskLine/TaskItemUtils";
import { extractFrontmatterFromFile } from "../taskNote/FrontmatterOperations";

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
	scanFilters: scanFilters
): boolean {
	// if (allowedFileExtensionsRegEx.test(file.path) === false) {
	// 	return false; // Only process markdown files
	// }

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
				return false;
			}
		} else {
			return value === fileName;
		}
	});

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
	const frontmatter = extractFrontmatterFromFile(plugin, file);

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
				return parentFolder === filter || parentFolder.startsWith(filter + "/");
			}
		});
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
		// This else body will never run because this function is only called if the scanFilters.folders.polarity !== 3.
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
	const tagInFilters = tags.some((tag) => {
		// return scanFilters.tags.values.includes(tag);
		const result = matchTagsWithWildcards(scanFilters.tags.values, tag);
		return result !== null;
	});

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
	userInputTags: string | string[]
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
			regex.test(userTag.toLowerCase().replace("#", ""))
		)
	);

	return matches.length > 0 ? matches : null;
}

/**
 * Verifies if all sub-tasks and child-tasks (dependsOn) of a task are complete.
 * Returns true if no sub-tasks/child-tasks, or all are complete; otherwise false.
 */
export async function verifySubtasksAndChildtasksAreComplete(
	plugin: TaskBoard,
	task: taskItem
): Promise<boolean> {
	if (!plugin.settings.data.globalSettings.boundTaskCompletionToChildTasks)
		return true;

	let flag = true;

	// Check sub-tasks in body
	const subTasks = (task.body ?? []).filter((line) => isTaskLine(line));
	if (subTasks.length > 0) {
		// Check if all sub-tasks are completed
		const allSubTasksCompleted = subTasks.every((line) =>
			isCompleted(line)
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
