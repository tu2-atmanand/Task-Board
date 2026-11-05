import { TFile } from "obsidian";
import TaskBoard from "../../../main.js";
import { taskItem } from "../../interfaces/TaskItem.js";
import { bugReporterManagerInsatance } from "../../managers/BugReporter.js";
import { isTaskLine, isTaskCompleted } from "../CheckBoxUtils.js";
import { getTaskFromId } from "../TaskItemUtils.js";
import { extractFrontmatterFromFile } from "../taskNote/FrontmatterOperations.js";
import { VaultScannnerFilters } from "../../interfaces/GlobalSettings.js";

/** Reports malformed `/pattern/flags` entries once per scan check. */
const logInvalidFolderFilterPattern = (error: unknown) =>
	bugReporterManagerInsatance.addToLogs(
		190,
		JSON.stringify(error),
		"ScanningFileterer.ts/checkFolderFilters",
	);

/**
 * Checks whether the file is mentioned in the "Files" filter or not and based on the logic returns a truth array to specify if the file is explicitely mentioned inside the filter and whether its allowed for scanning or not.
 *
 * @param fileName Full path of the file along with extension.
 * @param scanFilters All scanning filters.
 * @returns [explicitelyMentioned: boolean, isAllowedToScan: boolean] - An truth array where the first element specifies, whether the file is explicitely mentioned inside the filters or not. The second element specifies whether algorithm-wise the file should be scanned or not.
 */
