// /src/utils/lang/helper.ts

import { Notice, normalizePath, requestUrl } from "obsidian";
import en, { Lang } from "./locale/en";
import TaskBoard from "main";
import { langCodes } from "src/interfaces/GlobalSettings";
import { bugReporter } from "src/services/OpenModals";

let currentLang = "en";
// const LOCAL_STORAGE_KEY = "taskBoardCachedLang";
const LOCAL_STORAGE_TRANSLATIONS = "taskBoardCachedTranslations";

// --- Called Once On Plugin Load ---
export const loadTranslationsOnStartup = async (plugin: TaskBoard) => {
	const lang = getLanguage();

	currentLang = lang;

	if (lang === "en") return; // no need to load, use bundled English

	try {
		const pluginFolder = `${plugin.app.vault.configDir}/plugins/task-board/`;
		const filePath = normalizePath(`${pluginFolder}/locales/${lang}.json`);
		const file = await plugin.app.vault.adapter.read(filePath);
		const parsed = JSON.parse(file);

		// localStorage.setItem(LOCAL_STORAGE_KEY, lang);
		localStorage.setItem(
			LOCAL_STORAGE_TRANSLATIONS,
			JSON.stringify(parsed)
		);
	} catch (err) {
		// localStorage.removeItem(LOCAL_STORAGE_KEY);
		localStorage.removeItem(LOCAL_STORAGE_TRANSLATIONS);
	}
};

// Get language preference
const getLanguage = (): string => {
	// return window.localStorage.getItem("taskBoardLang") || "en";

	const obsidianLang = window.localStorage.getItem("language");

	if (obsidianLang && obsidianLang in langCodes) {
		return obsidianLang;
	} else {
		return "en"; // default to English
	}
};

// Main translation function
export function t(key: string): string {
	const currentLang = getLanguage();
	const cachedLangData = window.localStorage.getItem(
		LOCAL_STORAGE_TRANSLATIONS
	);

	let translations: Partial<Lang> = {};

	if (currentLang && cachedLangData && currentLang !== "en") {
		try {
			translations = JSON.parse(cachedLangData);
		} catch {
			// fallback to english
		}
	}

	return (
		translations?.[key] || en?.[key] || `Missing translation for "${key}"`
	);
}

// // Load language file from disk if available
// const loadLocaleFromDisk = async (
// 	plugin: TaskBoard,
// 	lang: string
// ): Promise<Partial<Lang>> => {
// 	const pluginFolder = await getPluginConfigFolder();
// 	const filePath = normalizePath(`${pluginFolder}/locales/${lang}.json`);

// 	try {
// 		const file = await plugin.app.vault.adapter.read(filePath);
// 		const json = JSON.parse(file);
// 		return json;
// 	} catch (err) {
// 		console.warn(
// 			`Could not load language file for '${lang}', falling back to English.`,
// 			err
// 		);
// 		return {};
// 	}
// };

// // Get current locale (from cache or load)
// const getLocale = async (): Promise<Partial<Lang>> => {
// 	const lang = getLanguage();

// 	if (lang === "en") return {};
// 	if (cachedTranslations[lang]) return cachedTranslations[lang];

// 	const locale = await loadLocaleFromDisk(lang);
// 	cachedTranslations[lang] = locale;
// 	currentLang = lang;
// 	return locale;
// };

// // Main async translation function
// export async function t(key: string): Promise<string> {
// 	const locale = await getLocale();
// 	return locale[key] || en[key] || `Missing translation for "${key}"`;
// }

// Sync fallback version (used sparingly)
export function tSync(key: string): string {
	if (currentLang === "en")
		return en[key] || `Missing translation for "${key}"`;
	return en[key] || `Missing translation for "${key}"`;
}

// Download and apply a new language file
export async function downloadAndApplyLanguageFile(
	plugin: TaskBoard
): Promise<void> {
	const lang = getLanguage();

	if (lang === "en") {
		new Notice("English is the default language. No download needed.");
		return;
	}

	const pluginFolder = `${plugin.app.vault.configDir}/plugins/task-board/`;
	const localesFolder = normalizePath(`${pluginFolder}/locales`);
	const filePath = normalizePath(`${localesFolder}/${lang}.json`);
	const tempPath = normalizePath(`${localesFolder}/${lang}.json.tmp`);
	const url = `https://raw.githubusercontent.com/tu2-atmanand/Task-Board/main/src/utils/lang/locale/${lang}.json`;

	let progressNotice = new Notice(
		`Downloading '${lang}' language file...`,
		0
	);

	try {
		const res = await requestUrl({ url });

		// Save to a temporary file first
		await plugin.app.vault.adapter.mkdir(localesFolder).catch(() => {});
		await plugin.app.vault.adapter.write(tempPath, res.text);

		// Replace old file with new
		await plugin.app.vault.adapter.remove(filePath).catch(() => {});
		await plugin.app.vault.adapter.rename(tempPath, filePath);

		// // Invalidate cache
		// delete cachedTranslations[lang];

		progressNotice.hide();
		new Notice(
			`Language file '${lang}.json' downloaded successfully!\nPlease reload Obsidian to apply changes.`,
			0
		);
	} catch (err) {
		progressNotice.hide();
		bugReporter(
			plugin,
			`You have selected the following language for Obsidian application : ${langCodes[lang]} - ${lang}.\nBased on the error message below, either your internet is OFF or the language translation file is not present at the following link : https://github.com/tu2-atmanand/Task-Board/main/src/utils/lang/locale/. \nIt would be really helpful if you can contribute for your native language translation by visiting the following link : https://tu2-atmanand.github.io/task-board-docs/docs/Advanced/Contribution_For_Languages/`,
			err as string,
			"helper.ts/downloadAndApplyLanguageFile"
		);
	}
}

export const clearCachedTranslations = () => {
	// localStorage.removeItem(LOCAL_STORAGE_KEY);
	localStorage.removeItem(LOCAL_STORAGE_TRANSLATIONS);
};
