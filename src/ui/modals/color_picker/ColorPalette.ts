import { t } from "i18next";


export interface ColorPaletteEntry {
	id: string;
	name: string;
	hex: string;
}

export const DEFAULT_COLOR_PALETTE: ColorPaletteEntry[] = [
	{ id: "burgundy", name: "Burgundy", hex: "#9F1239" },
	{ id: "red", name: "Red", hex: "#DC2626" },
	{ id: "rose", name: "Rose", hex: "#E11D48" },
	{ id: "pink", name: "Pink", hex: "#DB2777" },
	{ id: "fuchsia", name: "Fuchsia", hex: "#C026D3" },
	{ id: "purple", name: "Purple", hex: "#9333EA" },
	{ id: "violet", name: "Violet", hex: "#7C3AED" },
	{ id: "indigo", name: "Indigo", hex: "#4F46E5" },
	{ id: "blue", name: "Blue", hex: "#2563EB" },
	{ id: "sky", name: "Sky", hex: "#0284C7" },
	{ id: "cyan", name: "Cyan", hex: "#0891B2" },
	{ id: "teal", name: "Teal", hex: "#0F766E" },
	{ id: "emerald", name: "Emerald", hex: "#059669" },
	{ id: "green", name: "Green", hex: "#16A34A" },
	{ id: "lime", name: "Lime", hex: "#65A30D" },
	{ id: "olive", name: "Olive", hex: "#4D7C0F" },
	{ id: "yellow", name: "Yellow", hex: "#CA8A04" },
	{ id: "amber", name: "Amber", hex: "#D97706" },
	{ id: "orange", name: "Orange", hex: "#EA580C" },
	{ id: "coral", name: "Coral", hex: "#F97316" },
	{ id: "sand", name: "Sand", hex: "#A16207" },
	{ id: "brown", name: "Brown", hex: "#7C4A2D" },
	{ id: "taupe", name: "Taupe", hex: "#78716C" },
	{ id: "zinc", name: "Zinc", hex: "#575653" },
	{ id: "slate", name: "Slate", hex: "#475569" },
	{ id: "steel", name: "Steel", hex: "#334155" },
	{ id: "charcoal", name: "Charcoal", hex: "#282726" },
	{ id: "black", name: "Black", hex: "#100F0F" },
];

const LEGACY_DEFAULT_COLOR_PALETTE: ColorPaletteEntry[] = [
	{ id: "red", name: "Red", hex: "#DC2626" },
	{ id: "fuchsia", name: "Fuchsia", hex: "#C026D3" },
	{ id: "blue", name: "Blue", hex: "#2563EB" },
	{ id: "emerald", name: "Emerald", hex: "#059669" },
	{ id: "amber", name: "Amber", hex: "#D97706" },
	{ id: "white", name: "White", hex: "#F8FAFC" },
	{ id: "stone", name: "Stone", hex: "#78716C" },
	{ id: "rose", name: "Rose", hex: "#E11D48" },
	{ id: "purple", name: "Purple", hex: "#9333EA" },
	{ id: "sky", name: "Sky", hex: "#0284C7" },
	{ id: "green", name: "Green", hex: "#16A34A" },
	{ id: "orange", name: "Orange", hex: "#EA580C" },
	{ id: "silver", name: "Silver", hex: "#A3A3A3" },
	{ id: "slate", name: "Slate", hex: "#64748B" },
	{ id: "pink", name: "Pink", hex: "#DB2777" },
	{ id: "violet", name: "Violet", hex: "#7C3AED" },
	{ id: "cyan", name: "Cyan", hex: "#0891B2" },
	{ id: "lime", name: "Lime", hex: "#65A30D" },
	{ id: "sand", name: "Sand", hex: "#A16207" },
	{ id: "gray", name: "Gray", hex: "#6B7280" },
	{ id: "charcoal", name: "Charcoal", hex: "#374151" },
	{ id: "coral", name: "Coral", hex: "#F97316" },
	{ id: "indigo", name: "Indigo", hex: "#4F46E5" },
	{ id: "teal", name: "Teal", hex: "#0F766E" },
	{ id: "yellow", name: "Yellow", hex: "#CA8A04" },
	{ id: "brown", name: "Brown", hex: "#92400E" },
	{ id: "zinc", name: "Zinc", hex: "#71717A" },
	{ id: "black", name: "Black", hex: "#111827" },
];

