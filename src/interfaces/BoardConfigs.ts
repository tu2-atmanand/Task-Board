import {
	viewTypeNames,
	colTypeNames,
	HeaderUITypeOptions,
	defaultTaskStatuses,
	viewsPanelPropertiesToShow,
} from "./Enums.js";

export interface columnSortingCriteria {
	criteria:
		| "status"
		| "completed"
		| "priority"
		| "dueDate"
		| "startDate"
		| "scheduledDate"
		| "createdDate"
		| "completedDate"
		| "content"
		| "tags"
		| "project"
		| "context"
		| "time"
		| "recurrence"
		| "filePath"
		| "lineNumber"
		| "manualOrder"
		| "id"; // Fields to sort by
	order: "asc" | "desc"; // Sort order
	priority: number;
	uid: string;
}

// ---------------------------------------------------
//              ADVANCED FILTER
// ---------------------------------------------------

/**
 * The basic entity or reference point, against which we compare the tasks based on their properties.
 * The task will pass through the {@link AdvancedFilter}, only if it satisfies this FilterCriterion.
 */
export interface FilterCriterion {
	id: string;
	property: string; // e.g., 'content', 'dueDate', 'priority'
	condition: string; // e.g., 'isSet', 'equals', 'contains'
	value?: any;
}

/**
 * A collection of {@link FilterCriterion} combined together with either of the following Boolean logic :
 * - OR
 * - AND
 * - NOT
 */
export interface FilterCriterionGroup {
	id: string;
	groupCondition: "all" | "any" | "none"; // How filters within this group are combined
	filters: FilterCriterion[];
}

/**
 * A collection of {@link FilterCriterionGroup} combined together with either of the following Boolean logic :
 * - OR
 * - AND
 * - NOT
 *
 * This is a single complete filter which user can apply to either Board, View or Column.
 * This can also be stored inside the {@link FiltersWarehouse} so it can be accessed by other Boards, Views or Columns.
 */
export interface Filter {
	id: string;
	name: string;
	status: boolean;
	description?: string;
	rootCondition: "all" | "any" | "none"; // How FilterCriterionGroup are combined
	filterGroups: FilterCriterionGroup[];
}

/**
 * A collection of {@link Filter}s arranged in a list format.
 * The order of the Filter inside this list doesnt mean anything.
 * Its just an feature for user to arrange their filters.
 */
export interface AdvancedFilter {
	filters: Filter[];
	rootCondition: "all" | "any" | "none";
}

/**
 * All the {@link Filter} shared from Boards, Views and Columns from across your vault will be stored at plugin level, in this FiltersWarehouse.
 * So, other Boards, Views and Columns can import them.
 */
export type FiltersWarehouse = Filter[];

// Define the structure of Board, Column, and the Data read from JSON
export type ColumnData = {
	id: number;
	index: number;
	colType: string;
	active: boolean;
	collapsed?: boolean;
	minimized?: boolean;
	swimlaneEnabled?: boolean;
	name: string;
	coltag?: string;
	filePaths?: string;
	datedBasedColumn?: {
		dateType: string; // e.g., "due", "created", "scheduled"
		from: number;
		to: number;
	};
	taskStatus?: string;
	taskPriority?: number;
	workLimit?: number;
	limit?: number;
	sortCriteria?: columnSortingCriteria[];
	tasksIdManualOrder?: string[];
	range?: {
		// Keep it for few versions, this is required while settings migrations
		tag: string;
		rangedata: {
			from: number;
			to: number;
		};
	};
	columnFilters?: AdvancedFilter;

	/**
	 * @deprecated - From version 2.0.0 onwards, will be using {@link AdvancedFilter} instead of a single {@link Filter}. Use {@link ColumnData.columnFilters} instead.
	 */
	filters?: Filter;
};

