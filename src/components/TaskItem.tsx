// /src/components/TaskItem.tsx

import { FaEdit, FaTrash } from 'react-icons/fa';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { taskItem, taskStatuses } from '../interfaces/TaskItem';
import { checkboxStateSwitcher, extractCheckboxSymbol } from 'src/utils/CheckBoxUtils';
import { handleCheckboxChange, handleDeleteTask, handleEditTask, handleSubTasksChange } from 'src/utils/TaskItemEventHandlers';
import { hookMarkdownLinkMouseEventHandlers, markdownButtonHoverPreviewEvent } from 'src/services/MarkdownHoverPreview';

import { Component } from 'obsidian';
import { EditButtonMode, cardSectionsVisibilityOptions } from 'src/interfaces/GlobalSettings';
import { MarkdownUIRenderer } from 'src/services/MarkdownUIRenderer';
import { cleanTaskTitle, getUniversalDateFromTask, getUniversalDateEmoji } from 'src/utils/TaskContentFormatter';
import { updateRGBAOpacity } from 'src/utils/UIHelpers';
import { parseUniversalDate } from 'src/utils/TaskItemUtils';
import { priorityEmojis } from '../interfaces/TaskItem';
import { t } from 'src/utils/lang/helper';
import { bugReporter } from 'src/services/OpenModals';
import TaskBoard from 'main';
import { Board } from 'src/interfaces/BoardConfigs';

export interface TaskProps {
	key: number;
	plugin: TaskBoard;
	taskKey: number;
	task: taskItem;
	activeBoardSettings: Board;
	columnIndex?: number;
}

