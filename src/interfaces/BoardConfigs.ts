// Define the structure of Board, Column, and the Data read from JSON
export type ColumnData = {
	id: number;
	index: number;
	colType: string;
	active: boolean;
	collapsed?: boolean;
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
	limit?: number;
	sort?: {
		criteria: string;
		order: boolean; // Ascending = 0 AND Descending = 1
	};
};

export type Board = {
	name: string;
	index: number;
	columns: ColumnData[];
	filters?: string[];
	filterPolarity?: string;
	filterScope?: string;
	hideEmptyColumns?: boolean;
	showColumnTags?: boolean;
	showFilteredTags?: boolean;
};

export type BoardConfigs = Board[];

export const columnTypeAndNameMapping: { [key: string]: string } = {
	undated: "Undated",
	dated: "Dated",
	namedTag: "Tagged",
	untagged: "Untagged",
	otherTags: "Other Tags",
	taskStatus: "Status",
	taskPriority: "Priority",
	pathFiltered: "Path filtered",
	completed: "Completed",
};