const DEFAULT_COLOR_BY_ID = new Map(
	DEFAULT_COLOR_PALETTE.map((entry) => [entry.id, entry]),
);
const LEGACY_DEFAULT_COLOR_BY_ID = new Map(
	LEGACY_DEFAULT_COLOR_PALETTE.map((entry) => [entry.id, entry]),
);
const DEFAULT_COLOR_NAME_I18N_KEYS: Record<string, string> = {
	burgundy: "colorNameBurgundy",
	red: "colorNameRed",
	rose: "colorNameRose",
	pink: "colorNamePink",
	fuchsia: "colorNameFuchsia",
	purple: "colorNamePurple",
	violet: "colorNameViolet",
	indigo: "colorNameIndigo",
	blue: "colorNameBlue",
	sky: "colorNameSky",
	cyan: "colorNameCyan",
	teal: "colorNameTeal",
	emerald: "colorNameEmerald",
	green: "colorNameGreen",
	lime: "colorNameLime",
	olive: "colorNameOlive",
	yellow: "colorNameYellow",
	amber: "colorNameAmber",
	orange: "colorNameOrange",
	coral: "colorNameCoral",
	sand: "colorNameSand",
	brown: "colorNameBrown",
	taupe: "colorNameTaupe",
	zinc: "colorNameZinc",
	slate: "colorNameSlate",
	steel: "colorNameSteel",
	charcoal: "colorNameCharcoal",
	black: "colorNameBlack",
};
const RETIRED_DEFAULT_COLOR_PALETTE: ColorPaletteEntry[] = [
	{ id: "sand", name: "Sand", hex: "#A16207" },
	{ id: "sand", name: "Sand", hex: "#B7B5AC" },
	{ id: "white", name: "White", hex: "#FFFCF0" },
	{ id: "silver", name: "Silver", hex: "#CECDC3" },
	{ id: "gray", name: "Gray", hex: "#878580" },
	{ id: "stone", name: "Stone", hex: "#78716C" },
];

const RETIRED_COLOR_SLOT_MIGRATIONS = new Map<string, string[]>([
	["sand", ["white"]],
	["taupe", ["stone", "silver"]],
	["steel", ["gray"]],
]);

export function cloneDefaultColorPalette(): ColorPaletteEntry[] {
	return DEFAULT_COLOR_PALETTE.map((entry) => ({ ...entry }));
}

