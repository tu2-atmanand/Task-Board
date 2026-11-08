import { TASKS_PLUGIN_DEFAULT_SYMBOLS } from "../regularExpressions/TasksPluginRegularExpr.js";
import { Filter } from "./BoardConfigs.js";
import { DEFAULT_DATE_FORMAT, DEFAULT_DATE_TIME_FORMAT } from "./Constants.js";
import {
	EditButtonMode,
	TagColorType,
	DEFAULT_TASK_CACHE_KEYS,
	mapViewArrowDirection,
	mapViewScrollAction,
	mapViewEdgeType,
	taskPropertyFormatOptions,
	scanModeOptions,
	taskCardStyleNames,
	UniversalDateOptions,
	DEFAULT_TASK_NOTE_FRONTMATTER_KEYS,
	NotificationService,
	mapViewBackgrounVariantTypes,
	mapViewNodeMapOrientation,
	RibbonIconActions,
	statusTypeNames,
	PropertyTypeConfig,
	DefaultLucideIconsForProperties,
} from "./Enums.js";
import { defaultTaskStatuses, taskItemKeyToNameMapping } from "./Mapping.js";

export type VaultScannnerFilters = {
	files: {
		polarity: number;
		values: string[];
	};
	folders: {
		polarity: number;
		values: string[];
	};
	frontmatter: {
		polarity: number;
		values: string[];
	};
	tags: {
		polarity: number;
		values: string[];
	};
};

export interface TagColor {
	name: string;
	color: string;
	priority: number;
}

/**
 * Interface for storing configuration of each task property which is supported by Task Board.
 * This can be default ones or custom properties added by user.
 */
export interface SupportedPropertiesConfig {
	key: string; // This is the value used to store this property in task cache. For customProperties, this will be same as id below.
	id: string; // for frontmatter, dataview format inline-tasks and other use-cases
	name: string; // which will be visible in UI
	desc: string; // If user wants to explain something about the property.
	type: PropertyTypeConfig; // Will be used to give proper format values and provide correct vaule selectors
	emoji: string; // Specifically if user is using Tasks plugin format for their inline-tasks.
	icon: string; // Lucide icon id for the specific property
	hidePropertyInNotesForInlineTasks: boolean; // Specifically used for inline-tasks to hide properties inside notes. This setting will going to replace this.plugin.settings.data.propertiesHiddenInNotes.
	defaultValue: string | number | string[]; // This can be an exact value or a template text which will be resolved during execution.
	rank: number; // This will mostly be used for task-notes to format the frontmatter, so the properties stays in a defined order.
}

export interface CustomStatus {
	symbol: string; // The symbol representing the status (e.g., "/", "-")
	name: string; // The human-readable name of the status (e.g., "In Progress")
	nextStatusSymbol: string; // The symbol representing the next status in the workflow (e.g., "x")
	availableAsCommand: boolean; // Whether this status is available as a command in Obsidian
	type: statusTypeNames; // The type/category of the status (e.g., "IN_PROGRESS", "CANCELLED")
	lucideIcon: string; // Lucide icon id
}

export interface RecurrenceConfigs {
	frequency: string; // Daily, Weekly, Monthly, Yearly
}

export interface TaskBoardAction {
	enabled: boolean;
	trigger: "Complete" | "Incomplete";
	type: "move" | "copy";
	targetColumn: string;
}
/**
 * Interface for storing the mapping of default supported task properties and their key.
 * The key will be used in the frontmatter for creating task-notes. And the index will
 * be used to keep a fixed order when a specific task properties are added to the task-
 * note.
 * 
 * @deprecated - This complete setting has been deprecated in 2.0.0. 
 * Use {@link SupportedPropertiesConfig} for both the 
 * {@link globalSettingsData.defaultProperties} and {@link globalSettingsData.customProperties}.
 */
export interface FrontmatterFormattingInterface {
	index: number;
	property: string;
	key: string;
	taskItemKey: string;
}

export interface taskBoardFilesRegistryType {
	[boardId: string]: {
		boardId: string;
		filePath: string;
		boardName: string;
		boardDescription: string;
	};
}

export interface globalSettingsData {
	// General Tab
	scanFilters: VaultScannnerFilters;
	scanMode: scanModeOptions;
	autoAddUniqueID: boolean;
	uniqueIdCounter: number; // Counter to generate unique IDs for tasks. This will keep track of the last used ID.
	openOnStartup: boolean;
	showModifiedFilesNotice: boolean;
	ribbonIconAction: RibbonIconActions;
	lang: string;
	tasksCacheFilePath: string;
	safeGuardFeature: boolean;

	// All UI Tab
	taskCardStyle: taskCardStyleNames;
	showTaskWithoutMetadata: boolean;
	columnWidth: string;
	showVerticalScroll: boolean;
	editButtonAction: EditButtonMode;
	cardDoubleClickAction: EditButtonMode;
	tagColorsType: TagColorType;
	tagColors: TagColor[];

