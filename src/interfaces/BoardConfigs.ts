
export type ColumnData = {
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

export type Board = {
	name: string;
	index: number;
	columns: ColumnData[];
	filters?: string[];
	filterPolarity?: string;
	filterScope?: string;
	showColumnTags?: boolean;
	showFilteredTags?: boolean;
}

export type BoardConfigs = Board[];

