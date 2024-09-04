interface TaskProps {
	task: {
		id: number;
		body: string;
		due: string;
		tag: string;
	};
	onEdit: () => void;
}
