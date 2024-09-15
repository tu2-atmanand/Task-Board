export interface TaskProps {
	task: {
		id: number;
		body: string;
		due: string;
		tag: string;
		time: string;
		priority: number;
	};
	onEdit: () => void;
	onDelete: () => void;
	onCheckboxChange: () => void;
}

export const priorityEmojis = {
	0: "0",
	1: "🔺",
	2: "⏫",
	3: "🔼",
	4: "🔽",
	5: "⏬",
};
