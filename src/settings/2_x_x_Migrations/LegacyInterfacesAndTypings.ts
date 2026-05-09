import {
	ColumnData,
	RootFilterState,
	FilterConfigSettings,
	swimlaneConfigs,
} from "../../interfaces/BoardConfigs.js";
import {
	EditButtonMode,
	TagColorType,
	taskPropertiesNames,
	mapViewArrowDirection,
	mapViewScrollAction,
	mapViewEdgeType,
} from "../../interfaces/Enums.js";
import {
	ScanFilters,
	TagColor,
	CustomStatus,
	FrontmatterFormattingInterface,
	TaskBoardAction,
} from "../../interfaces/GlobalSettings.js";

export type BoardLegacy = {
	name: string;
	description?: string;
	index: number;
	columns: ColumnData[];
	hideEmptyColumns: boolean;
	showColumnTags: boolean;
	showFilteredTags: boolean;
	boardFilter: RootFilterState;
	filterConfig?: FilterConfigSettings;
	taskCount?: {
		pending: number;
		completed: number;
	};
	swimlanes: swimlaneConfigs;
	// TODO : Below two settings has been deprecated since version `1.8.0`. Only kept here because of migrations. Remove it while removing the migrations.
	filters?: string[];
	filterPolarity?: string;
};

export type BoardConfigsLegacy = BoardLegacy[];

export interface globalSettingsDataLegacy {
	openOnStartup: boolean;
	lang: string;
	scanFilters: ScanFilters;
	firstDayOfWeek?: string;
	ignoreFileNameDates: boolean;
	taskPropertyFormat: string;
	dateFormat: string;
	dateTimeFormat: string;
	dailyNotesPluginComp: boolean;
	defaultStartTime: string;
	taskCompletionInLocalTime: boolean;
	taskCompletionShowUtcOffset: boolean;
	autoAddUniversalDate: boolean;
	autoAddCreatedDate: boolean;
	autoAddCompletedDate: boolean;
	autoAddCancelledDate: boolean;
	// scanVaultAtStartup: boolean; -- @deprecated v1.9.0 - A better approach has been used using showModifiedFilesNotice feature.
	showModifiedFilesNotice: boolean;
	scanMode: string;
	columnWidth: string;
	visiblePropertiesList: string[];
	taskCardStyle: string;
	showVerticalScroll: boolean;
	dragAutoScrollEdgePercent: number;
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
	frontmatterFormatting: FrontmatterFormattingInterface[];
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

export interface PluginDataJsonLegacy {
	version: string;
	data: {
		boardConfigs: BoardConfigsLegacy;
		globalSettings: globalSettingsDataLegacy;
	};
}
