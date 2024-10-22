// /src/components/TaskItem.tsx

import { FaEdit, FaTrash } from 'react-icons/fa'; // Import the desired icons from react-icons
import React, { useEffect, useRef, useState } from 'react';
import { TaskProps, taskItem } from '../interfaces/TaskItemProps';
import { hookMarkdownLinkMouseEventHandlers, markdownButtonHoverPreviewEvent } from 'src/services/MarkdownHoverPreview';

import { Component } from 'obsidian';
import { MarkdownUIRenderer } from 'src/services/MarkdownUIRenderer';
import { RxDragHandleDots2 } from "react-icons/rx";
import { priorityEmojis } from '../interfaces/TaskItemProps';

const TaskItem: React.FC<TaskProps> = ({ app, plugin, task, columnIndex, activeBoardSettings, onEdit, onDelete, onCheckboxChange, onSubTasksChange }) => {
	// State to handle the checkbox animation
	const [updatedTask, setTask] = useState<taskItem>(task);
	const [isChecked, setIsChecked] = useState(false);
	const [taskDesc, setTaskDesc] = useState<string[]>(task.body.filter(line => (!line.trim().startsWith('- [ ]') && !line.trim().startsWith('- [x]'))));
	const [subTasks, setSubTasks] = useState<string[]>(task.body.filter(line => (line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]'))));
	const [taskBody, setTaskBody] = useState<string[]>(task.body);
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
		const updatedBody = taskBody.map((line, idx) => {
			if (idx === index) {
				// Toggle the checkbox status only for the specific line
				return isCompleted
					? line.replace('- [x]', '- [ ]')
					: line.replace('- [ ]', '- [x]');
			}
			return line;
		});

		setTaskBody(updatedBody);

		// Update the task with the modified body content
		const updatedTask: taskItem = { ...task, body: updatedBody };
		onSubTasksChange(updatedTask); // Notify parent of the change
	};

	// Toggle function to expand/collapse the description
	const toggleDescription = () => {
		setIsDescriptionExpanded(!isDescriptionExpanded);
	};

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

	const subtaskTextRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
	useEffect(() => {
		// Render subtasks after componentRef is initialized
		task.body.forEach((subtaskText, index) => {
			const uniqueKey = `${task.id}-${index}`;
			const element = subtaskTextRefs.current[uniqueKey];

			if (element) {
				element.innerHTML = ''; // Clear previous content

				const strippedSubtaskText = subtaskText.replace(/- \[.*?\]/, "").trim();

				MarkdownUIRenderer.renderSubtaskText(
					app,
					strippedSubtaskText,
					element,
					task.filePath,
					componentRef.current
				);

				hookMarkdownLinkMouseEventHandlers(app, element, task.filePath, task.filePath);
			}
		});
	}, [task.body, task.filePath, app]);


	const taskItemBodyDescriptionRenderer = useRef<{ [key: string]: HTMLDivElement | null }>({});
	useEffect(() => {
		if (taskItemBodyDescriptionRenderer.current && componentRef.current) {
			const uniqueKey = `${task.id}-desc`;
			const descElement = taskItemBodyDescriptionRenderer.current[uniqueKey]; // Clear existing content

			if (descElement) {
				descElement.innerHTML = '';
				// Call the MarkdownUIRenderer to render the description
				MarkdownUIRenderer.renderTaskDisc(
					app,
					taskDesc.join('\n').trim(),
					descElement, // Use HTMLDivElement reference
					task.filePath,
					componentRef.current // Pass the Component instance
				);

				hookMarkdownLinkMouseEventHandlers(app, descElement, task.filePath, task.filePath);
			}
		}
	}, [taskDesc, task.filePath, app]);


	const handleMouseEnter = (event: React.MouseEvent) => {
		const element = document.getElementById('taskItemFooterBtns');
		if (element) {
			markdownButtonHoverPreviewEvent(app, event, element, task.filePath);
		}
	};

	// Helper function to convert a hex color to an RGBA string with the specified opacity
	const hexToRgba = (hex: string, opacity: number): string => {
		let r = 0, g = 0, b = 0;

		if (hex.length === 4) {
			r = parseInt(hex[1] + hex[1], 16);
			g = parseInt(hex[2] + hex[2], 16);
			b = parseInt(hex[3] + hex[3], 16);
		} else if (hex.length === 7 || hex.length === 9) {
			r = parseInt(hex[1] + hex[2], 16);
			g = parseInt(hex[3] + hex[4], 16);
			b = parseInt(hex[5] + hex[6], 16);
		}

		return `rgba(${r},${g},${b},${opacity})`;
	};

	// Default color when tag isn't found in the settings
	const defaultTagColor = 'var(--tag-color)';
	// console.log("The Current Board Settings Data : ", activeBoardSettings);

	const renderHeader = () => {
		try {
			if (plugin.settings.data.globalSettings.showHeader) {
				return (
					<>
						<div className="taskItemHeader">
							<div className="taskItemHeaderLeft">
								<div className="taskItemPrio">{task.priority > 0 ? priorityEmojis[task.priority as number] : ''}</div>

								{/* Render tags individually */}
								<div className="taskItemTags">
									{task.tags.map((tag: string) => {
										const customTagColor = plugin.settings.data.globalSettings.tagColors[tag.replace('#', '')];
										const tagColor = customTagColor || defaultTagColor;
										const backgroundColor = customTagColor ? hexToRgba(customTagColor, 0.1) : `var(--tag-background)`; // 10% opacity background

										// If showColumnTags is false and column type is namedTag, skip the column's tag
										const column = activeBoardSettings.columns[columnIndex];
										// console.log("Current Column Index :", columnIndex, "| Current Column data :", column);
										if (!activeBoardSettings.showColumnTags && activeBoardSettings.columns[columnIndex].colType === "namedTag" && tag === column.data.coltag) {
											// console.log("This is a namedTag, the tag of this column's coltag wont be shown |  Name of Column :", column.data.name);
											return null;
										}

										// If showFilteredTags is false, skip tags in the filters array
										if (!activeBoardSettings.showFilteredTags && activeBoardSettings.filters?.at(0) != null && activeBoardSettings.filters.includes(tag) && parseInt(activeBoardSettings.filterPolarity || "0")) {
											// console.log("The following tags wont be shown since showFilteredTags is OFF :", activeBoardSettings.filters);
											return null;
										}

										// Render the remaining tags
										return (
											<div
												key={tag}
												className="taskItemTag"
												style={{
													color: tagColor,
													border: `1px solid ${tagColor}`,
													backgroundColor: backgroundColor,
													borderRadius: '1em',
													padding: '2px 8px',
													marginRight: '2px',
													display: 'inline-block',
													whiteSpace: 'nowrap'
												}}
											>
												{tag}
											</div>
										);
									})}
								</div>


								{/* Drag Handle */}
								<div className="taskItemDragBtn"><RxDragHandleDots2 size={14} /></div>
							</div>
						</div>
					</>);
			} else {
				return null;
			}
		} catch (error) {
			console.log("Getting error while trying to render Header: ", error);
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
									{task.time ? `⏰${task.time}` : ''}
									{task.time && task.due ? ' | ' : ''}
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
			if (task.body.length > 0) {
				return (
					<>
						{task.body.map((line, index) => {
							const isCompleted = line.trim().startsWith('- [x]');
							const isSubTask = line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]');
							const subtaskText = line.replace(/- \[.\] /, '').trim();

							// Calculate padding based on the number of tabs
							const numTabs = line.match(/^\t+/)?.[0].length || 0;
							const paddingLeft = numTabs > 1 ? `${(numTabs - 1) * 15}px` : '0px';

							// Create a unique key for this subtask based on task.id and index
							const uniqueKey = `${task.id}-${index}`;

							return isSubTask ? (
								<div
									className="taskItemBodySubtaskItem"
									key={uniqueKey}
									style={{ paddingLeft }}
									id={uniqueKey} // Assign a unique ID for each subtask element
								>
									<input
										type="checkbox"
										className="taskItemBodySubtaskItemCheckbox"
										checked={isCompleted}
										onChange={() => handleSubtaskCheckboxChange(index, isCompleted)}
									/>
									{/* Render each subtask separately */}
									<div
										className="subtaskTextRenderer"
										ref={(el) => (subtaskTextRefs.current[uniqueKey] = el)} // Assign unique ref to each subtask
									/>
								</div>
							) : null;
						})}
					</>
				);
			} else {
				return null;
			}
		} catch (error) {
			console.log('Getting error while trying to render the SubTasks: ', error);
			return null;
		}
	};


	// Render Task Description
	const renderTaskDescriptoin = () => {
		try {
			if (taskBody.length > 0) {
				const uniqueKey = `${task.id}-desc`;
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
						<div className={`taskItemBodyDescription${isDescriptionExpanded ? '-expanded' : ''}`} key={uniqueKey} id={uniqueKey}
						>
							<div className="taskItemBodyDescriptionRenderer" ref={(descEl) => taskItemBodyDescriptionRenderer.current[uniqueKey] = descEl} />
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
