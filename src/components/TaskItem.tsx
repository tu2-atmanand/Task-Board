// /src/components/TaskItem.tsx

import { FaEdit, FaTrash } from 'react-icons/fa'; // Import the desired icons from react-icons
import React, { useState } from 'react';

import { RxDragHandleDots2 } from "react-icons/rx";
import { TaskProps } from '../interfaces/TaskItem';
import { priorityEmojis } from '../interfaces/TaskItem';

const TaskItem: React.FC<TaskProps> = ({ task, onEdit, onDelete, onCheckboxChange }) => {
	// State to handle the checkbox animation
	const [isChecked, setIsChecked] = useState(false);

	// Determine color for the task indicator
	const getColorIndicator = () => {
		const today = new Date();
		const taskDueDate = new Date(task.due);
		// console.log("Today : ", today.toDateString(), " Due : ", taskDueDate.toDateString(), " TASK : ", task.body);

		if (taskDueDate.toDateString() === today.toDateString()) {
			return 'yellow'; // Due today
		} else if (taskDueDate > today) {
			return 'green'; // Due in the future
		} else {
			return 'red'; // Past due
		}
	};

	const handleCheckboxChange = () => {
		setIsChecked(true); // Trigger animation
		setTimeout(() => {
			onCheckboxChange(task); // Call parent function after 1 second
			setIsChecked(false); // Reset checkbox state
		}, 1000); // 1-second delay for animation
	};

	return (
		<div className="taskItem">
			<div className="colorIndicator" style={{ backgroundColor: getColorIndicator() }} />
			<div className="taskItemMainContent">
				<div className="taskItemHeader">
					<div className="taskItemHeaderLeft">
						<div className="taskItemPrio">{task.priority>0 ? priorityEmojis[task.priority] : ''}</div>
						<div className="taskItemTag">{task.tag}</div>
					</div>
					<div className="DragBtn"><RxDragHandleDots2 size={14} /></div>
				</div>
				<div className="taskItemMainBody">
					<input
						type="checkbox"
						checked={isChecked ? !(task.completed) : task.completed}
						className={`taskCheckbox ${isChecked ? 'checked' : ''}`}
						onChange={handleCheckboxChange}
					/>
					<div className="taskItemBody">{task.body}</div>
				</div>
				<div className="taskItemFooter">
					<div className='taskItemDate'>{task.time ? `⏰${task.time}` : ''}  {task.due ? `📅${task.due}` : ''}</div>
					<div className="taskItemFooterBtns">
						<div className="taskItemiconButton" >
							<FaEdit size={16} enableBackground={0} opacity={0.7} onClick={onEdit} title="Edit Task" />
						</div>
						<div className="taskItemiconButton">
							<FaTrash size={13} enableBackground={0} opacity={0.7} onClick={onDelete} title="Delete Task" />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default TaskItem;