	// Properties Tab
	defaultProperties: SupportedPropertiesConfig[];
	customProperties: SupportedPropertiesConfig[];
	customStatuses: CustomStatus[];

	// Views
	//     Map View
	mapView: {
		renderVisibleNodes: boolean;
		scrollAction: mapViewScrollAction;
		background: mapViewBackgrounVariantTypes;
		mapOrientation: mapViewNodeMapOrientation;
		arrowDirection: mapViewArrowDirection;
		edgeType: mapViewEdgeType;
		animatedEdges: boolean;
		showMinimap: boolean;
	};

	// Inline Tasks Tab
	taskPropertyFormat: taskPropertyFormatOptions;
	preDefinedNote: string;
	archivedTasksFilePath: string;
	showFrontmatterTagsOnCards: boolean;
	propertiesHiddenInNotes: DEFAULT_TASK_CACHE_KEYS[];

	// Task Notes Tab
	taskNoteIdentifierTag: string;
	taskNoteDefaultLocation: string;
	archivedTBNotesFolderPath: string;
	frontmatterFormatting: FrontmatterFormattingInterface[];

	// Automations
	boundTaskCompletionToChildTasks: boolean;
	autoAddUniversalDate: boolean;
	autoAddCreatedDate: boolean;
	autoAddCompletedDate: boolean;
	autoAddCancelledDate: boolean;
	// Plugins Compatibility
	compatiblePlugins: {
		dailyNotesPlugin: boolean;
		dayPlannerPlugin: boolean;
		tasksPlugin: boolean;
		reminderPlugin: boolean;
		quickAddPlugin: boolean;
	};
	dailyNotesPluginComp: boolean; // TODO : Remove this duplicate
	quickAddPluginDefaultChoice: string;

	// Formats
	universalDate: UniversalDateOptions;
	dateFormat: string;
	dateTimeFormat: string;
	defaultStartTime: string;
	firstDayOfWeek?: string;
	// TODO : Below 3 settings not implemented yet
	ignoreFileNameDates: boolean;
	taskCompletionInLocalTime: boolean;
	taskCompletionShowUtcOffset: boolean;

	// Experimental Tab
	experimentalFeatures: boolean;

	// Other Caching Settings
	propertiesVisibleInUI: DEFAULT_TASK_CACHE_KEYS[]; // TODO : Need to move this setting to view specific.
	dragAutoScrollEdgePercent: number;
	notificationService: NotificationService;
	actions: TaskBoardAction[];
	searchQuery?: string;
	lastViewHistory: {
		boardFilePath: string;
		settingTab: number;
		taskId?: string;
	};
	// New settings introduced in 2.x.x series
	taskBoardFilesRegistry: taskBoardFilesRegistryType;
	enableDragnDropTouch: boolean;
	filtersWarehouse: Filter[];
	// scanVaultAtStartup: boolean; - @deprecated v1.9.0 - A better approach has been used using showModifiedFilesNotice feature.
}

// Define the interface for GlobalSettings based on your JSON structure
export interface PluginDataJson {
	version: string;
	data: globalSettingsData;
}

/**
 * @note There are hardcoded ids present in this data
 * If you are changing the below configs, make sure the ids of
 * two different objects are different.
 */