export type swimlaneConfigs = {
	enabled: boolean;
	hideEmptySwimlanes: boolean;
	maxHeight: string;
	property: string; // e.g., 'tags', 'priority'
	customValue?: string; // This is only if user selects "custom" as the property. This is also only applicable in case of dataview format properties or for task-notes, where user can use their custom key-value from frontmatter.
	sortCriteria: string; // e.g., 'asc', 'desc', 'custom'
	customSortOrder?: {
		value: string;
		index: number;
	}[]; // This is only if user selects "custom" as the sort criteria.
	groupAllRest?: boolean; // This will be only visible for customSortOrder. It will help user to decide if they want to group all the rest of the task below the custom sort order.
	headerUIType: string;
	minimized: string[]; // This will store the names of the minimized swimlanes.
};

export type viewPortType = {
	x: number;
	y: number;
	zoom: number;
};

export type nodePositionData = {
	x: number;
	y: number;
	width?: number;
};

export type nodeDataType = {
	[taskID: string]: nodePositionData;
};

export interface MapView {
	viewPortData: viewPortType;
	nodesData: nodeDataType;
}

export interface KanbanView {
	columns: ColumnData[];
	showColumnTags: boolean;
	hideEmptyColumns: boolean;
	swimlanes: swimlaneConfigs;
}

/**
 * Interface for the Task Board view. It will store the data specific to a particular view created by user inside the board.
 */
export interface TaskBoardViewType {
	viewId: string;
	viewIndex: number;
	viewName: string;
	viewType: string;
	description?: string;
	showFilteredTags: boolean;
	taskCount: {
		pending: number;
		completed: number;
	};
	viewFilters: AdvancedFilter;

	// All configurations specific to the kanban view
	kanbanView?: KanbanView;

	/**
	 * All configurations specific to the map view
	 */
	mapView?: MapView;

	// More views will be added in the future

	/**
	 * @deprecated From version 2.0.0 onwards RootFilterState will be deprecated. Use {@link TaskBoardViewType.viewFilters} instead.
	 */
	viewFilter?: RootFilterState;
}

/**
 * The complete data stored inside a .taskboard file inside the vault for a board.
 */
export type Board = {
	id: string;
	/**
	 * This property will help us to manage the migrations in future when we will be adding
	 * new properties to the board or view data structure. Whenever there will be a breaking
	 * change in the data structure, we will update this revision and during the loading of
	 * the board data, we can check this revision number and can decide if we need to run
	 * specific selective migration functions to update the data structure to the latest one.
	 */
	revision: number;
	name: string;
	description?: string;

	views: TaskBoardViewType[];
	lastViewIndex: number;
	viewsPanel: {
		isOpen: boolean;
		width: number;
		propertiesToShow: string[];
		buttonsBelt: boolean;
	};
	boardFilters: AdvancedFilter;

	// TODO : Below settings has been deprecated since version `1.8.0`. Only kept here because of migrations. Remove it while removing the migrations.
	/**
	 * @deprecated Its getting difficult to find the index using the viewId.
	 * Instead we are simply storing the index inside {@link Board.lastViewIndex} itself
	 * and easily fetch it, becauase view index is also rarely going to change.
	 */
	lastViewId?: string;
	/**
	 * A single {@link Filter}.
	 * 
	 * @deprecated This has been replaced by a more advanced design now to have multiple Filters instead of single one. Use {@link Board.boardFilters} instead.
	 */
	boardFilter?: RootFilterState;
	/**
	 * A complete {@link Filter} can be stored inside this filterConfig for future reference. You can give name and description to this filter.
	 *
	 * @deprecated We will no longer going to save filters inside board-level. Instead they will be used at plugin level.
	 * Use {@link FiltersWarehouse} instead.
	 */
	filterConfig?: FilterConfigSettings;
	/**
	 * A list of tags.
	 *
	 * @deprecated We are moving towards {@link AdvancedFilter}.
	 */
	filters?: string[];
	/**
	 * @deprecated We are moving towards {@link AdvancedFilter}.
	 */
	filterPolarity?: string;
	/**
	 * @deprecated Use {@link Board.revision} instead.
	 */
	pluginVersion?: string;
};

