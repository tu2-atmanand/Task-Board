/**
 * Pure matching helpers for the scan-filter settings.
 *
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
