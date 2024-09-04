// Define the structure of Board, Column, and the Data read from JSON
interface ColumnData {
	tag: string;
	data: {
		collapsed: boolean;
		name: string;
		coltag?: string;
		range?: {
			tag: string;
			rangedata: {
				from: number;
				to: number;
			};
		};
		index?: number;
		limit?: number;
	};
}

interface Board {
	name: string;
	columns: ColumnData[];
	filters?: any[];
	filterPolarity?: string;
	filterScope?: string;
	showColumnTags?: boolean;
	showFilteredTags?: boolean;
}

interface BoardConfig {
	boardConfigs: Board[];
}
