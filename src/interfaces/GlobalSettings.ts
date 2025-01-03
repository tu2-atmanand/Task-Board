import { BoardConfigs } from "./BoardConfigs";

export interface scanFilters {
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
}

export enum EditButtonMode {
	PopUp = "popUp",
	NoteInTab = "noteInTab",
	NoteInSplit = "noteInSplit",
	NoteInWindow = "noteInWindow",
	NoteInHover = "noteInHover",
}

export interface globalSettingsData {
	openOnStartup:boolean;
	lang: string;
	scanFilters: scanFilters;
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
	editButtonAction: EditButtonMode;
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
						name: "Undated Tasks",
						index: 1,
					},
					{
						colType: "dated",
						active: true,
						collapsed: false,
						name: "Over Due",
						index: 2,
						range: {
							tag: "before",
							rangedata: {
								from: -1,
								to: 0,
							},
						},
					},
					{
						colType: "dated",
						active: true,
						collapsed: false,
						name: "Today",
						index: 3,
						range: {
							tag: "between",
							rangedata: {
								from: 0,
								to: 0,
							},
						},
					},
					{
						colType: "dated",
						active: true,
						collapsed: false,
						name: "Tomorrow",
						index: 4,
						range: {
							tag: "between",
							rangedata: {
								from: 1,
								to: 1,
							},
						},
					},
					{
						colType: "dated",
						active: true,
						collapsed: false,
						name: "Future",
						index: 5,
						range: {
							tag: "after",
							rangedata: {
								from: 2,
								to: 0,
							},
						},
					},
					{
						colType: "completed",
						active: true,
						collapsed: false,
						limit: 20,
						name: "Completed",
						index: 6,
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
						name: "Backlogs",
						index: 1,
					},
					{
						colType: "namedTag",
						active: true,
						collapsed: false,
						name: "Can be implemented",
						index: 2,
						coltag: "pending",
					},
					{
						colType: "namedTag",
						active: true,
						collapsed: false,
						name: "In Progress",
						index: 3,
						coltag: "working",
					},
					{
						colType: "namedTag",
						active: true,
						collapsed: false,
						name: "Done",
						index: 4,
						coltag: "done",
					},
					{
						colType: "namedTag",
						active: true,
						collapsed: false,
						name: "In Review",
						index: 5,
						coltag: "Test",
					},
					{
						colType: "Completed",
						active: true,
						collapsed: false,
						index: 6,
						limit: 10,
						name: "Completed",
					},
				],
				filters: [],
				filterPolarity: "0",
				filterScope: "Both",
				name: "Static Kanban",
				index: 2,
				showColumnTags: false,
				showFilteredTags: true,
			},
		],
		globalSettings: {
			lang: "en",
			openOnStartup:false,
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
			editButtonAction: EditButtonMode.PopUp,
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
