// /src/components/TaskItem.tsx

import { FaEdit, FaTrash } from 'react-icons/fa';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TaskProps, taskItem } from '../interfaces/TaskItemProps';
import { handleCheckboxChange, handleDeleteTask, handleEditTask, handleSubTasksChange } from 'src/utils/TaskItemEventHandlers';
import { hookMarkdownLinkMouseEventHandlers, markdownButtonHoverPreviewEvent } from 'src/services/MarkdownHoverPreview';

import { Component } from 'obsidian';
import { EditButtonMode } from 'src/interfaces/GlobalSettings';
import { MarkdownUIRenderer } from 'src/services/MarkdownUIRenderer';
import { hexToRgba } from 'src/utils/UIHelpers';
import { priorityEmojis } from '../interfaces/TaskItemProps';
import { t } from 'src/utils/lang/helper';

const TaskItem: React.FC<TaskProps> = ({ plugin, taskKey, task, columnIndex, activeBoardSettings }) => {
	const [isChecked, setIsChecked] = useState(false);
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false); // State to track description visibility

	// const handleTaskInteraction = useCallback(
	// 	(task: taskItem, type: string) => {
	// 		if (type === "edit") handleEditTask(plugin, task);
	// 		else if (type === "delete") handleDeleteTask(plugin, task);
	// 		else if (type === "checkbox") handleCheckboxChange(plugin, task);
	// 	},
	// 	[handleEditTask, handleDeleteTask, handleCheckboxChange, plugin]
	// );

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
				// console.log("TaskItem.tsx : Rendering title... | Title :", task.title);
				titleElement.empty();
				// Call the MarkdownUIRenderer to render the description
				MarkdownUIRenderer.renderTaskDisc(
					plugin.app,
					task.title,
					titleElement,
					task.filePath,
					componentRef.current
				);

				hookMarkdownLinkMouseEventHandlers(plugin.app, plugin, titleElement, task.filePath, task.filePath);
			}
		}
	}, [task.title, task.filePath]);

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

	// Determine color for the task indicator
	const getColorIndicator = useCallback(() => {
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
	}, [task.due]);

	const handleMainCheckBoxClick = () => {
		setIsChecked(true); // Trigger animation
		setTimeout(() => {
			// onCheckboxChange(task); // Call parent function after 1 second
			handleCheckboxChange(plugin, task);
			setIsChecked(false); // Reset checkbox state
		}, 1000); // 1-second delay for animation
	};

	const handleMainTaskDelete = () => {
		handleDeleteTask(plugin, task);
	}

	// Function to handle the checkbox toggle inside the task body
	const handleSubtaskCheckboxChange = (index: number, isCompleted: boolean) => {
		const updatedBody = task.body.map((line, idx) => {
			if (idx === index) {
				// Toggle the checkbox status only for the specific line
				return isCompleted
					? line.replace('- [x]', '- [ ]')
					: line.replace('- [ ]', '- [x]');
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

								{/* Render tags individually */}
								<div className="taskItemTags">
									{task.tags.map((tag: string) => {
										const customTagColor = plugin.settings.data.globalSettings.tagColors[tag.replace('#', '')];
										const tagColor = customTagColor || 'var(--tag-color)';
										const backgroundColor = customTagColor ? hexToRgba(customTagColor, 0.1) : `var(--tag-background)`; // 10% opacity background
										const borderColor = customTagColor ? hexToRgba(tagColor, 0.5) : `var(--tag-color-hover)`;

										// If showColumnTags is false and column type is namedTag, skip the column's tag
										const column = activeBoardSettings.columns[columnIndex];
										if (!activeBoardSettings.showColumnTags && activeBoardSettings.columns[columnIndex].colType === "namedTag" && tag === column.coltag) {
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
							{task.completed ? (
								<div className='taskItemDateCompleted'>✅ {task.completed}</div>
							) : (
								<div className='taskItemDate'>
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

	const memoizedRenderHeader = useMemo(() => renderHeader(), [plugin.settings.data.globalSettings.showHeader, task.tags, activeBoardSettings]);
	const memoizedRenderSubTasks = useMemo(() => renderSubTasks(), [task.body]);
	// const memoizedRenderFooter = useMemo(() => renderFooter(), [plugin.settings.data.globalSettings.showFooter, task.completed, task.due, task.time]);

	return (
		<div className="taskItem" key={taskKey}>
			<div className="colorIndicator" style={{ backgroundColor: getColorIndicator() }} />
			<div className="taskItemMainContent">
				{memoizedRenderHeader}
				<div className="taskItemMainBody">
					<div className="taskItemMainBodyTitleNsubTasks">
						<input
							type="checkbox"
							checked={(task.completed || isChecked) ? true : false}
							className={`taskItemCheckbox${isChecked ? '-checked' : ''}`}
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
						{task.body.filter(line => (!line.trim().startsWith('- [ ]') && !line.trim().startsWith('- [x]'))).length > 0 && (
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
