import { BoardConfigs } from "./BoardConfigs";

export interface globalSettingsData {
	lang: string;
	scanFilters: {
		files: {
			polarity: number;
			values: string[];
		};
		folders: {
			polarity: number;
			values: string[];
		};
		tags: {
			polarity: number;
			values: string[];
		};
	};
	firstDayOfWeek?: string;
	ignoreFileNameDates: boolean;
	taskCompletionFormat: string;
	taskCompletionDateTimePattern: string;
	dailyNotesPluginComp: boolean;
	dueDateFormat: string;
	taskCompletionInLocalTime: boolean;
	taskCompletionShowUtcOffset: boolean;
	autoAddDue: boolean;
	scanVaultAtStartup: boolean;
	dayPlannerPlugin: boolean;
	realTimeScanning: boolean;
	columnWidth: string;
	showHeader: boolean;
	showFooter: boolean;
	showVerticalScroll: boolean;
	tagColors: { [tagName: string]: string };
}

// Define the interface for GlobalSettings based on your JSON structure
export interface PluginDataJson {
	version: string;
	data: {
		boardConfigs: BoardConfigs;
		globalSettings: globalSettingsData;
	};
}

export const DEFAULT_SETTINGS: PluginDataJson = {
	version: "",
	data: {
		boardConfigs: [],
		globalSettings: {
			lang: "en",
			scanFilters: {
				files: {
					polarity: 0,
					values: [],
				},
				folders: {
					polarity: 0,
					values: [],
				},
				tags: {
					polarity: 0,
					values: [],
				},
			},
			firstDayOfWeek: "Mon",
			ignoreFileNameDates: false,
			taskCompletionFormat: "",
			taskCompletionDateTimePattern: "yyyy-MM-DD/HH:mm",
			dailyNotesPluginComp: false,
			dueDateFormat: "",
			taskCompletionInLocalTime: true,
			taskCompletionShowUtcOffset: false,
			autoAddDue: false,
			scanVaultAtStartup: false,
			dayPlannerPlugin: false,
			realTimeScanning: false,
			columnWidth: "300px",
			showHeader: true,
			showFooter: true,
			showVerticalScroll: false,
			tagColors: {},
		},
	},
};

export const langCodes: { [key: string]: string } = {
	en: "English",
	ar: "العربية",
	cs: "čeština",
	da: "Dansk",
	de: "Deutsch",
	es: "Español",
	fr: "français",
	hi: "हिन्दी",
	id: "Bahasa Indonesia",
	it: "Italiano",
	ja: "日本語",
	ko: "한국어",
	nl: "Nederlands",
	no: "Norsk",
	pl: "język polski",
	pt: "Português",
	ro: "Română",
	ru: "Русский",
	sq: "Shqip",
	tr: "Türkçe",
	uk: "Українська",
	"pt-BR": "Portugues do Brasil",
	"zh-CN": "简体中文",
	"zh-TW": "繁體中文",
};
