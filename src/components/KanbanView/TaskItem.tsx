// /src/components/TaskItem.tsx

import { FaEdit, FaTrash } from 'react-icons/fa';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { checkboxStateSwitcher, extractCheckboxSymbol, getObsidianIndentationSetting, isTaskCompleted, isTaskLine } from 'src/utils/CheckBoxUtils';
import { handleCheckboxChange, handleDeleteTask, handleEditTask, handleSubTasksChange } from 'src/utils/taskLine/TaskItemEventHandlers';
import { hookMarkdownLinkMouseEventHandlers, markdownButtonHoverPreviewEvent } from 'src/services/MarkdownHoverPreview';

import { Component, Notice } from 'obsidian';
import { MarkdownUIRenderer } from 'src/services/MarkdownUIRenderer';
import { getUniversalDateFromTask, getUniversalDateEmoji, cleanTaskTitleLegacy } from 'src/utils/taskLine/TaskContentFormatter';
import { updateRGBAOpacity } from 'src/utils/UIHelpers';
import { getTaskFromId, parseUniversalDate } from 'src/utils/taskLine/TaskItemUtils';
import { t } from 'src/utils/lang/helper';
import TaskBoard from 'main';
import { Board } from 'src/interfaces/BoardConfigs';
import { TaskRegularExpressions, TASKS_PLUGIN_DEFAULT_SYMBOLS } from 'src/regularExpressions/TasksPluginRegularExpr';
import { isTaskNotePresentInTags } from 'src/utils/taskNote/TaskNoteUtils';
import { allowedFileExtensionsRegEx } from 'src/regularExpressions/MiscelleneousRegExpr';
import { bugReporter } from 'src/services/OpenModals';
import { ChevronDown } from 'lucide-react';
import { cardSectionsVisibilityOptions, EditButtonMode, viewTypeNames, taskStatuses, colType } from 'src/interfaces/Enums';
import { priorityEmojis } from 'src/interfaces/Mapping';
import { taskItem, UpdateTaskEventData } from 'src/interfaces/TaskItem';
import { matchTagsWithWildcards, verifySubtasksAndChildtasksAreComplete } from 'src/utils/algorithms/ScanningFilterer';
import { handleTaskNoteStatusChange, handleTaskNoteBodyChange } from 'src/utils/taskNote/TaskNoteEventHandlers';
import { eventEmitter } from 'src/services/EventEmitter';

export interface TaskProps {
	key: number;
	plugin: TaskBoard;
	task: taskItem;
	activeBoardSettings: Board;
	columnIndex?: number;
}

