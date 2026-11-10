import { prepareFuzzySearch } from "obsidian";
import { LUCIDE_ICON_TAGS } from "./lucide-icon-tags.js";

type RankedIconMatch = {
	iconId: string;
	bucket: number;
	primaryScore: number;
	secondaryScore: number;
};

function normalizeQuery(query: string): string {
	return query.trim().toLowerCase();
}

function normalizeIconSearchId(iconId: string): string {
	return iconId
		.trim()
		.toLowerCase()
		.replace(/^lucide-/, "");
}

function compareMatches(left: RankedIconMatch, right: RankedIconMatch): number {
	if (left.bucket !== right.bucket) return left.bucket - right.bucket;
	if (left.primaryScore !== right.primaryScore)
		return left.primaryScore - right.primaryScore;
	if (left.secondaryScore !== right.secondaryScore)
		return left.secondaryScore - right.secondaryScore;
	return left.iconId.localeCompare(right.iconId, "en");
}

function createRankedMatch(
	iconId: string,
	loweredQuery: string,
	fuzzySearch: ReturnType<typeof prepareFuzzySearch>,
): RankedIconMatch | null {
	const loweredIconId = iconId.toLowerCase();
	const normalizedIconId = normalizeIconSearchId(iconId);
	if (normalizedIconId === loweredQuery || loweredIconId === loweredQuery) {
		return { iconId, bucket: 0, primaryScore: 0, secondaryScore: 0 };
	}

	const directNameIndex = normalizedIconId.indexOf(loweredQuery);
	if (directNameIndex >= 0) {
		return {
			iconId,
			bucket: 1,
			primaryScore: directNameIndex,
			secondaryScore: normalizedIconId.length,
		};
	}

	const tags =
		LUCIDE_ICON_TAGS[normalizedIconId] ?? LUCIDE_ICON_TAGS[iconId] ?? [];
	const normalizedTags = tags.map((tag) => tag.toLowerCase());
	const exactTagIndex = normalizedTags.findIndex(
		(tag) => tag === loweredQuery,
	);
	if (exactTagIndex >= 0) {
		return {
			iconId,
			bucket: 2,
			primaryScore: exactTagIndex,
			secondaryScore: normalizedTags[exactTagIndex]?.length ?? 0,
		};
	}

	const tagSubstringIndex = normalizedTags.findIndex((tag) =>
		tag.includes(loweredQuery),
	);
	if (tagSubstringIndex >= 0) {
		return {
			iconId,
			bucket: 3,
			primaryScore: tagSubstringIndex,
			secondaryScore: normalizedTags[tagSubstringIndex]?.length ?? 0,
		};
	}

	const nameMatch = fuzzySearch(normalizedIconId);
	if (!nameMatch) return null;
	return {
		iconId,
		bucket: 4,
		primaryScore: nameMatch.score,
		secondaryScore: normalizedIconId.length,
	};
}

export function searchLucideIcons(query: string, iconIds: string[]): string[] {
	const normalizedIconIds = [...iconIds].sort((left, right) =>
		left.localeCompare(right, "en"),
	);
	const loweredQuery = normalizeQuery(query);
	if (!loweredQuery) return normalizedIconIds;
	if (loweredQuery.length === 1) {
		return normalizedIconIds.filter((iconId) =>
			normalizeIconSearchId(iconId).startsWith(loweredQuery),
		);
	}
	const fuzzySearch = prepareFuzzySearch(loweredQuery);

	return normalizedIconIds
		.map((iconId) => createRankedMatch(iconId, loweredQuery, fuzzySearch))
		.filter((entry): entry is RankedIconMatch => !!entry)
		.sort(compareMatches)
		.map((entry) => entry.iconId);
}
