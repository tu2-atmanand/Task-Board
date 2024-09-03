// /src/components/TaskItem.tsx

import React from 'react';

interface TaskProps {
	task: {
		id: number;
		body: string;
		due: string;
		tag: string;
	};
	onEdit: () => void;
}

const TaskItem: React.FC<TaskProps> = ({ task, onEdit }) => {
	return (
		<div className="taskItem">
			<div className="taskItemTag">#{task.tag}</div>
			<div className="taskItemBody">{task.body}</div>
			<div className='taskItemDate'>Due: {task.due}</div>
			<button className="editButton" onClick={onEdit}>Edit</button>
		</div>
	);
};

export default TaskItem;
