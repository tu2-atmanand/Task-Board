export interface ColumnProps {
	activeBoard: number;
	colType: string;
	active?: boolean;
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
}

export interface Task {
	id: number;
	title: string;
	body: string[];
	due: string;
	tag: string;
	filePath: string;
	completed: string;
	time: string;
	priority: number;
}
