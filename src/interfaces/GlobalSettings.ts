import { TaskRegularExpressions } from "src/regularExpressions/TasksPluginRegularExpr";
import { BoardConfigs } from "./BoardConfigs";
import {
	EditButtonMode,
	TagColorType,
	taskPropertiesNames,
	taskPropertyFormatOptions,
	UniversalDateOptions,
	NotificationService,
	DEFAULT_TASK_NOTE_FRONTMATTER_KEYS,
	mapViewBackgrounVariantTypes,
	mapViewNodeMapOrientation,
	mapViewScrollAction,
	mapViewArrowDirection,
	mapViewEdgeType,
	colTypeNames,
	defaultTaskStatuses,
	taskCardStyleNames,
	scanModeOptions,
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
	autoAddUniversalDate: boolean;
	autoAddCreatedDate: boolean;
	autoAddCompletedDate: boolean;
	autoAddCancelledDate: boolean;
	// scanVaultAtStartup: boolean; // @deprecated v1.9.0 - A better approach has been used using showModifiedFilesNotice feature.
	showModifiedFilesNotice: boolean;
	scanMode: string;
	columnWidth: string;
	visiblePropertiesList: string[];
	taskCardStyle: string;
	showVerticalScroll: boolean;
	tagColors: TagColor[];
	editButtonAction: EditButtonMode;
	doubleClickCardToEdit: EditButtonMode;
	universalDate: string;
	customStatuses: CustomStatus[];
	showTaskWithoutMetadata: boolean;
	tagColorsType: TagColorType;
	taskNoteIdentifierTag: string;
	quickAddPluginDefaultChoice: string;
	compatiblePlugins: {
		dailyNotesPlugin: boolean;
		dayPlannerPlugin: boolean;
		tasksPlugin: boolean;
		reminderPlugin: boolean;
		quickAddPlugin: boolean;
	};
	preDefinedNote: string;
	archivedTasksFilePath: string;
	taskNoteDefaultLocation: string;
	archivedTBNotesFolderPath: string;
	frontmatterFormatting: frontmatterFormatting[];
	showFrontmatterTagsOnCards: boolean;
	tasksCacheFilePath: string;
	notificationService: string;
	actions: TaskBoardAction[];
	searchQuery?: string;
	hiddenTaskProperties: taskPropertiesNames[];
	autoAddUniqueID: boolean;
	uniqueIdCounter: number; // Counter to generate unique IDs for tasks. This will keep track of the last used ID.
	experimentalFeatures: boolean;
	safeGuardFeature: boolean;
	lastViewHistory: {
		viewedType: string;
		boardIndex: number;
		settingTab: number;
		taskId?: string;
	};
	boundTaskCompletionToChildTasks: boolean;
	mapView: {
		background: string;
		mapOrientation: string;
		optimizedRender: boolean;
		arrowDirection: mapViewArrowDirection;
		animatedEdges: boolean;
		scrollAction: mapViewScrollAction;
		showMinimap: boolean;
		renderVisibleNodes: boolean;
		edgeType: mapViewEdgeType;
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
	version: "", // Keep this empty only. Change the version number in the runOnPluginUpdate function inside main.ts file whenever you will going to release a new version.
	data: {
		boardConfigs: [
			{
				columns: [
					{
						id: 1,
						colType: colTypeNames.undated,
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
						colType: colTypeNames.dated,
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
						colType: colTypeNames.dated,
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
						colType: colTypeNames.dated,
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
						colType: colTypeNames.dated,
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
						colType: colTypeNames.completed,
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
				boardFilter: {
					rootCondition: "any",
					filterGroups: [],
				},
				swimlanes: {
					enabled: false,
					hideEmptySwimlanes: false,
					property: "tags",
					sortCriteria: "asc",
					minimized: [],
					maxHeight: "300px",
					verticalHeaderUI: false,
				},
			},
			{
				columns: [
					{
						id: 7,
						colType: colTypeNames.untagged,
						active: true,
						collapsed: false,
						name: "Backlogs",
						index: 1,
					},
					{
						id: 8,
						colType: colTypeNames.namedTag,
						active: true,
						collapsed: false,
						name: "Important",
						index: 2,
						coltag: "important",
					},
					{
						id: 9,
						colType: colTypeNames.namedTag,
						active: true,
						collapsed: false,
						name: "WIP",
						index: 3,
						coltag: "wip",
					},
					{
						id: 11,
						colType: colTypeNames.namedTag,
						active: true,
						collapsed: false,
						name: "In Review",
						index: 5,
						coltag: "review",
					},
					{
						id: 12,
						colType: colTypeNames.completed,
						active: true,
						collapsed: false,
						index: 6,
						limit: 20,
						name: "Completed",
					},
				],
				name: "Tag Based Workflow",
				index: 1,
				showColumnTags: false,
				showFilteredTags: true,
				hideEmptyColumns: false,
				boardFilter: {
					rootCondition: "any",
					filterGroups: [],
				},
				swimlanes: {
					enabled: false,
					hideEmptySwimlanes: false,
					property: "tags",
					sortCriteria: "asc",
					minimized: [],
					maxHeight: "300px",
					verticalHeaderUI: false,
				},
			},
			{
				columns: [
					{
						id: 7,
						colType: colTypeNames.taskStatus,
						taskStatus: defaultTaskStatuses.unchecked,
						active: true,
						collapsed: false,
						name: "Backlogs",
						index: 1,
					},
					{
						id: 8,
						colType: colTypeNames.taskStatus,
						taskStatus: defaultTaskStatuses.scheduled,
						active: true,
						collapsed: false,
						name: "Ready to start",
						index: 2,
					},
					{
						id: 9,
						colType: colTypeNames.taskStatus,
						taskStatus: defaultTaskStatuses.inprogress,
						active: true,
						collapsed: false,
						name: "In Progress",
						index: 3,
					},
					{
						id: 11,
						colType: colTypeNames.taskStatus,
						taskStatus: defaultTaskStatuses.question,
						active: true,
						collapsed: false,
						name: "In Review",
						index: 5,
					},
					{
						id: 12,
						colType: colTypeNames.completed,
						active: true,
						collapsed: false,
						index: 6,
						limit: 20,
						name: "Completed",
					},
					{
						id: 13,
						colType: colTypeNames.taskStatus,
						taskStatus: defaultTaskStatuses.dropped,
						active: true,
						collapsed: false,
						name: "Cancelled",
						index: 7,
					},
				],
				name: "Status Based Workflow",
				index: 2,
				showColumnTags: false,
				showFilteredTags: true,
				hideEmptyColumns: false,
				boardFilter: {
					rootCondition: "any",
					filterGroups: [],
				},
				swimlanes: {
					enabled: false,
					hideEmptySwimlanes: false,
					property: "tags",
					sortCriteria: "asc",
					minimized: [],
					maxHeight: "300px",
					verticalHeaderUI: false,
				},
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
			taskCompletionDateTimePattern:
				TaskRegularExpressions.dateTimeFormat,
			dailyNotesPluginComp: false,
			universalDateFormat: TaskRegularExpressions.dateFormat,
			defaultStartTime: "",
			taskCompletionInLocalTime: true,
			taskCompletionShowUtcOffset: false,
			autoAddUniversalDate: true,
			autoAddCreatedDate: false,
			autoAddCompletedDate: false,
			autoAddCancelledDate: false,
			showModifiedFilesNotice: true,
			scanMode: scanModeOptions.AUTOMATIC,
			columnWidth: "300px",
			visiblePropertiesList: [
				taskPropertiesNames.ID,
				taskPropertiesNames.Title,
				taskPropertiesNames.SubTasks,
				taskPropertiesNames.Description,
				taskPropertiesNames.Status,
				taskPropertiesNames.Tags,
				taskPropertiesNames.Priority,
				taskPropertiesNames.CreatedDate,
				taskPropertiesNames.StartDate,
				taskPropertiesNames.ScheduledDate,
				taskPropertiesNames.DueDate,
				taskPropertiesNames.CompletionDate,
				taskPropertiesNames.CancelledDate,
				taskPropertiesNames.Reminder,
				taskPropertiesNames.FilePath,
			],
			taskCardStyle: taskCardStyleNames.EMOJI,
			showVerticalScroll: true,
			tagColors: [
				{
					name: "bug",
					color: "rgba(255, 0, 0, 0.55)",
					priority: 1,
				},
				{
					name: "important",
					color: "rgba(246, 255, 0, 0.53)",
					priority: 2,
				},
				{
					name: "wip",
					color: "rgba(0, 255, 0, 0.53)",
					priority: 2,
				},
				{
					name: "review",
					color: "rgba(0, 0, 255, 0.49)",
					priority: 3,
				},
			],
			editButtonAction: EditButtonMode.Modal,
			doubleClickCardToEdit: EditButtonMode.None,
			universalDate: UniversalDateOptions.dueDate,
			tagColorsType: TagColorType.TagText,
			customStatuses: [
				{
					symbol: defaultTaskStatuses.todo,
					name: "Todo",
					nextStatusSymbol: defaultTaskStatuses.done,
					availableAsCommand: false,
					type: "TODO",
				},
				{
					symbol: defaultTaskStatuses.scheduled,
					name: "Ready to start",
					nextStatusSymbol: defaultTaskStatuses.done,
					availableAsCommand: false,
					type: "TODO",
				},
				{
					symbol: defaultTaskStatuses.question,
					name: "In Review",
					nextStatusSymbol: defaultTaskStatuses.done,
					availableAsCommand: false,
					type: "TODO",
				},
				{
					symbol: defaultTaskStatuses.inprogress,
					name: "In Progress",
					nextStatusSymbol: defaultTaskStatuses.done,
					availableAsCommand: true,
					type: "IN_PROGRESS",
				},
				{
					symbol: defaultTaskStatuses.done,
					name: "Done",
					nextStatusSymbol: defaultTaskStatuses.todo,
					availableAsCommand: true,
					type: "DONE",
				},
				{
					symbol: defaultTaskStatuses.checked,
					name: "Completed",
					nextStatusSymbol: defaultTaskStatuses.todo,
					availableAsCommand: true,
					type: "DONE",
				},
				{
					symbol: defaultTaskStatuses.dropped,
					name: "Cancelled",
					nextStatusSymbol: defaultTaskStatuses.done,
					availableAsCommand: true,
					type: "CANCELLED",
				},
			],
			compatiblePlugins: {
				dailyNotesPlugin: false,
				dayPlannerPlugin: false,
				tasksPlugin: false,
				reminderPlugin: false,
				quickAddPlugin: false,
			},
			taskNoteIdentifierTag: "taskNote",
			preDefinedNote: "Meta/Task_Board/New_Tasks.md",
			archivedTasksFilePath: "",
			taskNoteDefaultLocation: "Meta/Task_Board/Task_Notes",
			archivedTBNotesFolderPath: "Meta/Task_Board/Archived_Task_Notes",
			quickAddPluginDefaultChoice: "",
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
					property: taskItemKeyToNameMapping["completion"],
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
				// {
				// 	index: 14,
				// 	property: taskItemKeyToNameMapping["dateModified"],
				// 	key: DEFAULT_TASK_NOTE_FRONTMATTER_KEYS.dateModified,
				// 	taskItemKey: "",
				// },
			],
			showFrontmatterTagsOnCards: false,
			tasksCacheFilePath: "",
			notificationService: NotificationService.None,
			actions: [
				{
					enabled: true,
					trigger: "Complete",
					type: "move",
					targetColumn: "Completed",
				},
			],
			hiddenTaskProperties: [],
			autoAddUniqueID: false,
			uniqueIdCounter: 0, // Counter to generate unique IDs for tasks. This will keep track of the last used ID. --- IGNORE ---
			experimentalFeatures: false,
			safeGuardFeature: true,
			lastViewHistory: {
				viewedType: "kanban",
				boardIndex: 0,
				settingTab: 0,
			},
			boundTaskCompletionToChildTasks: false,
			mapView: {
				background: mapViewBackgrounVariantTypes.none,
				mapOrientation: mapViewNodeMapOrientation.horizontal,
				optimizedRender: false,
				arrowDirection: mapViewArrowDirection.childToParent,
				animatedEdges: true,
				scrollAction: mapViewScrollAction.zoom,
				showMinimap: true,
				renderVisibleNodes: false,
				edgeType: mapViewEdgeType.bezier,
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
export { taskCardStyleNames };
