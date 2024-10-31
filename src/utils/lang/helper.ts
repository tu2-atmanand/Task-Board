// Import all the language files

import en, { Lang } from "./locale/en";

import ar from "./locale/ar";
import cs from "./locale/cs";
import da from "./locale/da";
import de from "./locale/de";
import es from "./locale/es";
import fr from "./locale/fr";
import hi from "./locale/hi";
import id from "./locale/id";
import it from "./locale/it";
import ja from "./locale/ja";
import ko from "./locale/ko";
import nl from "./locale/nl";
import no from "./locale/no";
import pl from "./locale/pl";
import pt from "./locale/pt";
import ptBR from "./locale/ptBR";
import ro from "./locale/ro";
import ru from "./locale/ru";
import sq from "./locale/sq";
import tr from "./locale/tr";
import uk from "./locale/uk";
import zhCN from "./locale/zhCN";
import zhTW from "./locale/zhTW";

// Create a map of the locales
const localeMap: { [k: string]: Partial<Lang> } = {
	ar,
	cs,
	da,
	de,
	en,
	es,
	fr,
	hi,
	id,
	it,
	ja,
	ko,
	nl,
	no,
	pl,
	"pt-BR": ptBR,
	pt,
	ro,
	ru,
	sq,
	tr,
	uk,
	"zh-TW": zhTW,
	zh: zhCN,
};

// Function to get the current language from the system/localStorage
const getLanguage = (): string => {
	// Get the language from localStorage or default to English
	return window.localStorage.getItem("taskBoardLang") || "en"; // TODO : use better method to get this value from RAM instead of localStorage thousands of times.
};

// Function to fetch the locale based on the current language
const getLocale = (): Partial<Lang> => {
	const lang = getLanguage();
	const locale = localeMap[lang] || localeMap["en"]; // Fallback to 'en' if the language is not found
	if (!locale) {
		console.error("Error: kanban locale not found", lang);
	}
	return locale;
};

// Main translation function
export function t(strIndex: number): string {
	const locale = getLocale();
	return locale[strIndex] || en[strIndex];
}
