import React from 'react';
import { FaEdit, FaTrash } from 'react-icons/fa'; // Import the desired icons from react-icons
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
						{/* Icon button for Edit with hover tooltip */}
						<button
							className="taskItemiconButton"
							onClick={onEdit}
							title="Edit Task"
						>
							<FaEdit />
						</button>

						{/* Icon button for Delete with hover tooltip */}
						<button
							className="taskItemiconButton"
							onClick={onDelete}
							title="Delete Task"
						>
							<FaTrash />
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default TaskItem;
