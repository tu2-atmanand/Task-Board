// /src/utils/lang/helper.ts

import { Notice, normalizePath, requestUrl, getLanguage } from "obsidian";
import i18next from "i18next";
import en from "./locale/en";
import TaskBoard from "main";
import { langCodes } from "src/interfaces/GlobalSettings";
import { bugReporter } from "src/services/OpenModals";
import {
	NODE_POSITIONS_STORAGE_KEY,
	NODE_SIZE_STORAGE_KEY,
	PENDING_SCAN_FILE_STACK,
	VIEWPORT_STORAGE_KEY,
} from "src/interfaces/Constants";

// --- Called Once On Plugin Load ---
export const loadTranslationsOnStartup = async (plugin: TaskBoard) => {
	const lang = getLanguage();

	// Initialize i18next with English as the default/fallback language
	await i18next.init({
		lng: lang,
		fallbackLng: "en",
		resources: {
			en: {
				translation: en,
			},
		},
		interpolation: {
			escapeValue: false, // React already escapes values
		},
		returnEmptyString: false,
		returnNull: false,
	});

	plugin.isI18nInitialized = true;

	// If language is not English, load the translation file from disk
	if (lang !== "en" && lang in langCodes) {
		try {
			const pluginFolder = `${plugin.app.vault.configDir}/plugins/task-board/`;
			const filePath = normalizePath(
				`${pluginFolder}/locales/${lang}.json`
			);
			const file = await plugin.app.vault.adapter.read(filePath);
			const parsed = JSON.parse(file);

			// Add the loaded translations to i18next
			i18next.addResourceBundle(lang, "translation", parsed, true, true);
			console.log(
				"Another resource added to i18n : ",
				i18next.languages,
				"\nData in the instance :",
				i18next.getDataByLanguage(lang)
			);
		} catch (err) {
			console.warn(
				`Could not load language file for '${lang}', falling back to English.`,
				err
			);
		}
	}
};

// Main translation function
export function t(key: string): string {
	// if (!isI18nInitialized) { // INFO : Cannot use this method, since I dont have access to plugin instance to access the isI18nInitialized variable.
	// 	console.warn("i18n not initialized, falling back to English");
	// 	return en?.[key] || `Missing translation for "${key}"`;
	// }

	try {
		const transString = i18next.t(key, {
			defaultValue: en?.[key] || `Missing translation for "${key}"`,
		});
		return transString;
	} catch {
		return en?.[key] || `Missing translation for "${key}"`;
	}
}

// Sync fallback version (used sparingly) - now just calls t()
export function tSync(key: string): string {
	return t(key);
}

// Download and apply a new language file
export async function downloadAndApplyLanguageFile(
	plugin: TaskBoard
): Promise<boolean> {
	const lang = getLanguage();

	if (lang === "en") {
		new Notice("English is the default language. No download needed.");
		return false;
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

		// Load the new translations into i18next
		// if (plugin.isI18nInitialized) {
		// 	const parsed = JSON.parse(res.text);
		// 	i18next.addResourceBundle(lang, "translation", parsed, true, true);
		// }

		progressNotice.hide();
		new Notice(
			`Language file '${lang}.json' downloaded successfully!\nPlease reload Obsidian to apply changes.`,
			0
		);

		return true;
	} catch (err) {
		progressNotice.hide();
		bugReporter(
			plugin,
			`You have selected the following language for Obsidian application : ${langCodes[lang]} - ${lang}.\nBased on the error message below, either your internet is OFF or the language translation file is not present at the following link : https://github.com/tu2-atmanand/Task-Board/main/src/utils/lang/locale/. \nIt would be really helpful if you can contribute for your native language translation by visiting the following link : https://tu2-atmanand.github.io/task-board-docs/docs/Advanced/Contribution_For_Languages/`,
			err as string,
			"helper.ts/downloadAndApplyLanguageFile"
		);

		return false;
	}
}

export const deleteAllLocalStorageKeys = () => {
	// No longer need to remove LOCAL_STORAGE_TRANSLATIONS as we're using i18next
	localStorage.removeItem(NODE_POSITIONS_STORAGE_KEY);
	localStorage.removeItem(NODE_SIZE_STORAGE_KEY);
	localStorage.removeItem(VIEWPORT_STORAGE_KEY);
	localStorage.removeItem(PENDING_SCAN_FILE_STACK);
};
