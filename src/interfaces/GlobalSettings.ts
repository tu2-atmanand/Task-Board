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

export interface TagColor {
	name: string;
	color: string;
	priority: number;
}

export enum EditButtonMode {
	PopUp = "popUp",
	NoteInTab = "noteInTab",
	NoteInSplit = "noteInSplit",
	NoteInWindow = "noteInWindow",
	NoteInHover = "noteInHover",
}

export enum UniversalDateOptions {
	startDate = "startDate",
	scheduledDate = "scheduledDate",
	dueDate = "due",
}

export enum universalDateOptionsNames {
	startDate = "Start Date",
	scheduledDate = "Scheduled Date",
	dueDate = "Due Date",
}

export enum TagColorType {
	Text = "text",
	Background = "background",
}

export enum NotificationService {
	None = "none",
	ReminderPlugin = "reminderPlugin",
	NotifianApp = "notifianApp",
	ObsidApp = "obsiApp",
}

export interface CustomStatus {
	symbol: string; // The symbol representing the status (e.g., "/", "-")
	name: string; // The human-readable name of the status (e.g., "In Progress")
	nextStatusSymbol: string; // The symbol representing the next status in the workflow (e.g., "x")
	availableAsCommand: boolean; // Whether this status is available as a command in Obsidian
	type: string; // The type/category of the status (e.g., "IN_PROGRESS", "CANCELLED")
}

export interface TaskBoardAction {
	enabled: boolean;
	trigger: "Complete" | "Incomplete";
	type: "move" | "copy";
	targetColumn: string;
}

export enum cardSectionsVisibilityOptions {
	showSubTasksOnly = "showSubTasksOnly",
	showDescriptionOnly = "showDescriptionOnly",
	showBoth = "showBoth",
	hideBoth = "hideBoth",
}