// A single board is a single project, inside a board user will create multiple types of views to visualize their tasks in different ways. Hence, when user will install this plugin for the first time, will only going to have a single board to which will be enought show the capabilities of this plugin and later user can easily create more boards.
export const DEFAULT_BOARD: Board = {
	id: "3103563481",
	revision: 0,
	name: "My Project",
	description:
		"This is my personal project. This is a default board created by Task Board for you to kick start your journey with Task Board. Feel free to edit or create new boards.",
	// lastViewId: "3103563482",
	lastViewIndex: 0,
	views: [
		{
			viewId: "3103563482",
			viewIndex: 0,
			viewName: "Time Based Workflow",
			viewType: viewTypeNames.kanban,
			showFilteredTags: true,
			viewFilter: {
				rootCondition: "any",
				filterGroups: [],
			},
			taskCount: {
				pending: 0,
				completed: 0,
			},
			kanbanView: {
				columns: [
					{
						id: 3103563491,
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
						id: 3103563492,
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
						id: 3103563493,
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
						id: 3103563494,
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
						id: 3103563495,
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
						id: 3103563496,
						colType: colTypeNames.completed,
						active: true,
						collapsed: false,
						limit: 20,
						name: "Completed",
						index: 6,
					},
				],
				showColumnTags: false,
				hideEmptyColumns: false,
				swimlanes: {
					enabled: false,
					hideEmptySwimlanes: false,
					property: "tags",
					sortCriteria: "asc",
					minimized: [],
					maxHeight: "300px",
					headerUIType: HeaderUITypeOptions.horizontal,
				},
			},
			viewFilters: {
				filters: [],
				rootCondition: "all",
			},
		},
		{
			viewId: "3103563483",
			viewIndex: 1,
			viewName: "Tag Based Workflow",
			viewType: viewTypeNames.kanban,
			showFilteredTags: true,
			viewFilter: {
				rootCondition: "any",
				filterGroups: [],
			},
			taskCount: {
				pending: 0,
				completed: 0,
			},
			kanbanView: {
				columns: [
					{
						id: 3103563497,
						colType: colTypeNames.untagged,
						active: true,
						collapsed: false,
						name: "Backlogs",
						index: 1,
					},
					{
						id: 3103563498,
						colType: colTypeNames.namedTag,
						active: true,
						collapsed: false,
						name: "Important",
						index: 2,
						coltag: "important",
					},
					{
						id: 3103563499,
						colType: colTypeNames.namedTag,
						active: true,
						collapsed: false,
						name: "WIP",
						index: 3,
						coltag: "wip",
					},
					{
						id: 3103563500,
						colType: colTypeNames.namedTag,
						active: true,
						collapsed: false,
						name: "In Review",
						index: 5,
						coltag: "review",
					},
					{
						id: 3103563501,
						colType: colTypeNames.completed,
						active: true,
						collapsed: false,
						index: 6,
						limit: 20,
						name: "Completed",
					},
				],
				showColumnTags: false,
				hideEmptyColumns: false,
				swimlanes: {
					enabled: false,
					hideEmptySwimlanes: false,
					property: "tags",
					sortCriteria: "asc",
					minimized: [],
					maxHeight: "300px",
					headerUIType: HeaderUITypeOptions.horizontal,
				},
			},
			viewFilters: {
				filters: [],
				rootCondition: "all",
			},
		},
		{
			viewId: "3103563484",
			viewIndex: 2,
			viewName: "Status Based Workflow",
			viewType: viewTypeNames.kanban,
			showFilteredTags: true,
			viewFilter: {
				rootCondition: "any",
				filterGroups: [],
			},
			taskCount: {
				pending: 0,
				completed: 0,
			},
			kanbanView: {
				columns: [
					{
						id: 3103563502,
						colType: colTypeNames.taskStatus,
						taskStatus: defaultTaskStatuses.unchecked,
						active: true,
						collapsed: false,
						name: "Backlogs",
						index: 1,
					},
					{
						id: 3103563503,
						colType: colTypeNames.taskStatus,
						taskStatus: defaultTaskStatuses.scheduled,
						active: true,
						collapsed: false,
						name: "Ready to start",
						index: 2,
					},
					{
						id: 3103563504,
						colType: colTypeNames.taskStatus,
						taskStatus: defaultTaskStatuses.inprogress,
						active: true,
						collapsed: false,
						name: "In Progress",
						index: 3,
					},
					{
						id: 3103563505,
						colType: colTypeNames.taskStatus,
						taskStatus: defaultTaskStatuses.question,
						active: true,
						collapsed: false,
						name: "In Review",
						index: 5,
					},
					{
						id: 3103563506,
						colType: colTypeNames.completed,
						active: true,
						collapsed: false,
						index: 6,
						limit: 20,
						name: "Completed",
					},
					{
						id: 3103563507,
						colType: colTypeNames.taskStatus,
						taskStatus: defaultTaskStatuses.dropped,
						active: true,
						collapsed: false,
						name: "Cancelled",
						index: 7,
					},
				],
				showColumnTags: false,
				hideEmptyColumns: false,
				swimlanes: {
					enabled: false,
					hideEmptySwimlanes: false,
					property: "tags",
					sortCriteria: "asc",
					minimized: [],
					maxHeight: "300px",
					headerUIType: HeaderUITypeOptions.horizontal,
				},
			},
			viewFilters: {
				filters: [],
				rootCondition: "all",
			},
		},
		{
			viewId: "3103563485",
			viewIndex: 3,
			viewName: "Map View",
			viewType: viewTypeNames.map,
			showFilteredTags: true,
			viewFilter: {
				rootCondition: "any",
				filterGroups: [],
			},
			taskCount: {
				pending: 0,
				completed: 0,
			},
			mapView: {
				viewPortData: {
					x: 0,
					y: 0,
					zoom: 1,
				},
				nodesData: {},
			},
			viewFilters: {
				filters: [],
				rootCondition: "all",
			},
		},
	],
	viewsPanel: {
		isOpen: true,
		width: 300,
		propertiesToShow: [
			viewsPanelPropertiesToShow.Title,
			viewsPanelPropertiesToShow.Description,
		],
		buttonsBelt: true,
	},
	boardFilters: {
		filters: [],
		rootCondition: "all",
	},
};

