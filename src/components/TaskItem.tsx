// /src/components/TaskItem.tsx

import { FaEdit, FaTrash } from 'react-icons/fa';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TaskProps, taskItem, taskStatuses } from '../interfaces/TaskItemProps';
import { checkboxStateSwitcher, extractCheckboxSymbol } from 'src/utils/CheckBoxUtils';
import { handleCheckboxChange, handleDeleteTask, handleEditTask, handleSubTasksChange } from 'src/utils/TaskItemEventHandlers';
import { hookMarkdownLinkMouseEventHandlers, markdownButtonHoverPreviewEvent } from 'src/services/MarkdownHoverPreview';

import { Component } from 'obsidian';
import { EditButtonMode } from 'src/interfaces/GlobalSettings';
import { MarkdownUIRenderer } from 'src/services/MarkdownUIRenderer';
import { cleanTaskTitle } from 'src/utils/TaskContentFormatter';
import { updateRGBAOpacity } from 'src/utils/UIHelpers';
import { parseDueDate } from 'src/utils/TaskItemUtils';
import { priorityEmojis } from '../interfaces/TaskItemProps';
import { t } from 'src/utils/lang/helper';

const TaskItem: React.FC<TaskProps> = ({ plugin, taskKey, task, columnIndex, activeBoardSettings, columnData }) => {
	const [isChecked, setIsChecked] = useState(false);
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false); // State to track description visibility
	const [isDragging, setIsDragging] = useState(false);

	// const handleTaskInteraction = useCallback(
	// 	(task: taskItem, type: string) => {
	// 		if (type === "edit") handleEditTask(plugin, task);
	// 		else if (type === "delete") handleDeleteTask(plugin, task);
	// 		else if (type === "checkbox") handleCheckboxChange(plugin, task);
	// 	},
	// 	[handleEditTask, handleDeleteTask, handleCheckboxChange, plugin]
	// );

	// Ref to access the DOM element of the task item
	const taskItemRef = useRef<HTMLDivElement>(null);

	const componentRef = useRef<Component | null>(null);
	useEffect(() => {
		// Initialize KanbanView Component on mount
		componentRef.current = plugin.view;
	}, []);

	const taskIdKey = `${task.id}`; // for rendering unique title
	const taskTitleRendererRef = useRef<{ [key: string]: HTMLDivElement | null }>({});
	useEffect(() => {
		if (taskTitleRendererRef.current && componentRef.current) {
			const titleElement = taskTitleRendererRef.current[taskIdKey];

			if (titleElement && task.title !== "") {
				const cleanedTitle = cleanTaskTitle(plugin, task);
				titleElement.empty();
				// Call the MarkdownUIRenderer to render the description
				MarkdownUIRenderer.renderTaskDisc(
					plugin.app,
					cleanedTitle,
					titleElement,
					task.filePath,
					componentRef.current
				);

				hookMarkdownLinkMouseEventHandlers(plugin.app, plugin, titleElement, task.filePath, task.filePath);
			}
		}
	}, [task.title, task.filePath, task.tags]);

	const subtaskTextRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
	useEffect(() => {
		// Render subtasks after componentRef is initialized
		task.body.forEach((subtaskText, index) => {
			const uniqueKey = `${task.id}-${index}`;
			const element = subtaskTextRefs.current[uniqueKey];
			const strippedSubtaskText = subtaskText.replace(/- \[.*?\]/, "").trim();

			if (element && strippedSubtaskText !== "") {
				// console.log("renderSubTasks : This useEffect should only run when subTask updates | Calling rendered with:\n", subtaskText);
				element.empty(); // Clear previous content

				MarkdownUIRenderer.renderSubtaskText(
					plugin.app,
					strippedSubtaskText,
					element,
					task.filePath,
					componentRef.current
				);

				hookMarkdownLinkMouseEventHandlers(plugin.app, plugin, element, task.filePath, task.filePath);
			}
		});
	}, [task.body.filter(line => (line.trim().startsWith('- [ ]') && line.trim().startsWith('- [x]'))), task.filePath]);

	// Render the task description only when the description section is expanded
	const descriptionRef = useRef<HTMLDivElement | null>(null);
	const taskItemBodyDescriptionRef = useRef<{ [key: string]: HTMLDivElement | null }>({});
	const renderTaskDescriptionWithObsidianAPI = async () => {
		const uniqueKey = `${task.id}-desc`;
		const descElement = taskItemBodyDescriptionRef.current[uniqueKey];
		const descriptionContent = task.body
			.filter((line) => !line.trim().startsWith("- [ ]") && !line.trim().startsWith("- [x]"))
			.join("\n")
			.trim();

		if (descElement && descriptionContent !== "") {
			// Clear existing content
			descElement.empty();
			// Use Obsidian's rendering API
			MarkdownUIRenderer.renderTaskDisc(
				plugin.app,
				descriptionContent,
				descElement,
				task.filePath,
				componentRef.current
			);
			// Attach event handlers
			hookMarkdownLinkMouseEventHandlers(plugin.app, plugin, descElement, task.filePath, task.filePath);
		}
	};

	// Toggle function to expand/collapse the description
	const toggleDescription = async () => {
		const status = isDescriptionExpanded;
		setIsDescriptionExpanded((prev) => !prev);

		if (!status) {
			await renderTaskDescriptionWithObsidianAPI();
			if (descriptionRef.current) {
				descriptionRef.current.style.height = `${descriptionRef.current.scrollHeight}px`;
				descriptionRef.current.style.opacity = "1"; // Add fade-in effect
			}
		} else {
			if (descriptionRef.current) {
				descriptionRef.current.style.height = "0";
				descriptionRef.current.style.opacity = "0"; // Add fade-out effect
			}
			const uniqueKey = `${task.id}-desc`;
			const descElement = taskItemBodyDescriptionRef.current[uniqueKey];
			descElement?.empty();
		}
	};

	const getColorIndicator = useCallback(() => {
		const today = new Date();
		const taskDueDate = parseDueDate(task.due) || new Date(task.due);

		if (taskDueDate.toDateString() === today.toDateString()) {
			if (task.time) {
				const [startStr, endStr] = task.time.split(' - ');
				const [startHours, startMinutes] = startStr.split(':').map(Number);
				const [endHours, endMinutes] = endStr.split(':').map(Number);

				const startTime = new Date(today);
				startTime.setHours(startHours, startMinutes, 0, 0);

				const endTime = new Date(today);
				endTime.setHours(endHours, endMinutes, 0, 0);

				const now = new Date();

				if (now < startTime) {
					return 'var(--color-yellow)'; // Not started yet
				} else if (now >= startTime && now <= endTime) {
					return 'var(--color-blue)'; // In progress
				} else if (now > endTime) {
					return 'var(--color-red)'; // Over
				}
			} else {
				return 'var(--color-yellow)'; // Due today but no time info
			}
		} else if (taskDueDate > today) {
			return 'var(--color-green)'; // Due in future
		} else if (taskDueDate < today) {
			return 'var(--color-red)'; // Past due
		} else {
			return 'grey'; // No due date
		}
	}, [task.due, task.time]);

	// Function to get the card background color based on tags
	function getCardBgBasedOnTag(tags: string[]): string | undefined {
		if (plugin.settings.data.globalSettings.tagColorsType === "text") {
			return undefined;
		}

		const tagColors = plugin.settings.data.globalSettings.tagColors;

		if (!Array.isArray(tagColors) || tagColors.length === 0) {
			return undefined;
		}

		// Prepare a map for faster lookup
		const tagColorMap = new Map(tagColors.map((t) => [t.name, t]));

		let highestPriorityTag: { name: string; color: string; priority: number } | undefined = undefined;

		for (const rawTag of tags) {
			const tagName = rawTag.replace('#', '');
			const tagData = tagColorMap.get(tagName);

			if (tagData) {
				if (
					!highestPriorityTag ||
					(tagData.priority) < (highestPriorityTag.priority)
				) {
					highestPriorityTag = tagData;
				}
			}
		}

		const getOpacityValue = (color: string): number => {
			const rgbaMatch = color.match(/rgba?\((\d+), (\d+), (\d+)(, (\d+(\.\d+)?))?\)/);
			if (rgbaMatch) {
				const opacity = rgbaMatch[5] ? parseFloat(rgbaMatch[5]) : 1;
				return opacity;
			}
			return 1;
		};

		if (highestPriorityTag && getOpacityValue(highestPriorityTag.color) > 0.2) {
			return updateRGBAOpacity(highestPriorityTag.color, 0.2);
		}

		return highestPriorityTag?.color;
	}

	
	// Handlers for drag and drop
	const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		// Only allow dragging if this column is of type "namedTag"
		if (columnData?.colType !== 'namedTag') {
			e.preventDefault();
			return;
		}

		// Add task data and source column to the dataTransfer object
		e.dataTransfer.setData('application/json', JSON.stringify({
			task,
			sourceColumnData: columnData
		}));
		
		// Set visual effect for dragging
		e.dataTransfer.effectAllowed = 'move';
		
		// Add dragging class for visual effects
		setIsDragging(true);
		
		// Define the drag image (optional)
		if (taskItemRef.current) {
			// Create a copy of the element for the drag image
			const rect = taskItemRef.current.getBoundingClientRect();
			e.dataTransfer.setDragImage(taskItemRef.current, rect.width / 2, 20);
		}
	}, [task, columnData]);

	const handleDragEnd = useCallback(() => {
		setIsDragging(false);
	}, []);


	// Function to handle the main checkbox click
	const handleMainCheckBoxClick = () => {
		setIsChecked(true); // Trigger animation
		setTimeout(() => {
			// onCheckboxChange(task); // Call parent function after 1 second
			handleCheckboxChange(plugin, task);
			setIsChecked(false); // Reset checkbox state
		}, 500); // 1-second delay for animation
	};

	const handleMainTaskDelete = () => {
		handleDeleteTask(plugin, task);
	}

	// Function to handle the checkbox toggle inside the task body
	const handleSubtaskCheckboxChange = (index: number, isCompleted: boolean) => {
		const updatedBody = task.body.map((line, idx) => {
			if (idx === index) {
				// Toggle the checkbox status only for the specific line

				const symbol = extractCheckboxSymbol(line);
				const nextSymbol = checkboxStateSwitcher(plugin, symbol);

				return line.replace(`- [${symbol}]`, `- [${nextSymbol}]`);
			}
			return line;
		});

		// Update the task with the modified body content
		const updatedTask: taskItem = { ...task, body: updatedBody };
		// onSubTasksChange(updatedTask); // Notify parent of the change
		handleSubTasksChange(plugin, updatedTask)
	};

	const handleMouseEnter = (event: React.MouseEvent) => {
		const element = document.getElementById('taskItemFooterBtns');
		if (element && event.ctrlKey) {
			markdownButtonHoverPreviewEvent(plugin.app, event, task.filePath);
		}
	};

	const onEditButtonClicked = (event: React.MouseEvent) => {
		if (plugin.settings.data.globalSettings.editButtonAction !== EditButtonMode.NoteInHover) {
			handleEditTask(plugin, task);
		} else {
			event.ctrlKey = true;
			markdownButtonHoverPreviewEvent(plugin.app, event, task.filePath);
			event.ctrlKey = false;
		}
	}

	const renderHeader = () => {
		try {
			if (plugin.settings.data.globalSettings.showHeader) {
				return (
					<>
						<div className="taskItemHeader">
							<div className="taskItemHeaderLeft">
								<div className="taskItemPrio">{task.priority > 0 ? priorityEmojis[task.priority as number] : ''}</div>

								{activeBoardSettings.showColumnTags && (
								<div className="taskItemTags">
									{task.tags.map((tag: string) => {
										const tagName = tag.replace('#', '');
										const customTag = plugin.settings.data.globalSettings.tagColorsType === "text" ? plugin.settings.data.globalSettings.tagColors.find(t => t.name === tagName) : undefined;
										const tagColor = customTag?.color || `var(--tag-color)`;
										const backgroundColor = customTag ? updateRGBAOpacity(customTag.color, 0.1) : `var(--tag-background)`; // 10% opacity background
										const borderColor = customTag ? updateRGBAOpacity(customTag.color, 0.5) : `var(--tag-color-hover)`;

										// If showColumnTags is false and column type is namedTag, skip the column's tag
										const column = activeBoardSettings.columns[columnIndex - 1];
										if ((!activeBoardSettings.showColumnTags) && column?.colType === "namedTag" && tagName === column?.coltag) {
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
							)}
							</div>
						</div>
					</>);
			} else {
				return null;
			}
		} catch (error) {
			console.log("renderHeader : Getting error while trying to render Header: ", error);
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
							const isSubTask = line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]');
							if (!isSubTask) return;
							// console.log("renderSubTasks : This uses memo, so only run when the subTask state variable updates... | Value of isSubTask :", isSubTask);
							const isCompleted = line.trim().startsWith('- [x]');

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
			console.log('renderSubTasks : Getting error while trying to render the SubTasks: ', error);
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
							{(task.status === "X" || task.status === "x") && task.completion !== "" ? (
								<div className='taskItemDateCompleted'>✅ {task.completion}</div>
							) : (
								<div className='taskItemDate'>
									{task.title.contains("(@") && task.completion === "" ? `🔔 ` : ""}
									{task.time ? `⏰${task.time}` : ''}
									{task.time && task.due ? ' | ' : ''}
									{task.due ? `📅${task.due}` : ''}
								</div>
							)}
							<div id='taskItemFooterBtns' className="taskItemFooterBtns" onMouseOver={handleMouseEnter}>
								<div className="taskItemiconButton taskItemiconButtonEdit">
									<FaEdit size={16} enableBackground={0} opacity={0.4} onClick={onEditButtonClicked} title={t("edit-task")} />
								</div>
								<div className="taskItemiconButton taskItemiconButtonDelete">
									<FaTrash size={13} enableBackground={0} opacity={0.4} onClick={handleMainTaskDelete} title={t("delete-task")} />
								</div>
							</div>
						</div>
					</>
				);
			} else {
				return (
					<>
						<div className="taskItemFooterHidden">
							<div id='taskItemFooterBtns' className="taskItemFooterBtns" onMouseOver={handleMouseEnter}>
								<div className="taskItemiconButton taskItemiconButtonEdit">
									<FaEdit size={16} enableBackground={0} opacity={0.4} onClick={onEditButtonClicked} title={t("edit-task")} />
								</div>
								<div className="taskItemiconButton taskItemiconButtonDelete">
									<FaTrash size={13} enableBackground={0} opacity={0.4} onClick={handleMainTaskDelete} title={t("delete-task")} />
								</div>
							</div>
						</div>
					</>
				);
			}
		} catch (error) {
			console.log("renderFooter : Getting error while trying to render Footer : ", error);
			return null;
		}
	};

	const memoizedRenderHeader = useMemo(() => renderHeader(), [plugin.settings.data.globalSettings.showHeader, task.tags, activeBoardSettings, columnData]);
	const memoizedRenderSubTasks = useMemo(() => renderSubTasks(), [task.body]);
	// const memoizedRenderFooter = useMemo(() => renderFooter(), [plugin.settings.data.globalSettings.showFooter, task.completion, task.due, task.time]);

	return (
		<div 
			ref={taskItemRef}
			className={`taskItem ${isDragging ? 'taskItem-dragging' : ''}`} 
			key={taskKey} 
			style={{ backgroundColor: getCardBgBasedOnTag(task.tags) }}
			draggable={columnData?.colType === 'namedTag'}
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
		>
			<div className="colorIndicator" style={{ backgroundColor: getColorIndicator() }} />
			<div className="taskItemMainContent">
				{memoizedRenderHeader}
				<div className="taskItemMainBody">
					<div className="taskItemMainBodyTitleNsubTasks">
						<input
							type="checkbox"
							checked={(task.status === taskStatuses.checked || task.status === taskStatuses.regular || isChecked) ? true : false}
							className={`taskItemCheckbox${isChecked ? '-checked' : ''}`}
							data-task={task.status} // Add the data-task attribute
							dir='auto'
							onChange={handleMainCheckBoxClick}
						/>
						<div className="taskItemBodyContent">
							<div className="taskItemTitle" ref={(titleEL) => taskTitleRendererRef.current[taskIdKey] = titleEL} />
							<div className="taskItemBody">
								{memoizedRenderSubTasks}
							</div>
						</div>
					</div>
					<div className="taskItemMainBodyDescription">
						{task.body.at(0) !== "" && task.body.filter(line => (!line.trim().startsWith('- [ ]') && !line.trim().startsWith('- [x]'))).length > 0 && (
							<div
								className='taskItemMainBodyDescriptionSectionToggler'
								onClick={toggleDescription}
							>
								{isDescriptionExpanded ? t("hide-description") : t("show-description")}
							</div>
						)}
						{/* Expandable section */}
						<div className='taskItemMainBodyDescriptionSection'>
							<div
								className={`taskItemBodyDescription${isDescriptionExpanded ? '-expanded' : ''}`}
								ref={descriptionRef}
							>
								<div
									className="taskItemBodyDescriptionRenderer"
									ref={(el) => {
										if (el) {
											const uniqueKey = `${task.id}-desc`;
											taskItemBodyDescriptionRef.current[uniqueKey] = el;
										}
									}}
								></div>
							</div>
						</div>
					</div>
				</div>
				{renderFooter()}
			</div>
		</div>
	);
};

// export default memo(TaskItem, (prevProps, nextProps) => {
// 	return (
// 		prevProps.task.id === nextProps.task.id && // Immutable check
// 		prevProps.task.title === nextProps.task.title &&
// 		prevProps.task.body === nextProps.task.body &&
// 		prevProps.task.due === nextProps.task.due &&
// 		prevProps.task.tags.join(",") === nextProps.task.tags.join(",") &&
// 		prevProps.task.priority === nextProps.task.priority &&
// 		prevProps.task.completed === nextProps.task.completed &&
// 		prevProps.task.filePath === nextProps.task.filePath &&
// 		prevProps.columnIndex === nextProps.columnIndex &&
// 		prevProps.activeBoardSettings === nextProps.activeBoardSettings
// 	);
// });

export default memo(TaskItem);