export const DEFAULT_SETTINGS: PluginDataJson = {
	version: "", // Keep this empty only. Change the version number in the runOnPluginUpdate function inside main.ts file whenever you will going to release a new version.
	data: {
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
			frontmatter: {
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
		dailyNotesPluginComp: false,
		dateFormat: DEFAULT_DATE_FORMAT,
		dateTimeFormat: DEFAULT_DATE_TIME_FORMAT,
		defaultStartTime: "",
		taskCompletionInLocalTime: true,
		taskCompletionShowUtcOffset: false,
		autoAddUniversalDate: true,
		autoAddCreatedDate: false,
		autoAddCompletedDate: false,
		autoAddCancelledDate: false,
		showModifiedFilesNotice: false,
		scanMode: scanModeOptions.AUTOMATIC,
		columnWidth: "300px",
		propertiesVisibleInUI: [
			DEFAULT_TASK_CACHE_KEYS.Checkbox,
			DEFAULT_TASK_CACHE_KEYS.ID,
			DEFAULT_TASK_CACHE_KEYS.Title,
			DEFAULT_TASK_CACHE_KEYS.SubTasksMinimized,
			DEFAULT_TASK_CACHE_KEYS.DescriptionMinimized,
			DEFAULT_TASK_CACHE_KEYS.Status,
			DEFAULT_TASK_CACHE_KEYS.Tags,
			DEFAULT_TASK_CACHE_KEYS.Time,
			DEFAULT_TASK_CACHE_KEYS.Reminder,
			DEFAULT_TASK_CACHE_KEYS.Priority,
			DEFAULT_TASK_CACHE_KEYS.CreatedDate,
			DEFAULT_TASK_CACHE_KEYS.StartDate,
			DEFAULT_TASK_CACHE_KEYS.ScheduledDate,
			DEFAULT_TASK_CACHE_KEYS.DueDate,
			DEFAULT_TASK_CACHE_KEYS.CompletionDate,
			DEFAULT_TASK_CACHE_KEYS.CancelledDate,
			DEFAULT_TASK_CACHE_KEYS.Dependencies,
			DEFAULT_TASK_CACHE_KEYS.FilePath,
		],
		taskCardStyle: taskCardStyleNames.EMOJI,
		showVerticalScroll: true,
		dragAutoScrollEdgePercent: 20,
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
				priority: 3,
			},
			{
				name: "review",
				color: "rgba(0, 0, 255, 0.49)",
				priority: 4,
			},
		],
		editButtonAction: EditButtonMode.Modal,
		cardDoubleClickAction: EditButtonMode.None,
		universalDate: UniversalDateOptions.dueDate,
		tagColorsType: TagColorType.TagText,
		customStatuses: [
			{
				symbol: defaultTaskStatuses.todo,
				name: "Todo",
				nextStatusSymbol: defaultTaskStatuses.done,
				availableAsCommand: false,
				type: statusTypeNames.TODO,
				lucideIcon: "",
			},
			{
				symbol: defaultTaskStatuses.scheduled,
				name: "Ready to start",
				nextStatusSymbol: defaultTaskStatuses.done,
				availableAsCommand: false,
				type: statusTypeNames.TODO,
				lucideIcon: "",
			},
			{
				symbol: defaultTaskStatuses.question,
				name: "In Review",
				nextStatusSymbol: defaultTaskStatuses.done,
				availableAsCommand: false,
				type: statusTypeNames.TODO,
				lucideIcon: "",
			},
			{
				symbol: defaultTaskStatuses.inprogress,
				name: "In Progress",
				nextStatusSymbol: defaultTaskStatuses.done,
				availableAsCommand: true,
				type: statusTypeNames.IN_PROGRESS,
				lucideIcon: "",
			},
			{
				symbol: defaultTaskStatuses.done,
				name: "Done",
				nextStatusSymbol: defaultTaskStatuses.todo,
				availableAsCommand: true,
				type: statusTypeNames.DONE,
				lucideIcon: "",
			},
			{
				symbol: defaultTaskStatuses.checked,
				name: "Completed",
				nextStatusSymbol: defaultTaskStatuses.todo,
				availableAsCommand: true,
				type: statusTypeNames.DONE,
				lucideIcon: "",
			},
			{
				symbol: defaultTaskStatuses.dropped,
				name: "Cancelled",
				nextStatusSymbol: defaultTaskStatuses.done,
				availableAsCommand: true,
				type: statusTypeNames.CANCELLED,
				lucideIcon: "",
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
		propertiesHiddenInNotes: [],
		autoAddUniqueID: false,
		uniqueIdCounter: 0, // Counter to generate unique IDs for tasks. This will keep track of the last used ID. --- IGNORE ---
		experimentalFeatures: false,
		safeGuardFeature: true,
		lastViewHistory: {
			boardFilePath:
				"Meta/Task_Board/Boards/Time Based Workflow.taskboard",
			settingTab: 0,
		},
		boundTaskCompletionToChildTasks: false,
		mapView: {
			background: mapViewBackgrounVariantTypes.none,
			mapOrientation: mapViewNodeMapOrientation.horizontal,
			arrowDirection: mapViewArrowDirection.childToParent,
			animatedEdges: true,
			scrollAction: mapViewScrollAction.zoom,
			showMinimap: true,
			renderVisibleNodes: false,
			edgeType: mapViewEdgeType.bezier,
		},
		taskBoardFilesRegistry: {
			"3103563481": {
				boardId: "board_3103563481",
				filePath: "Meta/Task_Board/Boards/My Project Board.taskboard",
				boardName: "Time Based Workflow",
				boardDescription:
					"This board contains dated type columns for managing time critical scheduled tasks.",
			},
		},
		enableDragnDropTouch: false,
		filtersWarehouse: [],
		ribbonIconAction: RibbonIconActions.allBoardsMenu,
		defaultProperties: [
			{
				key: DEFAULT_TASK_CACHE_KEYS.ID,
				id: DEFAULT_TASK_NOTE_FRONTMATTER_KEYS.id,
				name: taskItemKeyToNameMapping["id"],
				desc: "Property to apply a uniqu ID to the task to explicitely identify and find it from whole vault. Will be also used for other features.",
				type: PropertyTypeConfig.text,
				emoji: TASKS_PLUGIN_DEFAULT_SYMBOLS.idSymbol,
				hidePropertyInNotesForInlineTasks: false,
				icon: DefaultLucideIconsForProperties.id,
				defaultValue: "",
				rank: 1,
			},
		],
		customProperties: [],
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