// -------------------------------------------------------
//      ALL DEPRECATED Interfaces and Typings
// -------------------------------------------------------

export interface Filter_Deprecated {
	id: string;
	property: string; // e.g., 'content', 'dueDate', 'priority'
	condition: string; // e.g., 'isSet', 'equals', 'contains'
	value?: any;
}

export interface FilterGroup {
	id: string;
	groupCondition: "all" | "any" | "none"; // How filters within this group are combined
	filters: Filter_Deprecated[];
}

export interface RootFilterState {
	rootCondition: "all" | "any" | "none"; // How filter groups are combined
	filterGroups: FilterGroup[];
}

// Represents a single filter condition UI row
export interface FilterConditionItem {
	property: string; // e.g., 'content', 'dueDate', 'priority', 'tags.myTag'
	operator: string; // e.g., 'contains', 'is', '>=', 'isEmpty'
	value?: any; // Value for the condition, type depends on property and operator
}

// Represents a group of filter conditions in the UI from focus.md
export interface FilterGroupItem {
	logicalOperator: "AND" | "OR"; // How conditions/groups within this group are combined
	items: (FilterConditionItem | FilterGroupItem)[]; // Can contain conditions or nested groups
}

// Top-level filter configuration from the UI from focus.md
export type FilterConfig = FilterGroupItem;

/**
 * @deprecated From version 2.0.0 onwards we are moving towards {@link AdvancedFilters}.
 * Use {@link FiltersWarehouse} instead.
 */
export interface SavedFilterConfig {
	id: string;
	name: string;
	description?: string;
	filterState: RootFilterState;
	createdAt: string;
	updatedAt: string;
}

/**
 * @deprecated From version 2.0.0 onwards we are moving towards {@link AdvancedFilters}.
 * Use {@link FiltersWarehouse} instead.
 */
export interface FilterConfigSettings {
	enableSavedFilters: boolean;
	savedConfigs: SavedFilterConfig[];
}
