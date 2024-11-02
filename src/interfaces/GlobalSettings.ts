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
		boardConfigs: [
			{
				columns: [
					{
						colType: "undated",
						active: true,
						collapsed: false,
						data: {
							name: "Undated Tasks",
							index: 5,
						},
					},
					{
						colType: "dated",
						active: true,
						collapsed: false,
						data: {
							name: "Over Due",
							index: 1,
							range: {
								tag: "before",
								rangedata: {
									from: -1,
									to: 0,
								},
							},
						},
					},
					{
						colType: "dated",
						active: true,
						collapsed: false,
						data: {
							name: "Today",
							index: 2,
							range: {
								tag: "between",
								rangedata: {
									from: 0,
									to: 0,
								},
							},
						},
					},
					{
						colType: "dated",
						active: true,
						collapsed: false,
						data: {
							name: "Tomorrow",
							index: 3,
							range: {
								tag: "between",
								rangedata: {
									from: 1,
									to: 1,
								},
							},
						},
					},
					{
						colType: "dated",
						active: true,
						collapsed: false,
						data: {
							name: "Future",
							index: 4,
							range: {
								tag: "after",
								rangedata: {
									from: 2,
									to: 0,
								},
							},
						},
					},
					{
						colType: "completed",
						active: true,
						collapsed: false,
						data: {
							limit: 20,
							name: "Completed",
							index: 6,
						},
					},
				],
				filters: [],
				filterPolarity: "0",
				filterScope: "Both",
				name: "Time Based Workflow",
				index: 1,
				showColumnTags: false,
				showFilteredTags: true,
			},
			{
				columns: [
					{
						colType: "untagged",
						active: true,
						collapsed: false,
						data: {
							name: "Backlog",
							index: 1,
						},
					},
					{
						colType: "namedTag",
						active: true,
						collapsed: false,
						data: {
							name: "Can Start working",
							index: 2,
							coltag: "pending",
						},
					},
					{
						colType: "namedTag",
						active: true,
						collapsed: false,
						data: {
							name: "In Progress",
							index: 3,
							coltag: "working",
						},
					},
					{
						colType: "namedTag",
						active: true,
						collapsed: false,
						data: {
							name: "Testing",
							index: 4,
							coltag: "Test",
						},
					},
					{
						colType: "namedTag",
						active: true,
						collapsed: false,
						data: {
							name: "Done",
							index: 5,
							coltag: "done",
						},
					},
					{
						colType: "Completed",
						active: true,
						collapsed: false,
						data: {
							index: 7,
							limit: 10,
							name: "Completed",
						},
					},
				],
				filters: [],
				filterPolarity: "0",
				filterScope: "Both",
				name: "Tag Based Workflow",
				index: 2,
				showColumnTags: false,
				showFilteredTags: true,
			},
		],
		globalSettings: {
			lang: "en",
			scanFilters: {
				files: {
					polarity: 3,
					values: [],
				},
				folders: {
					polarity: 3,
					values: [],
				},
				tags: {
					polarity: 3,
					values: [],
				},
			},
			firstDayOfWeek: "Mon",
			ignoreFileNameDates: false,
			taskCompletionFormat: "1",
			taskCompletionDateTimePattern: "yyyy-MM-DD/HH:mm",
			dailyNotesPluginComp: false,
			dueDateFormat: "yyyy-MM-DD",
			taskCompletionInLocalTime: true,
			taskCompletionShowUtcOffset: false,
			autoAddDue: true,
			scanVaultAtStartup: false,
			dayPlannerPlugin: false,
			realTimeScanning: true,
			columnWidth: "273px",
			showHeader: true,
			showFooter: true,
			showVerticalScroll: false,
			tagColors: {
				bug: "#ef1120dd",
				"bug/solver": "#22f7de99",
				feat: "#b50df2f2",
			},
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