export interface globalSettingsData {
	openOnStartup: boolean;
	lang: string;
	scanFilters: scanFilters;
	firstDayOfWeek?: string;
	ignoreFileNameDates: boolean;
	taskCompletionFormat: string;
	taskCompletionDateTimePattern: string;
	dailyNotesPluginComp: boolean;
	universalDateFormat: string;
	taskCompletionInLocalTime: boolean;
	taskCompletionShowUtcOffset: boolean;
	autoAddCreatedDate: boolean;
	autoAddUniversalDate: boolean;
	scanVaultAtStartup: boolean;
	realTimeScanning: boolean;
	columnWidth: string;
	showHeader: boolean;
	showFooter: boolean;
	showVerticalScroll: boolean;
	tagColors: TagColor[];
	editButtonAction: EditButtonMode;
	universalDate: string;
	tasksPluginCustomStatuses: CustomStatus[];
	customStatuses: CustomStatus[];
	showTaskWithoutMetadata: boolean;
	tagColorsType: TagColorType;
	preDefinedNote: string;
	quickAddPluginDefaultChoice: string;
	compatiblePlugins: {
		dailyNotesPlugin: boolean;
		dayPlannerPlugin: boolean;
		tasksPlugin: boolean;
		reminderPlugin: boolean;
		quickAddPlugin: boolean;
	};
	archivedTasksFilePath: string;
	showFileNameInCard: boolean;
	showFrontmatterTagsOnCards: boolean;
	tasksCacheFilePath: string;
	notificationService: string;
	frontmatterPropertyForReminder: string;
	actions: TaskBoardAction[];
	searchQuery?: string;
	cardSectionsVisibility: string;
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
	version: "1.4.2",
	data: {
		boardConfigs: [
			{
				columns: [
					{
						id: 1,
						colType: "undated",
						active: true,
						collapsed: false,
						name: "Undated Tasks",
						index: 1,
						datedBasedColumn: {
							dateType: "due",
							from: 0,
							to: 0,
						},
					},
					{
						id: 2,
						colType: "dated",
						active: true,
						collapsed: false,
						name: "Over Due",
						index: 2,
						datedBasedColumn: {
							dateType: "due",
							from: -300,
							to: -1,
						},
					},
					{
						id: 3,
						colType: "dated",
						active: true,
						collapsed: false,
						name: "Today",
						index: 3,
						datedBasedColumn: {
							dateType: "due",
							from: 0,
							to: 0,
						},
					},
					{
						id: 4,
						colType: "dated",
						active: true,
						collapsed: false,
						name: "Tomorrow",
						index: 4,
						datedBasedColumn: {
							dateType: "due",
							from: 1,
							to: 1,
						},
					},
					{
						id: 5,
						colType: "dated",
						active: true,
						collapsed: false,
						name: "Future",
						index: 5,
						datedBasedColumn: {
							dateType: "due",
							from: 2,
							to: 300,
						},
					},
					{
						id: 6,
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
				hideEmptyColumns: false,
			},
			{
				columns: [
					{
						id: 7,
						colType: "untagged",
						active: true,
						collapsed: false,
						name: "Backlogs",
						index: 1,
					},
					{
						id: 8,
						colType: "namedTag",
						active: true,
						collapsed: false,
						name: "Can be implemented",
						index: 2,
						coltag: "pending",
					},
					{
						id: 9,
						colType: "namedTag",
						active: true,
						collapsed: false,
						name: "In Progress",
						index: 3,
						coltag: "working",
					},
					{
						id: 10,
						colType: "namedTag",
						active: true,
						collapsed: false,
						name: "Done",
						index: 4,
						coltag: "done",
					},
					{
						id: 11,
						colType: "namedTag",
						active: true,
						collapsed: false,
						name: "In Review",
						index: 5,
						coltag: "Test",
					},
					{
						id: 12,
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
				hideEmptyColumns: false,
			},
		],
		globalSettings: {
			lang: "en",
			openOnStartup: false,
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
			showTaskWithoutMetadata: true,
			ignoreFileNameDates: false,
			taskCompletionFormat: "1",
			taskCompletionDateTimePattern: "yyyy-MM-DD/HH:mm",
			dailyNotesPluginComp: false,
			universalDateFormat: "yyyy-MM-DD",
			taskCompletionInLocalTime: true,
			taskCompletionShowUtcOffset: false,
			autoAddCreatedDate: false,
			autoAddUniversalDate: true,
			scanVaultAtStartup: false,
			realTimeScanning: true,
			columnWidth: "273px",
			showHeader: true,
			showFooter: true,
			showVerticalScroll: false,
			tagColors: [
				{
					name: "bug",
					color: "rgba(255, 0, 0, 1)",
					priority: 1,
				},
				{
					name: "working",
					color: "rgba(0, 255, 0, 0.8)",
					priority: 2,
				},
				{
					name: "new",
					color: "rgba(0, 0, 255, 1)",
					priority: 3,
				},
			],
			editButtonAction: EditButtonMode.PopUp,
			universalDate: UniversalDateOptions.dueDate,
			tasksPluginCustomStatuses: [],
			tagColorsType: TagColorType.Text,
			customStatuses: [
				{
					symbol: " ",
					name: "Unchecked",
					nextStatusSymbol: "x",
					availableAsCommand: false,
					type: "TODO",
				},
				{
					symbol: "/",
					name: "In Progress",
					nextStatusSymbol: "x",
					availableAsCommand: true,
					type: "IN_PROGRESS",
				},
				{
					symbol: "-",
					name: "Cancelled",
					nextStatusSymbol: "x",
					availableAsCommand: true,
					type: "CANCELLED",
				},
				{
					symbol: "x",
					name: "Done",
					nextStatusSymbol: " ",
					availableAsCommand: true,
					type: "DONE",
				},
			],
			compatiblePlugins: {
				dailyNotesPlugin: false,
				dayPlannerPlugin: false,
				tasksPlugin: false,
				reminderPlugin: false,
				quickAddPlugin: false,
			},
			preDefinedNote: "Task_board_note.md",
			quickAddPluginDefaultChoice: "",
			archivedTasksFilePath: "",
			showFileNameInCard: false,
			showFrontmatterTagsOnCards: false,
			tasksCacheFilePath: "",
			notificationService: NotificationService.None,
			frontmatterPropertyForReminder: "reminder",
			actions: [
				{
					enabled: true,
					trigger: "Complete",
					type: "move",
					targetColumn: "Completed",
				},
			],
			cardSectionsVisibility:
				cardSectionsVisibilityOptions.showSubTasksOnly,
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
	zh: "简体中文",
	"zh-TW": "繁體中文",
};