export function normalizeColorPaletteHex(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const normalized = value.trim().replace(/^#/, "");
	if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
	return `#${normalized.toUpperCase()}`;
}

export function normalizeColorPaletteName(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const normalized = value.replace(/\s+/g, " ").trim();
	return normalized ? normalized : null;
}

function normalizeRawColorPaletteEntry(
	raw: unknown,
): { name: string | null; hex: string | null } | null {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
	const entry = raw as Record<string, unknown>;
	return {
		name: normalizeColorPaletteName(entry.name),
		hex: normalizeColorPaletteHex(entry.hex),
	};
}

function getKnownDefaultColorPaletteEntries(id: string): ColorPaletteEntry[] {
	const entries: ColorPaletteEntry[] = [];
	const currentDefault = DEFAULT_COLOR_BY_ID.get(id);
	const legacyDefault = LEGACY_DEFAULT_COLOR_BY_ID.get(id);
	if (currentDefault) entries.push(currentDefault);
	if (legacyDefault) entries.push(legacyDefault);
	entries.push(
		...RETIRED_DEFAULT_COLOR_PALETTE.filter((entry) => entry.id === id),
	);
	return entries;
}

function getLocalizedDefaultColorPaletteName(entry: ColorPaletteEntry): string {
	const key = DEFAULT_COLOR_NAME_I18N_KEYS[entry.id];
	if (!key) return entry.name;
	const localized = t("taskEditor");
	return localized === key ? entry.name : localized;
}

function getKnownDefaultColorPaletteNames(id: string): Set<string> {
	const names = new Set(
		getKnownDefaultColorPaletteEntries(id).map((entry) => entry.name),
	);
	const key = DEFAULT_COLOR_NAME_I18N_KEYS[id];
	if (key) {
		for (const localized of t("taskEditor")) {
			names.add(localized);
		}
	}
	return names;
}

function isKnownDefaultColorPaletteName(
	id: string,
	name: string | null,
): boolean {
	if (!name) return false;
	const normalized = normalizeColorPaletteName(name);
	return normalized
		? getKnownDefaultColorPaletteNames(id).has(normalized)
		: false;
}

function isKnownDefaultColorPaletteValue(
	id: string,
	value: { name: string | null; hex: string | null },
): boolean {
	if (!value.name || !value.hex) return false;
	return (
		isKnownDefaultColorPaletteName(id, value.name) &&
		getKnownDefaultColorPaletteEntries(id).some(
			(entry) => entry.hex === value.hex,
		)
	);
}

function hasCustomColorPaletteValue(
	id: string,
	value: { name: string | null; hex: string | null },
): boolean {
	const knownDefaults = getKnownDefaultColorPaletteEntries(id);
	if (!value.name && !value.hex) return false;
	if (knownDefaults.length === 0) return true;
	if (value.name && !knownDefaults.some((entry) => entry.name === value.name))
		return true;
	if (value.hex && !knownDefaults.some((entry) => entry.hex === value.hex))
		return true;
	return false;
}

function normalizeColorPaletteEntry(
	defaultEntry: ColorPaletteEntry,
	raw: unknown,
): ColorPaletteEntry {
	const value = normalizeRawColorPaletteEntry(raw);
	if (!value) return { ...defaultEntry };
	if (isKnownDefaultColorPaletteValue(defaultEntry.id, value))
		return { ...defaultEntry };
	return {
		id: defaultEntry.id,
		name: value.name ?? defaultEntry.name,
		hex: value.hex ?? defaultEntry.hex,
	};
}

export function normalizeColorPalette(value: unknown): ColorPaletteEntry[] {
	const byId = new Map<string, unknown>();
	if (Array.isArray(value)) {
		for (const raw of value) {
			if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
			const entry = raw as Record<string, unknown>;
			if (typeof entry.id === "string") byId.set(entry.id, entry);
		}
	}

	return DEFAULT_COLOR_PALETTE.map((defaultEntry) => {
		const raw = byId.get(defaultEntry.id);
		if (!raw) {
			const migrated = migrateRetiredColorSlot(defaultEntry, byId);
			if (migrated) return migrated;
		}
		return normalizeColorPaletteEntry(defaultEntry, raw);
	});
}

function migrateRetiredColorSlot(
	defaultEntry: ColorPaletteEntry,
	byId: Map<string, unknown>,
): ColorPaletteEntry | null {
	const retiredIds = RETIRED_COLOR_SLOT_MIGRATIONS.get(defaultEntry.id) ?? [];
	for (const retiredId of retiredIds) {
		const value = normalizeRawColorPaletteEntry(byId.get(retiredId));
		if (!value || !hasCustomColorPaletteValue(retiredId, value)) continue;
		return {
			id: defaultEntry.id,
			name: value.name ?? defaultEntry.name,
			hex: value.hex ?? defaultEntry.hex,
		};
	}
	return null;
}

export function resolveColorPalette(value: unknown): ColorPaletteEntry[] {
	return normalizeColorPalette(value);
}

export function localizeColorPaletteNames(value: unknown): ColorPaletteEntry[] {
	return normalizeColorPalette(value).map((entry) => {
		if (!isKnownDefaultColorPaletteName(entry.id, entry.name)) return entry;
		return {
			...entry,
			name: getLocalizedDefaultColorPaletteName(entry),
		};
	});
}

export function getDefaultColorPaletteEntry(
	id: string,
): ColorPaletteEntry | null {
	const entry = DEFAULT_COLOR_BY_ID.get(id);
	return entry ? { ...entry } : null;
}
