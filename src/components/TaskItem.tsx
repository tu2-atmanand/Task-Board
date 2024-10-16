// /src/components/TaskItem.tsx

import { FaEdit, FaTrash } from 'react-icons/fa'; // Import the desired icons from react-icons
import React, { useEffect, useRef, useState } from 'react';
import { TaskProps, taskItem } from '../interfaces/TaskItemProps';
import { hookMarkdownLinkMouseEventHandlers, markdownButtonHoverPreviewEvent } from 'src/services/MarkdownHoverPreview';

import { Component } from 'obsidian';
import { MarkdownUIRenderer } from 'src/services/MarkdownUIRenderer';
import { RxDragHandleDots2 } from "react-icons/rx";
import { priorityEmojis } from '../interfaces/TaskItemProps';

const TaskItem: React.FC<TaskProps> = ({ app, plugin, task, onEdit, onDelete, onCheckboxChange, onSubTasksChange }) => {
	// State to handle the checkbox animation
	const [updatedTask, setTask] = useState<taskItem>(task);
	const [isChecked, setIsChecked] = useState(false);
	const [taskDesc, setTaskDesc] = useState<string[]>(task.body.filter(line => (!line.startsWith('- [ ]') && !line.startsWith('- [x]'))));
	const [subTasks, setSubTasks] = useState<string[]>(task.body.filter(line => (line.startsWith('- [ ]') || line.startsWith('- [x]'))));
	const [taskBody, setTaskBody] = useState<string[]>(task.body)
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false); // State to track description visibility


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
		const updatedSubTasks = subTasks.map((line, idx) => {
			if (idx === index) {
				return isCompleted ? line.replace('- [x]', '- [ ]') : line.replace('- [ ]', '- [x]');
			}
			return line;
		});
		setSubTasks(updatedSubTasks);

		// Update the task with new body content
		const updatedTask: taskItem = { ...task, body: [...taskDesc, ...updatedSubTasks] };
		onSubTasksChange(updatedTask);
	};

	// Toggle function to expand/collapse the description
	const toggleDescription = () => {
		setIsDescriptionExpanded(!isDescriptionExpanded);
	};

	const taskItemBodyDescriptionRenderer = useRef<HTMLDivElement>(null);
	const subtaskTextRefs = useRef<(HTMLDivElement | null)[]>([]);  // Store refs for each subtask text element
	const componentRef = useRef<Component | null>(null);
	useEffect(() => {
		// Initialize Obsidian Component on mount
		componentRef.current = new Component();
		componentRef.current.load();

		return () => {
			// Cleanup the component on unmount
			componentRef.current?.unload();
		};
	}, []);

	useEffect(() => {
		// Render subtasks after componentRef is initialized
		subTasks.forEach((subtaskText, index) => {
			const element = subtaskTextRefs.current[index];
			if (element && componentRef.current) {
				element.innerHTML = '';

				subtaskText = subtaskText.replace(/- \[.*?\]/, "").trim();

				MarkdownUIRenderer.renderSubtaskText(
					app,
					subtaskText, // Pass individual subtask text here
					element,
					task.filePath,
					componentRef.current
				);

				hookMarkdownLinkMouseEventHandlers(app, element, task.filePath, task.filePath);
			}
		});
	}, [subTasks, task.filePath, app]);

	useEffect(() => {
		if (taskItemBodyDescriptionRenderer.current && componentRef.current) {
			taskItemBodyDescriptionRenderer.current.innerHTML = ''; // Clear existing content

			// Call the MarkdownUIRenderer to render the description
			MarkdownUIRenderer.renderTaskDisc(
				app,
				taskDesc.join('\n'),
				taskItemBodyDescriptionRenderer.current, // Use HTMLDivElement reference
				task.filePath,
				componentRef.current // Pass the Component instance
			);

			hookMarkdownLinkMouseEventHandlers(app, taskItemBodyDescriptionRenderer.current, task.filePath, task.filePath);
		}
	}, [taskDesc, task.filePath, app]);


	const handleMouseEnter = (event: React.MouseEvent) => {
		const element = document.getElementById('taskItemFooterBtns');
		if (element) {
			markdownButtonHoverPreviewEvent(app, event, element, task.filePath);
		}
	};

	// Render Header based on the settings
	const renderHeader = () => {
		try {
			if (plugin.settings.data.globalSettings.showHeader) {
				return (
					<>
						<div className="taskItemHeader">
							<div className="taskItemHeaderLeft">
								<div className="taskItemPrio">{task.priority > 0 ? priorityEmojis[task.priority as number] : ''}</div>
								<div className="taskItemTag">{task.tag}</div>
							</div>
							<div className="taskItemDragBtn"><RxDragHandleDots2 size={14} /></div>
						</div>
					</>
				);
			} else {
				return null
			}
		} catch (error) {
			console.log("Getting error while trying to render Header : ", error);
			return null;
		}
	};

	// Render Footer based on the settings
	const renderFooter = () => {
		try {
			if (plugin.settings.data.globalSettings.showFooter) {
				return (
					<>
						<div className="taskItemFooter">
							{/* Conditionally render task.completed or the date/time */}
							{task.completed ? (
								<div className='taskItemDateCompleted'>✅ {task.completed}</div>
							) : (
								<div className='taskItemDate'>
									{task.time ? `⏰${task.time} | ` : ''}
									{task.due ? `📅${task.due}` : ''}
								</div>
							)}
							<div className="taskItemFooterBtns" onMouseOver={handleMouseEnter}>
								<div id="taskItemFooterBtns" className="taskItemiconButton taskItemiconButtonEdit">
									<FaEdit size={16} enableBackground={0} opacity={0.7} onClick={onEdit} title="Edit Task" />
								</div>
								<div className="taskItemiconButton">
									<FaTrash size={13} enableBackground={0} opacity={0.7} onClick={onDelete} title="Delete Task" />
								</div>
							</div>
						</div>
					</>
				);
			} else {
				return null
			}
		} catch (error) {
			console.log("Getting error while trying to render Footer : ", error);
			return null;
		}
	};

	// Render sub-tasks and remaining body separately
	const renderSubTasks = () => {
		try {
			if (taskBody.length > 0) {
				return (
					<>
						{subTasks.map((line, index) => {
							const isCompleted = line.startsWith('- [x]');
							const subtaskText = line.replace(/- \[.\] /, '');
							return (
								<div className="taskItemBodySubtaskItem" key={index}>
									<input
										type="checkbox"
										className="taskItemBodySubtaskItemCheckbox"
										checked={isCompleted}
										onChange={() => handleSubtaskCheckboxChange(index, isCompleted)}
									/>
									{/* Render each subtask separately */}
									<div
										className="subtaskTextRenderer"
										ref={(el) => (subtaskTextRefs.current[index] = el)}  // Assign each subtask its own ref
									/>
								</div>
							);
						})}
					</>
				);
			} else {
				return null
			}
		} catch (error) {
			console.log("Getting error while trying to print the SubTasks : ", error);
			return null;
		}
	};


	// Render Task Description
	const renderTaskDescriptoin = () => {
		try {
			if (taskBody.length > 0) {
				return (
					<>
						{taskDesc.length > 0 && taskDesc.at(0) !== "" && (
							<div
								style={{ opacity: '50%', marginBlockStart: '0.5em', cursor: 'pointer', marginInlineStart: '5px' }}
								onClick={toggleDescription}
							>
								{isDescriptionExpanded ? 'Hide Description' : 'Show Description'}
							</div>
						)}

						{/* Render remaining body content with expand/collapse animation */}
						<div className={`taskItemBodyDescription${isDescriptionExpanded ? '-expanded' : ''}`}
						>
							<div className="taskItemBodyDescriptionRenderer" ref={taskItemBodyDescriptionRenderer} />
						</div>
					</>
				);
			} else {
				return null
			}
		} catch (error) {
			console.log("Getting error while trying to print the Description : ", error);
			return null;
		}
	};

	return (
		<div className="taskItem">
			<div className="colorIndicator" style={{ backgroundColor: getColorIndicator() }} />
			<div className="taskItemMainContent">
				{renderHeader()}
				<div className="taskItemMainBody">
					<div className="taskItemMainBodyTitleNsubTasks">
						<input
							type="checkbox"
							checked={(task.completed || isChecked) ? true : false}
							className={`taskItemCheckbox${isChecked ? '-checked' : ''}`}
							onChange={handleCheckboxChange}
						/>
						<div className="taskItemBodyContent">
							<div className="taskItemTitle">{task.title}</div>
							<div className="taskItemBody">
								{renderSubTasks()}
							</div>
						</div>
					</div>
					<div className="taskItemMainBodyDescription">
						{renderTaskDescriptoin()}
					</div>
				</div>
				{renderFooter()}
			</div>
		</div>
	);
};

export default TaskItem;
