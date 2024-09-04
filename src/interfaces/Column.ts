interface ColumnProps {
	tag: string;
	data: {
		collapsed: boolean;
		name: string;
		coltag: string;
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

interface Task {
	id: number;
	body: string;
	due: string;
	tag: string;
	filePath: string;
	status: string;
}