export function checkFileFilters(
	fileName: string,
	scanFilters: VaultScannnerFilters,
): boolean[] | undefined {
	// const fileInFilters = scanFilters.files.values.includes(fileName);
	const fileInFilters = scanFilters.files.values.some((value) => {
		// Check if value is in regex format: /pattern/flags
		// Parse /pattern/flags using regex (handles escaped slashes in pattern)
		const match = value.trim().match(/^\/(.*?)\/([gimsuy]*)$/);
		if (match && match[1]) {
			try {
				const [, pattern, flags] = match;
				const regex = new RegExp(pattern, flags);
				return regex.test(fileName);
			} catch (error) {
				bugReporterManagerInsatance.addToLogs(
					189,
					JSON.stringify(error),
					"ScanningFileterer.ts/checkFileFilters",
				);
				return false; // Skip invalid patterns
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
	scanFilters: VaultScannnerFilters,
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
				const filterValue = valueMatch[1]?.trim() || "";
				const frontmatterValue = frontmatter[key] as unknown;
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
 * Pure matching helpers for the scan-filter settings.
 * Kept free of Obsidian imports so the matching rules can be verified in isolation.
 */

/** Matches filters written in `/pattern/flags` form. */
const REGEX_STYLE_FILTER = /^\/(.*?)\/([gimsuy]*)$/;

export type RegexFilterParse =
	| { kind: "regex"; regex: RegExp }
	| { kind: "invalid"; error: unknown }
	| { kind: "plain" };

/**
 * Splits a vault-relative path into its segments.
 *
 * Empty and `.` segments are dropped, so `"A//BC/"`, `"/A/BC"` and `"A/BC"` all
 * describe the same folder. The vault root yields an empty array.
 *
 * The path itself is never trimmed: folder names may legitimately contain leading
 * or trailing spaces, so `" A"` and `"A"` must stay distinct folders.
 */
export function toPathSegments(path: string): string[] {
	return path
		.split("/")
		.filter((segment) => segment !== "" && segment !== ".");
}

/**
 * Parses a `/pattern/flags` entry.
 *
 * Returns `{ kind: "plain" }` for regular folder paths, `{ kind: "invalid" }` for
 * entries that look like a pattern but fail to compile, and the compiled regex otherwise.
 */
export function parseRegexStyleFilter(value: string): RegexFilterParse {
	const match = value.trim().match(REGEX_STYLE_FILTER);
	if (!match || !match[1]) return { kind: "plain" };
	try {
		return { kind: "regex", regex: new RegExp(match[1], match[2]) };
	} catch (error) {
		return { kind: "invalid", error };
	}
}

/**
 * Checks whether a folder matches one scan-filter entry.
 *
 * Comparison is done segment by segment, never by string prefix, so `ABC` can not
 * swallow `A/BC` and vice versa. A filter matches the folder itself and everything
 * below it; the root filter `/` matches only files sitting in the vault root.
 * The filter value is trimmed as typed input, the folder path is not.
 *
 * @param parentFolder Folder path of the file, e.g. `Journal` or `Journal/Daily`. Empty string means the vault root.
 * @param filter A single `scanFilters.folders.values` entry, either a folder path (any slash padding) or `/pattern/flags`.
 * @param onInvalidPattern Called with the parse error when the entry is a malformed `/pattern/flags`; such entries never match.
 * @returns True when the folder is the filter itself or a subfolder of it.
 */
export function matchesFolderFilter(
	parentFolder: string,
	filter: string,
	onInvalidPattern?: (error: unknown) => void,
): boolean {
	const trimmedFilter = filter.trim();

	// Legacy contract: an empty entry matched the vault root and nothing else.
	if (trimmedFilter === "") return parentFolder === "";

	const parsed = parseRegexStyleFilter(trimmedFilter);
	if (parsed.kind === "invalid") {
		onInvalidPattern?.(parsed.error);
		return false;
	}
	if (parsed.kind === "regex") return parsed.regex.test(parentFolder);

	const filterSegments = toPathSegments(trimmedFilter);
	const folderSegments = toPathSegments(parentFolder);

	if (filterSegments.length === 0) return folderSegments.length === 0; // Root.
	if (folderSegments.length < filterSegments.length) return false;

	return filterSegments.every(
		(segment, index) => folderSegments[index] === segment,
	);
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
	scanFilters: VaultScannnerFilters,
): boolean[] | undefined {
	const folderInFilters = scanFilters.folders.values.some((filter: string) =>
		// Matches when the parent folder is the filter itself or a subfolder of it.
		// Compared segment by segment, so trailing slashes and slash padding in the
		// filter (the folder suggestions add a "/") are irrelevant, and "A/BC" can
		// never be confused with the folder "ABC".
		matchesFolderFilter(
			parentFolder,
			filter,
			logInvalidFolderFilterPattern,
		),
	);

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
	scanFilters: VaultScannnerFilters,
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
	if (fileRes && fileRes[0]) return fileRes[1];

	if (
		scanFilters.frontmatter.polarity !== 3 &&
		scanFilters.frontmatter.values.length > 0
	) {
		fmRes = checkFrontMatterFilters(plugin, file, scanFilters);
	}
	if (fmRes && fmRes[0]) return fmRes[1];

	if (
		scanFilters.folders.polarity !== 3 &&
		scanFilters.folders.values.length > 0
	) {
		folderRes = checkFolderFilters(parentFolder, scanFilters);
	}
	if (folderRes && folderRes[0]) return folderRes[1];

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
export function scanFilterForTags(
	tags: string[],
	scanFilters: VaultScannnerFilters,
) {
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
	if (!plugin.settings.data.boundTaskCompletionToChildTasks) return true;

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

/**
 * Matches user input tags against settings tags that may include wildcards (*).
 * Wildcard (*) can be used at the start or end of a tag to match any sequence of characters.
 * A tag without wildcards also matches its nested tags, the same way Obsidian does:
 * `#DEV` matches both `#DEV` and `#DEV/Tom`.
 * Examples:
 *   - "#tag*" matches "#tag1", "#tag-abc", etc.
 *   - "*tag" matches "#mytag", "#yourtag", etc.
 *   - "*tag*" matches "#mytag123", "#123tag456", etc.
 *   - "#tag" matches "#tag" and "#tag/child", but not "#tag2"
 * @param settingsTags - Tags from settings which may include wildcards
 * @param userInputTags - Tags from user input to match against settings tags
 * @returns An array of matching tags or null if no match is found
 *
 * @todo Will be storing all the tags without the '#' suffix, so we dont have to do the extra replace("#", "") operation. Deprecate that operation in future version such as 2.1.0.
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

		const hasWildcard = pattern.includes("*");

		pattern = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
		if (hasWildcard) {
			// Replace * with .+ (at least one character)
			pattern = pattern.replace(/\\\*/g, ".*").replace(/\*/g, ".+");
		} else {
			// A parent tag also covers its sub-tags.
			pattern = pattern + "(?:/.*)?";
		}

		// // If wildcard is at the start, allow anything before
		// if (pattern.startsWith(".+")) pattern = "^" + pattern;
		// else pattern = "^" + pattern;
		// // If wildcard is at the end, allow anything after
		// if (pattern.endsWith(".+")) pattern = pattern + "$";
		// else pattern = pattern + "$";

		pattern = "^" + pattern + "$";

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
 * Compares two tags by :
 * - Removing the '#' symbol prefix, because the tags are not stored consistently through the plugin configs.
 * - Casting the string into lower-case, because tags are case insensitive in Obsidian.
 *
 * @param tag1 - The first tag
 * @param tag2 - The second tag
 *
 * @returns - TRUE if both the tags are same based on the above rule. Else it will return FALSE.
 *
 * @todo - Will be storing all the tags without the '#' suffix, so we dont have to do the extra replace("#", "") operation. Deprecate that operation in future version such as 2.1.0.
 */
export function compareTwoTags(tag1: string, tag2: string): boolean {
	return (
		tag1.replace("#", "").toLocaleLowerCase() ===
		tag2.replace("#", "").toLocaleLowerCase()
	);
}

/**
 * @deprecated - Will make use of the {@link matchTagsWithWildcards} function instead of this for more features.
 *
 * In Obsidian we can create tags like this :
 * - #physics/mechanics
 * - #physics/quantum
 * In both the above example, the parent tag is '#physics/'. This allows us to filter the tags based on the parent.
 * This function checks if the parentTag is the real parent of the childTag by :
 * - Removing the '#' symbol prefix, because the tags are not stored consistently through the plugin configs.
 * - Casting the string into lower-case, because tags are case insensitive in Obsidian.
 *
 * Example :
 * - parentTag = '#physics/' and childTag = 'physics/astronomy' => Returns TRUE.
 * - parentTag = '#physics' and childTag = '#physics/quantum' => Returns FALSE.
 *
 * @param parentTag - The parent tag.
 * @param childTag - The child tag.
 *
 * @returns - TRUE if the parentTag is the correct parent for the childTag. Else it will return FALSE.
 */
export function isChildTag(parentTag: string, childTag: string): boolean {
	return childTag
		.replace("#", "")
		.toLocaleLowerCase()
		.includes(parentTag.replace("#", "").toLocaleLowerCase());
}
