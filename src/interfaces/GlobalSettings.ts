import { BoardConfigs } from "./BoardConfigs";
import {
	EditButtonMode,
	TagColorType,
	HideableTaskProperty,
	taskPropertyFormatOptions,
	UniversalDateOptions,
	NotificationService,
	cardSectionsVisibilityOptions,
	colType,
	taskStatuses,
	DEFAULT_TASK_NOTE_FRONTMATTER_KEYS,
	mapViewBackgrounVariantTypes,
	mapViewNodeHandlePosition,
} from "./Enums";
import { taskItemKeyToNameMapping } from "./Mapping";

export interface scanFilters {
	files: {
		polarity: number;
		values: string[];
	};
	folders: {
		polarity: number;
		values: string[];
	};
	frontMatter: {
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

export interface frontmatterFormatting {
	index: number;
	property: string;
	key: string;
	taskItemKey: string;
}

export interface globalSettingsData {
	openOnStartup: boolean;
	lang: string;
	scanFilters: scanFilters;
	firstDayOfWeek?: string;
	ignoreFileNameDates: boolean;
	taskPropertyFormat: string;
	taskCompletionDateTimePattern: string;
	dailyNotesPluginComp: boolean;
	universalDateFormat: string;
	defaultStartTime: string;
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
	doubleClickCardToEdit: EditButtonMode;
	universalDate: string;
	tasksPluginCustomStatuses: CustomStatus[];
	customStatuses: CustomStatus[];
	showTaskWithoutMetadata: boolean;
	tagColorsType: TagColorType;
	preDefinedNote: string;
	taskNoteIdentifierTag: string;
	taskNoteDefaultLocation: string;
	quickAddPluginDefaultChoice: string;
	compatiblePlugins: {
		dailyNotesPlugin: boolean;
		dayPlannerPlugin: boolean;
		tasksPlugin: boolean;
		reminderPlugin: boolean;
		quickAddPlugin: boolean;
	};
	archivedTasksFilePath: string;
	archivedTBNotesFolderPath: string;
	frontmatterFormatting: frontmatterFormatting[];
	showFileNameInCard: boolean;
	showFrontmatterTagsOnCards: boolean;
	tasksCacheFilePath: string;
	notificationService: string;
	frontmatterPropertyForReminder: string;
	actions: TaskBoardAction[];
	searchQuery?: string;
	cardSectionsVisibility: string;
	hiddenTaskProperties: HideableTaskProperty[];
	autoAddUniqueID: boolean;
	uniqueIdCounter: number; // Counter to generate unique IDs for tasks. This will keep track of the last used ID.
	experimentalFeatures: boolean;
	lastViewHistory: {
		viewedType: string;
		boardIndex: number;
		settingTab: number;
		taskId?: string;
	};
	boundTaskCompletionToChildTasks: boolean;
	mapView: {
		background: string;
		handlePosition: number;
		optimizedRender: boolean;
		arrowForward: boolean;
		animatedEdges: boolean;
	};
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
						colType: colType.undated,
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
						colType: colType.dated,
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
						colType: colType.dated,
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
						colType: colType.dated,
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
						colType: colType.dated,
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
				name: "Time Based Workflow",
				index: 0,
				showColumnTags: false,
				showFilteredTags: true,
				hideEmptyColumns: false,
			},
			{
				columns: [
					{
						id: 7,
						colType: colType.untagged,
						active: true,
						collapsed: false,
						name: "Backlogs",
						index: 1,
					},
					{
						id: 8,
						colType: colType.namedTag,
						active: true,
						collapsed: false,
						name: "Can be implemented",
						index: 2,
						coltag: "pending",
					},
					{
						id: 9,
						colType: colType.namedTag,
						active: true,
						collapsed: false,
						name: "In Progress",
						index: 3,
						coltag: "working",
					},
					{
						id: 10,
						colType: colType.namedTag,
						active: true,
						collapsed: false,
						name: "Done",
						index: 4,
						coltag: "done",
					},
					{
						id: 11,
						colType: colType.namedTag,
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
				name: "Tag Based Workflow",
				index: 1,
				showColumnTags: false,
				showFilteredTags: true,
				hideEmptyColumns: false,
			},
			{
				columns: [
					{
						id: 7,
						colType: colType.taskStatus,
						taskStatus: taskStatuses.unchecked,
						active: true,
						collapsed: false,
						name: "Backlogs",
						index: 1,
					},
					{
						id: 8,
						colType: colType.taskStatus,
						taskStatus: taskStatuses.forward,
						active: true,
						collapsed: false,
						name: "Ready to start",
						index: 2,
					},
					{
						id: 9,
						colType: colType.taskStatus,
						taskStatus: taskStatuses.inprogress,
						active: true,
						collapsed: false,
						name: "In Progress",
						index: 3,
					},
					{
						id: 11,
						colType: colType.taskStatus,
						taskStatus: taskStatuses.question,
						active: true,
						collapsed: false,
						name: "In Review",
						index: 5,
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
				name: "Status Based Workflow",
				index: 1,
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
				frontMatter: {
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
			taskPropertyFormat: taskPropertyFormatOptions.tasksPlugin,
			taskCompletionDateTimePattern: "yyyy-MM-DD/HH:mm",
			dailyNotesPluginComp: false,
			universalDateFormat: "yyyy-MM-DD",
			defaultStartTime: "",
			taskCompletionInLocalTime: true,
			taskCompletionShowUtcOffset: false,
			autoAddCreatedDate: false,
			autoAddUniversalDate: true,
			scanVaultAtStartup: false,
			realTimeScanning: true,
			columnWidth: "300px",
			showHeader: true,
			showFooter: true,
			showVerticalScroll: true,
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
			editButtonAction: EditButtonMode.Modal,
			doubleClickCardToEdit: EditButtonMode.None,
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
			taskNoteIdentifierTag: "taskNote",
			taskNoteDefaultLocation: "TaskNotes",
			quickAddPluginDefaultChoice: "",
			archivedTasksFilePath: "",
			archivedTBNotesFolderPath: "TaskBoard/TBNotes/",
			frontmatterFormatting: [
				{
					index: 0,
					property: taskItemKeyToNameMapping["id"],
					key: DEFAULT_TASK_NOTE_FRONTMATTER_KEYS.id,
					taskItemKey: "id",
				},
				{
					index: 1,
					property: taskItemKeyToNameMapping["title"],
					key: DEFAULT_TASK_NOTE_FRONTMATTER_KEYS.title,
					taskItemKey: "title",
				},
				{
					index: 2,
					property: taskItemKeyToNameMapping["status"],
					key: DEFAULT_TASK_NOTE_FRONTMATTER_KEYS.status,
					taskItemKey: "status",
				},
				{
					index: 3,
					property: taskItemKeyToNameMapping["priority"],
					key: DEFAULT_TASK_NOTE_FRONTMATTER_KEYS.priority,
					taskItemKey: "priority",
				},
				{
					index: 4,
					property: taskItemKeyToNameMapping["tags"],
					key: DEFAULT_TASK_NOTE_FRONTMATTER_KEYS.tags,
					taskItemKey: "tags",
				},
				{
					index: 5,
					property: taskItemKeyToNameMapping["time"],
					key: DEFAULT_TASK_NOTE_FRONTMATTER_KEYS.time,
					taskItemKey: "time",
				},
				{
					index: 6,
					property: taskItemKeyToNameMapping["reminder"],
					key: DEFAULT_TASK_NOTE_FRONTMATTER_KEYS.reminder,
					taskItemKey: "reminder",
				},
				{
					index: 7,
					property: taskItemKeyToNameMapping["createdDate"],
					key: DEFAULT_TASK_NOTE_FRONTMATTER_KEYS.createdDate,
					taskItemKey: "createdDate",
				},
				{
					index: 8,
					property: taskItemKeyToNameMapping["startDate"],
					key: DEFAULT_TASK_NOTE_FRONTMATTER_KEYS.startDate,
					taskItemKey: "startDate",
				},
				{
					index: 9,
					property: taskItemKeyToNameMapping["scheduledDate"],
					key: DEFAULT_TASK_NOTE_FRONTMATTER_KEYS.scheduledDate,
					taskItemKey: "scheduledDate",
				},
				{
					index: 10,
					property: taskItemKeyToNameMapping["due"],
					key: DEFAULT_TASK_NOTE_FRONTMATTER_KEYS.due,
					taskItemKey: "due",
				},
				{
					index: 11,
					property: taskItemKeyToNameMapping["dependsOn"],
					key: DEFAULT_TASK_NOTE_FRONTMATTER_KEYS.dependsOn,
					taskItemKey: "dependsOn",
				},
				{
					index: 12,
					property: taskItemKeyToNameMapping["cancelledDate"],
					key: DEFAULT_TASK_NOTE_FRONTMATTER_KEYS.cancelledDate,
					taskItemKey: "cancelledDate",
				},
				{
					index: 13,
					property: taskItemKeyToNameMapping["completionDate"],
					key: DEFAULT_TASK_NOTE_FRONTMATTER_KEYS.completionDate,
					taskItemKey: "completionDate",
				},
				// TODO : The below properties will be available once the TBNote feature has been implemented. The filePath will be actually the path of the task-note or the tb-note. A new property will be required to be added inside the taskItem interface to store the sourcePath.
				// {
				// 	index: 14,
				// 	property: taskItemKeyToNameMapping["filePath"],
				// 	key: DEFAULT_TASK_NOTE_FRONTMATTER_KEYS.filePath,
				// 	taskItemKey: "filePath",
				// },
				// {
				// 	index: 15,
				// 	property: taskItemKeyToNameMapping["taskLocation"],
				// 	key: DEFAULT_TASK_NOTE_FRONTMATTER_KEYS.taskLocation,
				// 	taskItemKey: "taskLocation",
				// },
				{
					index: 14,
					property: taskItemKeyToNameMapping["dateModified"],
					key: DEFAULT_TASK_NOTE_FRONTMATTER_KEYS.dateModified,
					taskItemKey: "",
				},
			],
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
			hiddenTaskProperties: [],
			autoAddUniqueID: false,
			uniqueIdCounter: 0, // Counter to generate unique IDs for tasks. This will keep track of the last used ID. --- IGNORE ---
			experimentalFeatures: false,
			lastViewHistory: {
				viewedType: "kanban",
				boardIndex: 0,
				settingTab: 0,
			},
			boundTaskCompletionToChildTasks: false,
			mapView: {
				background: mapViewBackgrounVariantTypes.none,
				handlePosition: mapViewNodeHandlePosition.horizontal,
				optimizedRender: false,
				arrowForward: true,
				animatedEdges: true,
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
	zh: "简体中文",
	"zh-TW": "繁體中文",
};
