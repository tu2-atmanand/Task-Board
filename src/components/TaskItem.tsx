// /src/components/TaskItem.tsx

import { FaEdit, FaTrash } from 'react-icons/fa'; // Import the desired icons from react-icons
import React, { useState } from 'react';

import { RxDragHandleDots2 } from "react-icons/rx";
import { TaskProps } from '../interfaces/TaskItem';
import { priorityEmojis } from '../interfaces/TaskItem';

const TaskItem: React.FC<TaskProps> = ({ task, onEdit, onDelete, onCheckboxChange }) => {
	// State to handle the checkbox animation
	const [isChecked, setIsChecked] = useState(false);
	const [taskBody, setTaskBody] = useState<string[]>(task.body);

	// Determine color for the task indicator
	const getColorIndicator = () => {
		const today = new Date();
		const taskDueDate = new Date(task.due);
		if (taskDueDate.toDateString() === today.toDateString()) {
			return 'yellow'; // Due today
		} else if (taskDueDate > today) {
			return 'green'; // Due in the future
		} else if (taskDueDate < today) {
			return 'red'; // Past due
		} else {
			return 'grey';
		}
	};

	const handleCheckboxChange = () => {
		setIsChecked(true); // Trigger animation
		setTimeout(() => {
			onCheckboxChange(task); // Call parent function after 1 second
			setIsChecked(false); // Reset checkbox state
		}, 1000); // 1-second delay for animation
	};

	// Function to handle the checkbox toggle inside the task body
	const handleSubtaskCheckboxChange = (index: number, isCompleted: boolean) => {
		const updatedBody = taskBody.map((line, idx) => {
			if (idx === index) {
				if (isCompleted) {
					// Mark as incomplete (change from '- [x]' to '- [ ]')
					return line.replace('- [x]', '- [ ]');
				} else {
					// Mark as complete (change from '- [ ]' to '- [x]')
					return line.replace('- [ ]', '- [x]');
				}
			}
			return line;
		});
		setTaskBody(updatedBody);
	};

	// Render sub-tasks and remaining body separately
	const renderTaskBody = () => {
		try {
			if(taskBody.length > 0) {
				const subTasks = taskBody.filter(line => line.startsWith('- [ ]') || line.startsWith('- [x]'));
				const otherBody = taskBody.filter(line => !line.startsWith('- [ ]') && !line.startsWith('- [x]'));
		
				return (
					<>
						{/* Render sub-tasks first */}
						{subTasks.map((line, index) => {
							const isCompleted = line.startsWith('- [x]');
							const subtaskText = line.replace(/- \[.\] /, ''); // Remove the '- [ ]' or '- [x]' prefix
							return (
								<div key={index}>
									<input
										type="checkbox"
										checked={isCompleted}
										onChange={() => handleSubtaskCheckboxChange(index, isCompleted)}
									/>
									<span>{subtaskText}</span>
								</div>
							);
						})}
		
						{/* Add an empty line between sub-tasks and the rest of the body */}
						{subTasks.length > 0 && otherBody.length > 0 && <br />}
		
						{/* Render remaining body content */}
						{otherBody.map((line, index) => (
							<div key={subTasks.length + index}>
								<span>{line}</span>
							</div>
						))}
					</>
				);
			} else {
				return "";
			}
		} catch (error) {
			console.log("Getting error while trying to print the body : ", error);
		}
	};

	return (
		<div className="taskItem">
			<div className="colorIndicator" style={{ backgroundColor: getColorIndicator() }} />
			<div className="taskItemMainContent">
				<div className="taskItemHeader">
					<div className="taskItemHeaderLeft">
						<div className="taskItemPrio">{task.priority > 0 ? priorityEmojis[task.priority as number] : ''}</div>
						<div className="taskItemTag">{task.tag}</div>
					</div>
					<div className="DragBtn"><RxDragHandleDots2 size={14} /></div>
				</div>
				<div className="taskItemMainBody">
					<input
						type="checkbox"
						checked={task.completed ? true : false}
						className={`taskCheckbox ${isChecked ? 'checked' : ''}`}
						onChange={handleCheckboxChange}
					/>
					<div className="taskItemBodyContent">
						<div className="taskItemTitle">{task.title}</div>
						<div className="taskItemBody">
							{renderTaskBody()}
						</div>
					</div>
				</div>
				<div className="taskItemFooter">
					{/* Conditionally render task.completed or the date/time */}
					{task.completed ? (
						<div className='taskItemDateCompleted'>✅ {task.completed}</div>
					) : (
						<div className='taskItemDate'>
							{task.time ? `⏰${task.time}` : ''}
							{task.due ? `📅${task.due}` : ''}
						</div>
					)}
					<div className="taskItemFooterBtns">
						<div className="taskItemiconButton">
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
