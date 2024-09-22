export interface ColumnProps {
	colType: string;
	active?: boolean;
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
