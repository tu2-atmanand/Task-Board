// /src/components/TaskItem.tsx

import { FaEdit, FaTrash } from 'react-icons/fa';
import React, { useEffect, useRef, useState } from 'react';
import { TaskProps, taskItem } from '../interfaces/TaskItemProps';
import { hookMarkdownLinkMouseEventHandlers, markdownButtonHoverPreviewEvent } from 'src/services/MarkdownHoverPreview';

import { Component } from 'obsidian';
import { MarkdownUIRenderer } from 'src/services/MarkdownUIRenderer';
import { priorityEmojis } from '../interfaces/TaskItemProps';
import { t } from 'src/utils/lang/helper';

const TaskItem: React.FC<TaskProps> = ({ app, plugin, taskKey, task, columnIndex, activeBoardSettings, onEdit, onDelete, onCheckboxChange, onSubTasksChange }) => {
	const [isChecked, setIsChecked] = useState(false);
	const [taskDesc, setTaskDesc] = useState<string[]>(task.body.filter(line => (!line.trim().startsWith('- [ ]') && !line.trim().startsWith('- [x]'))));
	const [taskBody, setTaskBody] = useState<string[]>(task.body);
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false); // State to track description visibility


	// Determine color for the task indicator
	const getColorIndicator = () => {
		const today = new Date();
		const taskDueDate = new Date(task.due);
		if (taskDueDate.toDateString() === today.toDateString()) {
			return 'var(--color-yellow)'; // Due today
		} else if (taskDueDate > today) {
			return 'var(--color-green)'; // Due in the future
		} else if (taskDueDate < today) {
			return 'var(--color-red)'; // Past due
		} else {
			return 'grey'; // No Due
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
				element.empty(); // Clear previous content

				const strippedSubtaskText = subtaskText.replace(/- \[.*?\]/, "").trim();

				MarkdownUIRenderer.renderSubtaskText(
					app,
					strippedSubtaskText,
					element,
					task.filePath,
					componentRef.current
				);

				hookMarkdownLinkMouseEventHandlers(app, plugin, element, task.filePath, task.filePath);
			}
		});
	}, [task.body, task.filePath, app]);


	const taskItemBodyDescriptionRenderer = useRef<{ [key: string]: HTMLDivElement | null }>({});
	useEffect(() => {
		if (taskItemBodyDescriptionRenderer.current && componentRef.current) {
			const uniqueKey = `${task.id}-desc`;
			const descElement = taskItemBodyDescriptionRenderer.current[uniqueKey];

			if (descElement) {
				descElement.empty();
				// Call the MarkdownUIRenderer to render the description
				MarkdownUIRenderer.renderTaskDisc(
					app,
					taskDesc.join('\n').trim(),
					descElement,
					task.filePath,
					componentRef.current
				);

				hookMarkdownLinkMouseEventHandlers(app, plugin, descElement, task.filePath, task.filePath);
			}
		}
	}, [taskDesc, task.filePath, app]);

	const taskIdKey = `${task.id}`; // for rendering unique title
	const taskTitleRendererRef = useRef<{ [key: string]: HTMLDivElement | null }>({});
	useEffect(() => {
		if (taskTitleRendererRef.current && componentRef.current) {
			const titleElement = taskTitleRendererRef.current[taskIdKey];

			if (titleElement) {
				titleElement.empty();
				// Call the MarkdownUIRenderer to render the description
				MarkdownUIRenderer.renderTaskDisc(
					app,
					task.title,
					titleElement,
					task.filePath,
					componentRef.current
				);

				hookMarkdownLinkMouseEventHandlers(app, plugin, titleElement, task.filePath, task.filePath);
			}
		}
	}, [task.title, task.filePath, app]);


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
										const borderColor = customTagColor ? hexToRgba(tagColor, 0.5) : `var(--tag-color-hover)`;

										// If showColumnTags is false and column type is namedTag, skip the column's tag
										const column = activeBoardSettings.columns[columnIndex];
										if (!activeBoardSettings.showColumnTags && activeBoardSettings.columns[columnIndex].colType === "namedTag" && tag === column.data.coltag) {
											return null;
										}

										// If showFilteredTags is false, skip tags in the filters array
										if (!activeBoardSettings.showFilteredTags && activeBoardSettings.filters?.at(0) != null && activeBoardSettings.filters.includes(tag) && parseInt(activeBoardSettings.filterPolarity || "0")) {
											return null;
										}

										const tagKey = `${task.id}-${tag}`;
										// Render the remaining tags
										return (
											<div
												key={tagKey}
												className="taskItemTag"
												style={{
													color: tagColor,
													border: `1px solid ${borderColor}`,
													backgroundColor: backgroundColor
												}}
											>
												{tag}
											</div>
										);
									})}
								</div>

							</div>
							{/* Drag Handle */}
							{/* <div className="taskItemDragBtn" aria-label='Drag the Task Item'><RxDragHandleDots2 size={14} /></div> */}
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
								<div className="taskItemiconButton taskItemiconButtonEdit">
									<FaEdit size={16} enableBackground={0} opacity={0.4} onClick={onEdit} title={t(8)} />
								</div>
								<div className="taskItemiconButton taskItemiconButtonDelete">
									<FaTrash size={13} enableBackground={0} opacity={0.4} onClick={onDelete} title={t(9)} />
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
		<div className="taskItem" key={taskKey}>
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
							<div className="taskItemTitle" ref={(titleEL) => taskTitleRendererRef.current[taskIdKey] = titleEL} />
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
