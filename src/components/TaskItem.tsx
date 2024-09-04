// /src/components/TaskItem.tsx

import React from 'react';
import { TaskProps } from '../interfaces/TaskItem';

const TaskItem: React.FC<TaskProps> = ({ task, onEdit, onDelete }) => {
	return (
		<div className="taskItem">
			{/* There will be a small Indicator Color bar here, with height 100% and width of 0.5em */}
			<div className="taskItemMainContent">
				<div className="taskItemHeader">
					<div className="taskItemTag">#{task.tag}</div>
					<div className="DragBtn">|||</div>
				</div>
				<div className="taskItemMainBody">
					{/* I want a Checkbox Here */}
					<div className="taskItemBody">{task.body}</div>
				</div>
				<div className="taskItemFooter">
					<div className='taskItemDate'>Due: {task.due}</div>
					<div className="taskItemFooterBtns">
						<button className="editButton" onClick={onEdit}>Edit</button>
						<button className="editButton" onClick={onDelete}>Delete</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default TaskItem;