const TaskItem: React.FC<TaskProps> = ({ plugin, taskKey, task, columnIndex, activeBoardSettings }) => {
	const [isChecked, setIsChecked] = useState(false);
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
	const [showSubtasks, setShowSubtasks] = useState(plugin.settings.data.globalSettings.cardSectionsVisibility === cardSectionsVisibilityOptions.hideBoth || plugin.settings.data.globalSettings.cardSectionsVisibility === cardSectionsVisibilityOptions.showDescriptionOnly ? false : true);

	const showDescriptionSection = plugin.settings.data.globalSettings.cardSectionsVisibility === cardSectionsVisibilityOptions.showBoth || plugin.settings.data.globalSettings.cardSectionsVisibility === cardSectionsVisibilityOptions.showDescriptionOnly ? true : false


	let universalDate = getUniversalDateFromTask(task, plugin);
	useEffect(() => {
		universalDate = getUniversalDateFromTask(task, plugin);
	}, [task.due, task.startDate, task.scheduledDate]);

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
		// Initialize TaskBoardView Component on mount
		componentRef.current = plugin.view;
	}, []);

	const taskIdKey = `${task.id}`; // for rendering unique title
	const taskTitleRendererRef = useRef<{ [key: string]: HTMLDivElement | null }>({});
	useEffect(() => {
		if (taskTitleRendererRef.current && componentRef.current) {
			const titleElement = taskTitleRendererRef.current[taskIdKey];

			if (titleElement && task.title !== "") {
				let cleanedTitle = cleanTaskTitle(plugin, task);
				const searchQuery = plugin.settings.data.globalSettings.searchQuery || '';
				if (searchQuery) {
					const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
					const regex = new RegExp(`(${escapedQuery})`, "gi");
					cleanedTitle = searchQuery ? cleanedTitle.replace(regex, `<mark style="background: #FFF3A3A6;">$1</mark>`) : cleanedTitle;
				}

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
	}, [task.title, task.filePath]);

	const subtaskTextRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
	useEffect(() => {
		const allSubTasks = task.body.filter(line => /-\s\[.\s*\]/.test(line));
		// Render subtasks after componentRef is initialized
		allSubTasks.forEach((subtaskText, index) => {
			const uniqueKey = `${task.id}-${index}`;
			const element = subtaskTextRefs.current[uniqueKey];
			let strippedSubtaskText = subtaskText.replace(/- \[.*?\]/, "").trim();

			if (element && strippedSubtaskText !== "") {
				// console.log("renderSubTasks : This useEffect should only run when subTask updates | Calling rendered with:\n", subtaskText);
				element.empty(); // Clear previous content

				const searchQuery = plugin.settings.data.globalSettings.searchQuery || '';
				if (searchQuery) {
					const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
					const regex = new RegExp(`(${escapedQuery})`, "gi");
					strippedSubtaskText = searchQuery ? strippedSubtaskText.replace(regex, `<mark style="background: #FFF3A3A6;">$1</mark>`) : strippedSubtaskText;
				}

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
		let descriptionContent = task.body
			.filter((line) => !line.trim().startsWith("- [ ]") && !line.trim().startsWith("- [x]"))
			.join("\n")
			.trim();

		if (descElement && descriptionContent !== "") {
			const searchQuery = plugin.settings.data.globalSettings.searchQuery || '';
			if (searchQuery) {
				const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				const regex = new RegExp(`(${escapedQuery})`, "gi");
				descriptionContent = searchQuery ? descriptionContent.replace(regex, `<mark style="background: #FFF3A3A6;">$1</mark>`) : descriptionContent;
			}

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

	// const renderDescriptionByDefault = async () => {
	// 	if (showDescriptionSection) {
	// 		await renderTaskDescriptionWithObsidianAPI();
	// 		return true;
	// 	} else {
	// 		return false;
	// 	}
	// };

	const getColorIndicator = useCallback(() => {
		const today = new Date();
		const taskUniversalDate = parseUniversalDate(universalDate) || new Date(universalDate);

		if (taskUniversalDate.toDateString() === today.toDateString()) {
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
		} else if (taskUniversalDate > today) {
			return 'green'; // Due in future
		} else if (taskUniversalDate < today) {
			return 'var(--color-red)'; // Past due
		} else {
			return 'grey'; // No due date
		}
	}, [universalDate, task.time]);

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
			return updateRGBAOpacity(plugin, highestPriorityTag.color, 0.2);
		}

		return highestPriorityTag?.color;
	}

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
	const handleSubtaskCheckboxChange = (subTaskLine: string, isCompleted: boolean) => {
		console.log("handleSubtaskCheckboxChange : subTaskLine :", subTaskLine);
		const updatedBody = task.body.map((line, idx) => {
			if (line === subTaskLine) {
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
		handleSubTasksChange(plugin, task, updatedTask)
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
			if (plugin.settings.data.globalSettings?.showHeader) {
				return (
					<>
						<div className="taskItemHeader">
							<div className="taskItemHeaderLeft">
								<div className="taskItemPrio">{task.priority > 0 ? priorityEmojis[task.priority as number] : ''}</div>								{/* Render tags individually */}
								<div className="taskItemTags">
									{/* Render line tags (editable) */}
									{task.tags.map((tag: string) => {
										const tagName = tag.replace('#', '');
										const customTag = plugin.settings.data.globalSettings.tagColorsType === "text" ? plugin.settings.data.globalSettings.tagColors.find(t => t.name === tagName) : undefined;
										const tagColor = customTag?.color || `var(--tag-color)`;
										const backgroundColor = customTag ? updateRGBAOpacity(plugin, customTag.color, 0.1) : `var(--tag-background)`; // 10% opacity background
										const borderColor = customTag ? updateRGBAOpacity(plugin, customTag.color, 0.5) : `var(--tag-color-hover)`;

										// If columnIndex is defined, proceed to get the column
										const column = columnIndex !== undefined ? activeBoardSettings?.columns[columnIndex - 1] : undefined;
										if ((!activeBoardSettings?.showColumnTags) && column && column?.colType === "namedTag" && tagName.replace('#', '') === column?.coltag?.replace('#', '')) {
											return null;
										}

										// If showFilteredTags is false, skip tags in the filters array
										if (!activeBoardSettings?.showFilteredTags && activeBoardSettings?.filters && activeBoardSettings?.filters.length > 0 && activeBoardSettings?.filters.includes(tag) && parseInt(activeBoardSettings?.filterPolarity || "0")) {
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

									{/* Render frontmatter tags (read-only) */}
									{task.frontmatterTags && task.frontmatterTags.map((tag: string) => {
										const tagKey = `${task.id}-fm-${tag}`;
										// Render frontmatter tags with different styling
										return (
											<div
												key={tagKey}
												className="taskItemTagFrontmatter"
												title="Tag from note frontmatter (read-only)"
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
			// bugReporter(plugin, "Error while rendering task header", error as string, "TaskItem.tsx/renderHeader");
			console.warn("TaskItem.tsx/renderHeader : Error while rendering task header", error);
			return null;
		}
	};

	// Render sub-tasks and remaining body separately
	const renderSubTasks = () => {
		try {
			const body = task.body ?? [];
			if (body.length === 0) return null;

			const allSubTasks = body.filter(line => /-\s\[.\s*\]/.test(line));

			const total = allSubTasks.length;
			const completed = allSubTasks.filter(line => /-\s\[(x|X)\]\s+/i.test(line)).length;

			const showSubTaskSummaryBar = plugin.settings.data.globalSettings.cardSectionsVisibility === cardSectionsVisibilityOptions.hideBoth || plugin.settings.data.globalSettings.cardSectionsVisibility === cardSectionsVisibilityOptions.showDescriptionOnly ? true : false;

			return (
				<>
					{showSubTaskSummaryBar && total > 0 && (
						<div className="subtask-summary-container">
							{/* Progress bar */}
							<div className="subtask-progress-bar-wrapper">
								<div className="subtask-progress-bar-bg">
									<div
										className="subtask-progress-bar-fill"
										style={{
											width: `${(completed / total) * 100}%`,
										}}
									/>
								</div>
								<span className="subtask-progress-count">
									[{completed}/{total}]
								</span>

								{/* Expand/collapse toggle */}
								<span
									className={`subtask-toggle-icon ${showSubtasks ? 'rotated' : ''}`}
									onClick={() => setShowSubtasks((prev) => !prev)}
								>
									▼
								</span>
							</div>
						</div>
					)}
					<div className={showSubtasks ? 'taskItemBodySubtaskSection-show' : 'taskItemBodySubtaskSection-hide'}>
						{allSubTasks.map((line, index) => {
							// console.log("renderSubTasks : This uses memo, so only run when the subTask state variable updates... | Value of isSubTask :", isSubTask);
							const isCompleted = line.trim().startsWith('- [x]') || line.trim().startsWith('- [X]');

							// Calculate padding based on the number of tabs
							const numTabs = line.match(/^\t+/)?.[0].length || 0;
							const paddingLeft = numTabs > 1 ? `${(numTabs - 1) * 15}px` : '0px';

							// Create a unique key for this subtask based on task.id and index
							const uniqueKey = `${task.id}-${index}`;

							return (
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
										onChange={() => handleSubtaskCheckboxChange(line, isCompleted)}
									/>
									{/* Render each subtask separately */}
									<div
										className={isCompleted ? `subtaskTextRenderer subtaskTextRenderer-checked` : `subtaskTextRenderer`}
										ref={(el) => { subtaskTextRefs.current[uniqueKey] = el; }}
									/>
								</div>
							);
						})}
					</div>
				</>
			);

		} catch (error) {
			bugReporter(plugin, "Error while rendering sub-tasks", error as string, "TaskItem.tsx/renderSubTasks");
			return null;
		}
	};

	const renderDescriptionSection = useMemo(() => {
		const uniqueKey = `${task.id}-desc`;
		const descElement = taskItemBodyDescriptionRef.current[uniqueKey];
		let descriptionContent = task.body
			.filter((line) => !line.trim().startsWith("- [ ]") && !line.trim().startsWith("- [x]"))
			.join("\n")
			.trim();

		if (!descriptionContent) return null; // If no description content, return null

		if (descElement) {
			const searchQuery = plugin.settings.data.globalSettings.searchQuery || '';
			if (searchQuery) {
				const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				const regex = new RegExp(`(${escapedQuery})`, "gi");
				descriptionContent = searchQuery ? descriptionContent.replace(regex, `<mark style="background: #FFF3A3A6;">$1</mark>`) : descriptionContent;
			}

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

		if (showDescriptionSection) {
			return (
				<div className="taskItemBodyDescriptionSection">
					<div
						className={`taskItemBodyDescription${isDescriptionExpanded ? '' : '-collapsed'}`}
						ref={descriptionRef}
					>
						<div
							className='taskItemBodyDescriptionRenderer'
							ref={(el) => { taskItemBodyDescriptionRef.current[`${task.id}-desc`] = el; }}
						/>
					</div>
				</div>
			);
		} else {
			return null;
		}
	}, [showDescriptionSection, isDescriptionExpanded, task.body]);


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
									{task.time && universalDate ? ' | ' : ''}
									{universalDate ? `${getUniversalDateEmoji(plugin)}${universalDate}` : ''}
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
			bugReporter(plugin, "Error while rendering task footer", error as string, "TaskItem.tsx/renderFooter");
			return null;
		}
	};

	const memoizedRenderHeader = useMemo(() => renderHeader(), [plugin.settings.data.globalSettings.showHeader, task.tags, activeBoardSettings]);
	const memoizedRenderSubTasks = useMemo(() => renderSubTasks(), [task.body, showSubtasks]);
	// const memoizedRenderFooter = useMemo(() => renderFooter(), [plugin.settings.data.globalSettings.showFooter, task.completion, universalDate, task.time]);

	return (
		<div className="taskItem" key={taskKey} style={{ backgroundColor: getCardBgBasedOnTag(task.tags) }}>
			<div className="colorIndicator" style={{ backgroundColor: getColorIndicator() }} />
			<div className="taskItemMainContent">
				<div className="taskItemFileNameSection">
					{plugin.settings.data.globalSettings.showFileNameInCard && task.filePath && (
						<div className="taskItemFileName" aria-label={task.filePath}>
							{task.filePath.split('/').pop()?.replace('.md', '')}
						</div>
					)}
				</div>
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
							<div className="taskItemTitle" ref={(titleEL) => { if (titleEL) taskTitleRendererRef.current[taskIdKey] = titleEL; }} />
							<div className="taskItemBody">
								{memoizedRenderSubTasks}
							</div>
						</div>
					</div>
					{showDescriptionSection && (
						<div className='taskItemMainBodyDescriptionSectionVisible'>
							{renderDescriptionSection}
						</div>
					)}
					{!showDescriptionSection && (<div className="taskItemMainBodyDescription">
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
					</div>)}
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
