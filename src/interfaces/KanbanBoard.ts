// Define the structure of Board, Column, and the Data read from JSON
export interface ColumnData {
	colType: string;
	active: boolean;
	collapsed?: boolean;
	data: {
		name: string;
		index: number;
		coltag?: string;
		range?: {
			tag: string;
			rangedata: {
				from: number;
				to: number;
			};
		};
		limit?: number;
	};
	sort?: {
		criteria: string;
		order: boolean; // Ascending = 0 AND Descending = 1
	};
}

export interface Board {
	name: string;
	index: number;
	columns: ColumnData[];
	filters?: string[];
	filterPolarity?: string;
	filterScope?: string;
	showColumnTags?: boolean;
	showFilteredTags?: boolean;
}

export interface BoardConfig {
	boardConfigs: Board[];
}
