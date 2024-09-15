// Define the structure of Board, Column, and the Data read from JSON
export interface ColumnData {
	colType: string;
	active: boolean;
	data: {
		collapsed?: boolean;
		name: string;
		index: number;
		coltag: string;
		range?: {
			tag: string;
			rangedata: {
				from: number;
				to: number;
			};
		};
		limit?: number;
	};
}

export interface Board {
	name: string;
	index: number;
	columns: ColumnData[];
	filters?: any[];
	filterPolarity?: string;
	filterScope?: string;
	showColumnTags?: boolean;
	showFilteredTags?: boolean;
}

export interface BoardConfig {
	boardConfigs: Board[];
}
