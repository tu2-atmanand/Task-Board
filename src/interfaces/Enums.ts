import { SupportedPropertiesConfig } from "./GlobalSettings.js";

export enum taskPropertyFormatOptions {
	default = "1",
	tasksPlugin = "2",
	dataviewPlugin = "3",
	obsidianNative = "4",
}

export enum EditButtonMode {
	None = "none",
	Modal = "popUp",
	ViewInSplitTab = "viewInSplit",
	ViewInWindow = "viewInWindow",
	TasksPluginModal = "tasksPluginModal",
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

export enum TagColorType {
	TagText = "text",
	TagBg = "tagBg",
	CardBg = "background",
}

export enum NotificationService {
	None = "none",
	ReminderPlugin = "reminderPlugin",
	NotifianApp = "notifianApp",
	ObsidApp = "obsiApp",
}

/**
 * These are the main properties stored inside the cache with the exact key name.
 */
export enum DEFAULT_TASK_CACHE_KEYS {
	// Below properties are stored inside cache.
	ID = "id",
	LegacyID = "legacyId",
	Title = "title",
	Body = "body",
	Status = "status",
	Priority = "priority",
	Tags = "tags",
	FrontMatterTags = "frontmatterTags", // This value is not user configurable, they will be stored for internal purposes.
	Time = "time",
	CreatedDate = "createdDate",
	StartDate = "startDate",
	ScheduledDate = "scheduledDate",
	DueDate = "dueDate",
	CompletionDate = "completionDate",
	CancelledDate = "cancelledDate",
	Dependencies = "dependsOn", // TODO : rename this to "childTasks"
	Reminder = "reminder",
	FilePath = "filePath",
	TaskLocation = "taskLocation", // This value is not user configurable, they will be stored for internal purposes.
	
	// Below 4 properties are not supported yet but will be implemented soon.
	LastModified = "lastModified",
	OnCompletion = "onCompletion",
	Recurrence = "recurrence",
	Duration = "duration", // duration in minutes - User can decide whether they want to enter end time or {startTime + Duration}. Also work for {startDate + Duration}, if startDate is stored as date-time.
	
	// ALl below properties are not stored in cache, but this same enum is used at other places hence placing them here.
	Content = "content",
	SubTasks = "subTasks",
	Description = "description",
	ParentTasks = "parentTasks",
	Checkbox = "checkbox",
	CheckboxIcon = "checkboxIcon",
	SubTasksMinimized = "subTasksMinimized",
	DescriptionMinimized = "descriptionMinimized",
	FilePathInHeader = "filePathInHeader",
	ParentFolder = "parentFolder",
	FullPath = "fullPath",
	StartTime = "startTime",
	EndTime = "endTime",
}

export const getAllUIVisibleTaskProperties = (
	supportedProperties: SupportedPropertiesConfig[],
) => {
	return [
		DEFAULT_TASK_CACHE_KEYS.Checkbox,
		DEFAULT_TASK_CACHE_KEYS.SubTasks,
		DEFAULT_TASK_CACHE_KEYS.Description,
		...supportedProperties.map((property) => property.key),
	];
};

export enum DEFAULT_TASK_NOTE_FRONTMATTER_KEYS {
	id = "id",
	title = "title",
	status = "status",
	priority = "priority",
	tags = "tags",
	time = "time",
	reminder = "reminder",
	createdDate = "created-date",
	startDate = "start-date",
	scheduledDate = "scheduled-date",
	due = "due-date",
	dependsOn = "depends-on",
	cancelledDate = "cancelled-date",
	completionDate = "completed-date",
	dateModified = "last-modified",
	filePath = "source-file",
	taskLocation = "task-location",
}

export enum viewTypeNames {
	kanban = "kanban",
	map = "map",
	calendar = "calendar",
	list = "list",
	table = "table",
	inbox = "inbox",

	// Upcoming views...
	gantt = "gantt",
}

/**
 * Collection of status types supported by the plugin.
 */
export enum statusTypeNames {
	TODO = "TODO",
	DONE = "DONE",
	IN_PROGRESS = "IN_PROGRESS",
	ON_HOLD = "ON_HOLD",
	CANCELLED = "CANCELLED",
	NON_TASK = "NON_TASK",
	EMPTY = "EMPTY",
}

export enum colTypeNames {
	undated = "undated",
	dated = "dated",
	namedTag = "namedTag",
	untagged = "untagged",
	otherTags = "otherTags",
	taskStatus = "taskStatus",
	taskPriority = "taskPriority",
	pathFiltered = "pathFiltered",
	completed = "completed",
	allPending = "allPending",
}

export enum mapViewBackgrounVariantTypes {
	lines = "lines",
	dots = "dots",
	cross = "cross",
	none = "none",
	transparent = "transparent",
}

export enum mapViewNodeMapOrientation {
	horizontal = "hor",
	vertical = "ver",
}

export enum mapViewScrollAction {
	zoom = "zoom",
	pan = "pan",
}

export enum mapViewArrowDirection {
	parentToChild = "p2c",
	childToParent = "c2p",
	bothWay = "both",
}

export enum mapViewEdgeType {
	straight = "straight",
	step = "step",
	smoothstep = "smoothstep",
	bezier = "default",
}

export enum taskCardStyleNames {
	EMOJI = "emoji",
	ICONS = "icons",
	BASES = "bases",
}

export enum onCompletionOptions {
	NONE = 0,
	keep = 1,
	delete = 2,
	archive = 3,
}

export enum scanModeOptions {
	REAL_TIME = "realtime",
	AUTOMATIC = "automatic",
	MANUAL = "manual",
}

export enum HeaderUITypeOptions {
	horizontal = "hor",
	vertical = "vert",
}

export enum viewsPanelPropertiesToShow {
	Title = "title",
	Description = "description",
	progress = "progress",
	CreatedDate = "createdDate",
	ModifiedDate = "modifiedDate",
}

export enum RibbonIconActions {
	lastBoard = "lastBoard",
	allBoardsMenu = "menu",
	boardsExplorer = "explorer",
}

export enum HeaderTruncationOptions {
	start = "start",
	middle = "middle",
	end = "end",
}

/**
 * Enum of all types of values supported by Task Board for Task properties.
 *
 * Current supported types are :
 * - Text (string)
 * - Numeric
 * - Boolean
 * - Time (Format will be used from settings configured by user)
 * - Date (Format will be used from settings configured by user)
 * - Date-time (Date and time together. Format will be used from setting)
 * - List (Only string value list. Example for tags and dependOn values list)
 */
export enum PropertyTypeConfig {
	text = "text",
	boolean = "boolean",
	numeric = "numeric",
	time = "time", // Stored as string
	date = "date", // Stored as string
	dateTime = "date-time", // Stored as string
	list = "list", // All values will be converted to string.
}