const TaskItem: React.FC<TaskProps> = ({ plugin, task, columnIndex, activeBoardSettings }) => {
	const taskNoteIdentifierTag = plugin.settings.data.globalSettings.taskNoteIdentifierTag;
	const isTaskNote = isTaskNotePresentInTags(taskNoteIdentifierTag, task.tags);
	const [isChecked, setIsChecked] = useState(isTaskNote ? isTaskCompleted(task.status, true, plugin.settings) : isTaskCompleted(task.title, false, plugin.settings));
	const [cardLoadingAnimation, setCardLoadingAnimation] = useState(false);
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
	const [showSubtasks, setShowSubtasks] = useState(plugin.settings.data.globalSettings.cardSectionsVisibility === cardSectionsVisibilityOptions.hideBoth || plugin.settings.data.globalSettings.cardSectionsVisibility === cardSectionsVisibilityOptions.showDescriptionOnly ? false : true);

	const showDescriptionSection = plugin.settings.data.globalSettings.cardSectionsVisibility === cardSectionsVisibilityOptions.showBoth || plugin.settings.data.globalSettings.cardSectionsVisibility === cardSectionsVisibilityOptions.showDescriptionOnly ? true : false;


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

	const taskIdKey = task.id; // for rendering unique title
	const taskTitleRendererRef = useRef<{ [key: string]: HTMLDivElement | null }>({});
	useEffect(() => {
		if (taskTitleRendererRef.current && componentRef.current) {
			const titleElement = taskTitleRendererRef.current[taskIdKey];

			if (titleElement && task.title !== "") {
				let cleanedTitle = cleanTaskTitleLegacy(task);
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
		const allSubTasks = task.body.filter(line => isTaskLine(line.trim()));
		// Render subtasks after componentRef is initialized
		allSubTasks.forEach((subtaskText, index) => {
			const uniqueKey = `${task.id}-${index}`;
			const element = subtaskTextRefs.current[uniqueKey];
			const match = subtaskText.match(TaskRegularExpressions.taskRegex);
			let strippedSubtaskText = match ? match?.length >= 5 ? match[4].trim() : subtaskText.trim() : subtaskText.trim();

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
	}, [task.body, task.filePath]);

	// Render the task description only when the description section is expanded
	const descriptionRef = useRef<HTMLDivElement | null>(null);
	const taskItemBodyDescriptionRef = useRef<{ [key: string]: HTMLDivElement | null }>({});
	const renderTaskDescriptionWithObsidianAPI = async () => {
		const uniqueKey = `${task.id}-desc`;
		const descElement = taskItemBodyDescriptionRef.current[uniqueKey];
		let descriptionContent = task.body ? task.body
			.filter((line) => !isTaskLine(line.trim()))
			.join("\n")
			.trim() : "";

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
				const [startStr, endStr] = task.time.contains('-') ? task.time.split('-') : [task.time, task.time];
				const [startHours, startMinutes] = startStr.contains(':') ? startStr.trim().split(':').map(Number) : [startStr, 0].map(Number);
				const [endHours, endMinutes] = endStr.contains(':') ? endStr.trim().split(':').map(Number) : [endStr, 0].map(Number);

				const startTime = new Date(today);
				startTime.setHours(startHours, startMinutes, 0, 0);

				const endTime = new Date(today);
				endTime.setHours(endHours, endMinutes, 0, 0);

				const now = new Date();

				if (now < startTime) {
					// return 'var(--color-yellow)'; // Not started yet
					return '#e8ce4aa8'; // Not started yet
				} else if (now >= startTime && now <= endTime) {
					return 'var(--color-blue)'; // In progress
				} else if (now > endTime) {
					return '#f23a3ab8'; // Past due
				}
			} else {
				return 'var(--color-yellow)'; // Due today but no time info
			}
		} else if (taskUniversalDate > today) {
			return 'green'; // Due in future
		} else if (taskUniversalDate < today) {
			// return 'var(--color-red)'; // Past due
			return '#f23a3ab8'; // Past due
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
			let tagData = tagColorMap.get(tagName);

			if (!tagData) {
				tagColorMap.forEach((tagColor, tagNameKey, mapValue) => {
					const result = matchTagsWithWildcards(tagNameKey, tagName || '');
					// Return the first match found
					if (result) tagData = tagColor;
				});
			}

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

	useEffect(() => {
		const setCardLoading = (eventData: UpdateTaskEventData) => {
			if (!eventData || !eventData.taskID) setCardLoadingAnimation(false);

			// Only update this specific task's loading state
			if (eventData.taskID !== taskIdKey) return;

			setCardLoadingAnimation(eventData.state);
		};
		eventEmitter.on("UPDATE_TASK", setCardLoading);
		return () => eventEmitter.off("UPDATE_TASK", setCardLoading);
	}, [taskIdKey]);

	// Function to handle the main checkbox click
	const handleMainCheckBoxClick = async () => {
		// Prevent repeated clicks while card is loading
		if (cardLoadingAnimation) return;

		console.log("Checkbox clicked...");
		setCardLoadingAnimation(true);
		// setIsChecked(true);
		// const eventData: UpdateTaskEventData = { taskID: taskIdKey, state: true };
		// eventEmitter.emit("UPDATE_TASK", eventData); // Trigger animation

		const condition = await verifySubtasksAndChildtasksAreComplete(plugin, task);
		if (condition) {
			// Route to appropriate handler based on task type
			if (isTaskNotePresentInTags(taskNoteIdentifierTag, task.tags)) {
				handleTaskNoteStatusChange(plugin, task);
			} else {
				handleCheckboxChange(plugin, task);
			}

			// setTimeout(() => {
			// 	// Route to appropriate handler based on task type
			// 	if (isTaskNotePresentInTags(taskNoteIdentifierTag, task.tags)) {
			// 		handleTaskNoteStatusChange(plugin, task);
			// 	} else {
			// 		handleCheckboxChange(plugin, task);
			// 	}
			// }, 500);
		} else {
			new Notice(t("complete-all-child-tasks-before-completing-task"), 5000);
			// Reset loading state immediately because we didn't proceed
			setCardLoadingAnimation(false);
		}
	};

	const handleMainTaskDelete = () => {
		handleDeleteTask(plugin, task, isTaskNotePresentInTags(taskNoteIdentifierTag, task.tags));
	}

	// Function to handle the checkbox toggle inside the task body
	const handleSubtaskCheckboxChange = (subTaskLine: string, isCompleted: boolean) => {
		const updatedBody = task.body.map((line, idx) => {
			if (line === subTaskLine) {
				// Toggle the checkbox status only for the specific line

				const symbol = extractCheckboxSymbol(line);
				const nextSymbol = checkboxStateSwitcher(plugin, symbol);

				return line.replace(`[${symbol}]`, `[${nextSymbol}]`);
			}
			return line;
		});

		// Update the task with the modified body content
		const updatedTask: taskItem = { ...task, body: updatedBody };

		if (!isTaskNotePresentInTags(taskNoteIdentifierTag, task.tags)) {
			// onSubTasksChange(updatedTask); // Notify parent of the change
			handleSubTasksChange(plugin, task, updatedTask);
		} else {
			// If it's a task note, open the note for editing
			handleTaskNoteBodyChange(plugin, task, updatedTask);
		}
	};

	const handleMouseEnter = (event: React.MouseEvent) => {
		const element = document.getElementById('taskItemFooterBtns');
		if (element && event.ctrlKey) {
			markdownButtonHoverPreviewEvent(plugin.app, event, task.filePath);
		}
	};

	const onEditButtonClicked = (event: React.MouseEvent) => {
		const settingOption = plugin.settings.data.globalSettings.editButtonAction;
		if (settingOption !== EditButtonMode.NoteInHover) {
			handleEditTask(plugin, task, settingOption);
		} else {
			event.ctrlKey = true;
			markdownButtonHoverPreviewEvent(plugin.app, event, task.filePath);
			event.ctrlKey = false;
		}
	}

	const handleDoubleClickOnCard = (event: React.MouseEvent) => {
		const settingOption = plugin.settings.data.globalSettings.doubleClickCardToEdit;
		if (settingOption === EditButtonMode.None) return;

		if (settingOption !== EditButtonMode.NoteInHover) {
			handleEditTask(plugin, task, settingOption);
		} else {
			event.ctrlKey = true;
			markdownButtonHoverPreviewEvent(plugin.app, event, task.filePath);
			event.ctrlKey = false;
		}
	}

	const handleOpenChildTaskModal = async (event: React.MouseEvent, childTaskId: string) => {
		event.stopPropagation();
		try {
			const childTask = await getTaskFromId(plugin, childTaskId);
			if (!childTask) {
				bugReporter(plugin, `Task with ID ${childTaskId} not found in the cache. Please try to search for the task in its source note and try scanning that single note again using the file menu option. If issue still persists after refreshing the board, kindly report this bug to the developer.`, "ERROR : Child task not found in the cache", "TaskItem.tsx/handleOpenChildTaskModal");
				return;
			}

			const settingOption = plugin.settings.data.globalSettings.editButtonAction;
			if (settingOption !== EditButtonMode.NoteInHover) {
				handleEditTask(plugin, childTask, settingOption);
			} else {
				event.ctrlKey = true;
				markdownButtonHoverPreviewEvent(plugin.app, event, childTask.filePath);
				event.ctrlKey = false;
			}
		} catch (error) {
			console.error("Error opening child task modal:", error);
			bugReporter(plugin, "Error opening child task modal", String(error), "TaskItem.tsx/handleOpenChildTaskModal");
		}
	}

	const renderHeader = () => {
		try {
			if (plugin.settings.data.globalSettings?.showHeader) {
				return (
					<>
						<div className="taskItemHeader">
							<div className="taskItemHeaderLeft">
								<div className="taskItemPrio">{task.priority > 0 ? priorityEmojis[task.priority as number] : ''}</div>
								{/* Render tags individually */}
								<div className="taskItemTags">
									{/* Render line tags (editable) */}
									{task.tags.map((tag: string) => {
										const tagName = tag.replace('#', '');
										const customTag = plugin.settings.data.globalSettings.tagColorsType === "text" ? plugin.settings.data.globalSettings.tagColors.find(t => t.name === tagName) : undefined;
										const tagColor = customTag?.color || `var(--tag-color)`;
										const backgroundColor = customTag ? updateRGBAOpacity(plugin, customTag.color, 0.1) : `var(--tag-background)`; // 10% opacity background
										const borderColor = customTag ? updateRGBAOpacity(plugin, customTag.color, 0.5) : `var(--tag-color-hover)`;

										// If columnIndex is defined, proceed to get the column
										const columnData = columnIndex !== undefined ? activeBoardSettings?.columns[columnIndex - 1] : undefined;
										if (
											(!activeBoardSettings?.showColumnTags) &&
											columnData &&
											columnData?.colType === colType.namedTag &&
											tagName.replace('#', '') === columnData?.coltag?.replace('#', '')
										) {
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
													// border: `1px solid ${borderColor}`,
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
							{/* <div className="taskItemDragBtn" aria-label='Drag the Task Item'><RxDragHandleDots2 size={14} enableBackground={0} opacity={0.4} onClick={onEditButtonClicked} title={t("edit-task")} /></div> */}
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

			const allSubTasks = body.filter(line => TaskRegularExpressions.taskRegex.test(line));
			// console.log("renderSubTasks : allSubTasks :", allSubTasks);
			// if (allSubTasks.length === 0) return null;

			const total = allSubTasks.length;
			const completed = allSubTasks.filter(line => isTaskCompleted(line, false, plugin.settings)).length;

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
									<ChevronDown size={18} style={{ verticalAlign: 'middle' }} />
								</span>
							</div>
						</div>
					)}
					<div className={showSubtasks ? 'taskItemBodySubtaskSection-show' : 'taskItemBodySubtaskSection-hide'}>
						{allSubTasks.map((line, index) => {
							// console.log("renderSubTasks : This uses memo, so only run when the subTask state variable updates... | Value of isSubTask :", isSubTask);
							const isSubTaskCompleted = isTaskCompleted(line, false, plugin.settings);

							// Calculate padding based on the number of tabs
							const tabString = getObsidianIndentationSetting(plugin);
							const tabMatch = line.match(new RegExp(`^(${tabString})+`));
							const tabMatchInTitle = task.title.match(new RegExp(`^(${tabString})+`));
							const titleTabs = tabMatchInTitle && tabMatchInTitle[0] ? tabMatchInTitle[0].length / tabString.length : 0;
							const numTabs = tabMatch && tabMatch[0] ? tabMatch[0].length / tabString.length : 0;
							const paddingLeft = numTabs > 1 ? `${(numTabs - titleTabs - 1) * 15}px` : '0px';

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
										checked={isSubTaskCompleted}
										onChange={() => handleSubtaskCheckboxChange(line, isSubTaskCompleted)}
									/>
									{/* Render each subtask separately */}
									<div
										className={isSubTaskCompleted ? `subtaskTextRenderer subtaskTextRenderer-checked` : `subtaskTextRenderer`}
										ref={(el) => { subtaskTextRefs.current[uniqueKey] = el; }}
									/>
								</div>
							);
						})}
					</div>
				</>
			);

		} catch (error) {
			// bugReporter(plugin, "Error while rendering sub-tasks", error as string, "TaskItem.tsx/renderSubTasks");
			console.warn("TaskItem.tsx/renderSubTasks : Error while rendering sub-tasks", error);
			return null;
		}
	};

	const renderDescriptionSection = useMemo(() => {
		const uniqueKey = `${task.id}-desc`;
		const descElement = taskItemBodyDescriptionRef.current[uniqueKey];
		let descriptionContent = task.body ? task.body
			.filter((line) => !isTaskLine(line))
			.join("\n")
			.trim() : "";

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
						{cardLoadingAnimation ? (
							<div className='taskItemFooterRefreshingMssg'>Refreshing...</div>
						) : (
							<>
								<div className="taskItemFooter">
									{/* Conditionally render task.completed or the date/time */}
									{(task.status === "X" || task.status === "x") && task.completion !== "" ? (
										<div className='taskItemCompletedDate'>✅ {task.completion}</div>
									) : (
										<div className='taskItemFooterDateTimeContainer'>
											{task?.reminder && task.completion && (
												<div className='taskItemReminderContainer'>
													🔔
												</div>
											)}
											{task.time && (
												<div className='taskItemTimeContainer'>
													⏰ {task.time}
												</div>
											)}
											{universalDate && (

												<div className='taskItemUniversalDateContainer'>
													{getUniversalDateEmoji(plugin)} {universalDate}
												</div>
											)}
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
						)}
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
			// bugReporter(plugin, "Error while rendering task footer", error as string, "TaskItem.tsx/renderFooter");
			console.warn("TaskItem.tsx/renderFooter : Error while rendering task footer", error);
			return null;
		}
	};

	// State to hold child tasks data
	const [childTasksData, setChildTasksData] = useState<Record<string, taskItem | null>>({});

	// Effect to load child tasks asynchronously
	useEffect(() => {
		if (task?.dependsOn && task.dependsOn.length > 0) {
			const loadChildTasks = async () => {
				const childTasksMap: Record<string, taskItem | null> = {};
				await Promise.all((task?.dependsOn ?? []).map(async (dependsOnId) => {
					const childTask = await getTaskFromId(plugin, dependsOnId);
					childTasksMap[dependsOnId] = childTask;
				}));
				setChildTasksData(childTasksMap);
			};
			loadChildTasks();
		} else {
			setChildTasksData({});
		}
	}, [task.dependsOn]);

	const renderChildTasks = () => {
		try {
			// Render only if the last viewed history is Kanban and there are child tasks
			if (plugin.settings.data.globalSettings.lastViewHistory.viewedType === viewTypeNames.kanban && task?.dependsOn && task.dependsOn.length > 0) {
				return (
					<div className="taskItemChildTasksSection">
						{/* Placeholder for future child tasks rendering */}
						<div className="taskItemChildTasks">
							{task?.dependsOn && task?.dependsOn.map((dependsOnId) => {
								const childTask = childTasksData[dependsOnId];
								if (!childTask) return null; // Skip if child task not found in cache

								// Render each child task with a link to open it in the modal
								const isChildTaskCompleted = childTask.status === taskStatuses.checked || childTask.status === taskStatuses.regular || childTask.status === taskStatuses.dropped;
								const depTaskTitle = childTask.title || `There was an error fetching the task with ID: ${dependsOnId}`;

								// Simple version just showing the ID and a symbol
								return (
									<div key={`${task.id}-dep-${dependsOnId}`} className="taskItemChildTask">
										<div className='taskItemChildTaskContent' onClick={(event) => handleOpenChildTaskModal(event, dependsOnId)}>
											<span className='taskItemChildTaskSymbol' role="img" aria-label={t("child-task")}>{isChildTaskCompleted ? TASKS_PLUGIN_DEFAULT_SYMBOLS.dependsOnCompletedSymbol : TASKS_PLUGIN_DEFAULT_SYMBOLS.dependsOnSymbol}</span>
											<span
												className={`taskItemChildTaskTitleText${isChildTaskCompleted ? '-completed' : ''}`}
												title={depTaskTitle.slice(6)}
											>
												{cleanTaskTitleLegacy(childTask)}
											</span></div>
									</div>
								)
							})}
						</div>
					</div >);
			} else {
				return null;
			}
		} catch (error) {
			// bugReporter(plugin, "Error while rendering child-tasks", error as string, "TaskItem.tsx/renderChildTasks");
			console.warn("TaskItem.tsx/renderChildTasks : Error while rendering child-tasks", error);
			return null;
		}
	};

	// Memoize the render functions to prevent unnecessary re-renders
	const memoizedRenderHeader = useMemo(() => renderHeader(), [plugin.settings.data.globalSettings.showHeader, task.tags, activeBoardSettings]);
	const memoizedRenderSubTasks = useMemo(() => renderSubTasks(), [task.body, showSubtasks]);
	const memoizedRenderChildTasks = useMemo(() => renderChildTasks(), [task.dependsOn, childTasksData]);
	// const memoizedRenderFooter = useMemo(() => renderFooter(), [plugin.settings.data.globalSettings.showFooter, task.completion, universalDate, task.time]);

	return (
		<div className='taskItemContainer'>
			<div className={`taskItem${isChecked ? ' completed' : ''}`} key={taskIdKey} style={{ backgroundColor: getCardBgBasedOnTag(task.tags) }}
				onDoubleClick={handleDoubleClickOnCard}
			>
				{/* {cardLoadingAnimation && (
					<div
						className="taskItemLoadingOverlay"
						role="status"
						aria-live="polite"
						style={{
							position: 'absolute',
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							background: 'rgba(255,255,255,0.6)',
							zIndex: 50,
						}}
					>
						<svg width="36" height="36" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
							<circle cx="25" cy="25" r="20" stroke="#3b82f6" strokeWidth="5" fill="none" strokeOpacity="0.25" />
							<path d="M45 25a20 20 0 0 1-20 20" stroke="#3b82f6" strokeWidth="5" strokeLinecap="round" fill="none">
								<animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
							</path>
						</svg>
					</div>
				)} */}
				<div className="colorIndicator" style={{ backgroundColor: getColorIndicator() }} />
				<div className="taskItemMainContent">
					<div className="taskItemFileNameSection">
						{plugin.settings.data.globalSettings.showFileNameInCard && task.filePath && (
							<div className="taskItemFileName" aria-label={task.filePath}>
								{task.filePath.split('/').pop()?.replace(allowedFileExtensionsRegEx, '')}
							</div>
						)}
					</div>
					{memoizedRenderHeader}
					<div className="taskItemMainBody">
						<div className="taskItemMainBodyTitleNsubTasks">
							{cardLoadingAnimation ? (
								<input
									id={`${task.id}-checkbox`}
									type="checkbox"
									checked={cardLoadingAnimation}
									className={`taskItemCheckbox${cardLoadingAnimation ? '-checked' : ''}`}
									data-task={task.status} // Add the data-task attribute
									dir='auto'
									readOnly={true}
								/>
							) : (
								<input
									id={`${task.id}-checkbox`}
									type="checkbox"
									checked={isChecked || cardLoadingAnimation}
									className={`taskItemCheckbox${cardLoadingAnimation ? '-checked' : ''}`}
									data-task={task.status} // Add the data-task attribute
									dir='auto'
									onChange={handleMainCheckBoxClick}
									onClick={(e) => {
										if (cardLoadingAnimation) {
											e.preventDefault();
											return;
										}
									}}
									onDoubleClick={(e) => {
										e.preventDefault();
										return;
									}}
									disabled={cardLoadingAnimation}
									aria-disabled={cardLoadingAnimation}
									aria-busy={cardLoadingAnimation}
									readOnly={cardLoadingAnimation}
								/>
							)}
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
							{task.body.at(0) !== "" && task.body.filter(line => !isTaskLine(line)).length > 0 && (
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
						{memoizedRenderChildTasks}
					</div>
					{renderFooter()}
				</div>
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
