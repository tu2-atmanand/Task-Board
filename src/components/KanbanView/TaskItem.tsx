// /src/components/TaskItem.tsx

import { FaEdit, FaTrash } from 'react-icons/fa';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { checkboxStateSwitcher, extractCheckboxSymbol, getObsidianIndentationSetting, isTaskCompleted, isTaskLine } from 'src/utils/CheckBoxUtils';
import { handleCheckboxChange, handleDeleteTask, handleSubTasksChange } from 'src/utils/taskLine/TaskItemEventHandlers';
import { hookMarkdownLinkMouseEventHandlers, markdownButtonHoverPreviewEvent } from 'src/services/MarkdownHoverPreview';

import { Component, Notice, Platform, Menu, TFile } from 'obsidian';
import { MarkdownUIRenderer } from 'src/services/MarkdownUIRenderer';
import { cleanTaskTitleLegacy } from 'src/utils/taskLine/TaskContentFormatter';
import { updateRGBAOpacity } from 'src/utils/UIHelpers';
import { t } from 'src/utils/lang/helper';
import TaskBoard from 'main';
import { Board } from 'src/interfaces/BoardConfigs';
import { TaskRegularExpressions, TASKS_PLUGIN_DEFAULT_SYMBOLS } from 'src/regularExpressions/TasksPluginRegularExpr';
import { isTaskNotePresentInTags } from 'src/utils/taskNote/TaskNoteUtils';
import { allowedFileExtensionsRegEx } from 'src/regularExpressions/MiscelleneousRegExpr';
import { bugReporter } from 'src/services/OpenModals';
import { ChevronDown, EllipsisVertical } from 'lucide-react';
import { cardSectionsVisibilityOptions, EditButtonMode, viewTypeNames, taskStatuses, colTypeNames } from 'src/interfaces/Enums';
import { getCustomStatusOptionsForDropdown, priorityEmojis } from 'src/interfaces/Mapping';
import { taskItem, UpdateTaskEventData } from 'src/interfaces/TaskItem';
import { matchTagsWithWildcards, verifySubtasksAndChildtasksAreComplete } from 'src/utils/algorithms/ScanningFilterer';
import { handleTaskNoteStatusChange, handleTaskNoteBodyChange } from 'src/utils/taskNote/TaskNoteEventHandlers';
import { eventEmitter } from 'src/services/EventEmitter';
import { RxDragHandleDots2 } from 'react-icons/rx';
import { getUniversalDateEmoji, getUniversalDateFromTask, parseUniversalDate } from 'src/utils/DateTimeCalculations';
import { getTaskFromId } from 'src/utils/TaskItemUtils';
import { handleEditTask, updateTaskItemStatus, updateTaskItemPriority, updateTaskItemDate, updateTaskItemReminder, updateTaskItemTags } from 'src/utils/UserTaskEvents';
import EditTagsModal from 'src/modals/EditTagsModal';

// Helper modal functions may be provided elsewhere; declare them for TypeScript
declare function showTextInputModal(app: any, options: { title?: string; placeholder?: string; initialValue?: string }): Promise<string | null>;
declare function showConfirmationModal(app: any, options: any): Promise<boolean>;
import { dragDropTasksManagerInsatance, currentDragDataPayload } from 'src/managers/DragDropTasksManager';

export interface swimlaneDataProp {
	property: string;
	value: string;
}

export interface TaskProps {
	plugin: TaskBoard;
	task: taskItem;
	activeBoardSettings: Board;
	columnIndex?: number;
	swimlaneData?: swimlaneDataProp;
}

const TaskItem: React.FC<TaskProps> = ({ plugin, task, activeBoardSettings, columnIndex, swimlaneData }) => {
	const taskNoteIdentifierTag = plugin.settings.data.globalSettings.taskNoteIdentifierTag;
	const isTaskNote = isTaskNotePresentInTags(taskNoteIdentifierTag, task.tags);
	const isThistaskCompleted = isTaskNote ? isTaskCompleted(task.status, true, plugin.settings) : isTaskCompleted(task.title, false, plugin.settings)
	const columnData = columnIndex !== undefined ? activeBoardSettings?.columns[columnIndex - 1] : undefined;

	const [isDragging, setIsDragging] = useState(false);
	const [isChecked, setIsChecked] = useState(isThistaskCompleted);
	const [cardLoadingAnimation, setCardLoadingAnimation] = useState(false);
	const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
	const [showSubtasks, setShowSubtasks] = useState(plugin.settings.data.globalSettings.cardSectionsVisibility === cardSectionsVisibilityOptions.hideBoth || plugin.settings.data.globalSettings.cardSectionsVisibility === cardSectionsVisibilityOptions.showDescriptionOnly ? false : true);

	const showDescriptionSection = plugin.settings.data.globalSettings.cardSectionsVisibility === cardSectionsVisibilityOptions.showBoth || plugin.settings.data.globalSettings.cardSectionsVisibility === cardSectionsVisibilityOptions.showDescriptionOnly ? true : false;

	const [universalDate, setUniversalDate] = useState(() => getUniversalDateFromTask(task, plugin));
	useEffect(() => {
		setUniversalDate(getUniversalDateFromTask(task, plugin));
	}, [task.due, task.startDate, task.scheduledDate]);


	// const handleTaskInteraction = useCallback(
	// 	(task: taskItem, type: string) => {
	// 		if (type === "edit") handleEditTask(plugin, task);
	// 		else if (type === "delete") handleDeleteTask(plugin, task);
	// 		else if (type === "checkbox") handleCheckboxChange(plugin, task);
	// 	},
	// 	[handleEditTask, handleDeleteTask, handleCheckboxChange, plugin]
	// );
	const taskIdKey = task.id; // for rendering unique title

	const componentRef = useRef<Component | null>(null);
	useEffect(() => {
		// Initialize TaskBoardView Component on mount
		componentRef.current = plugin.view;
	}, []);


	// Ref to access the DOM element of the task item
	const taskItemRef = useRef<HTMLDivElement>(null);

	// ========================================
	// COMPONENT-LOCAL REFS FOR DESCRIPTION
	// ========================================
	const taskTitleRendererRef = useRef<HTMLDivElement | null>(null);
	const subtaskTextRefs = useRef<Map<string, HTMLDivElement>>(new Map());
	const descriptionRef = useRef<HTMLDivElement | null>(null);
	// const descriptionContentRefExpanded = useRef<HTMLDivElement | null>(null);
	// const descriptionContentRefCollapsed = useRef<HTMLDivElement | null>(null);
	const taskItemBodyDescriptionRef = useRef<{ [key: string]: HTMLDivElement | null }>({});

	// useEffect(() => {
	// 	if (taskTitleRendererRef.current && componentRef.current) {
	// 		const titleElement = taskTitleRendererRef.current[taskIdKey];

	// 		console.log("Task titleElement :", titleElement, "\nTask title content :", task.title);

	// 		if (titleElement && task.title !== "") {
	// 			let cleanedTitle = cleanTaskTitleLegacy(task);
	// 			// NOTE : This search method is not working smoothly, hence using the first approach in file TaskBoardViewContent.tsx
	// 			// const searchQuery = plugin.settings.data.globalSettings.searchQuery || '';
	// 			// if (searchQuery) {
	// 			// 	const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	// 			// 	const regex = new RegExp(`(${escapedQuery})`, "gi");
	// 			// 	cleanedTitle = searchQuery ? cleanedTitle.replace(regex, `<mark style="background: #FFF3A3A6;">$1</mark>`) : cleanedTitle;
	// 			// }

	// 			titleElement.empty();
	// 			// Call the MarkdownUIRenderer to render the description
	// 			console.log("Obsidian Renderer : Will render following task : ", cleanedTitle);
	// MarkdownUIRenderer.renderTaskDisc(
	// 	plugin.app,
	// 	cleanedTitle,
	// 	titleElement,
	// 	task.filePath,
	// 	componentRef.current
	// );

	// hookMarkdownLinkMouseEventHandlers(plugin.app, plugin, titleElement, task.filePath, task.filePath);
	// 		}
	// 	}
	// }, [task.title, task.filePath]);

	// ========================================
	// MAIN TITLE RENDERING WITH STABLE useLayoutEffect
	// ========================================
	useEffect(() => {
		const el = taskTitleRendererRef.current;
		if (!el || !componentRef.current) return;

		new Promise(requestAnimationFrame);


		let cancelled = false;

		(async () => {
			try {
				el.innerHTML = '';
				if (task.title === "") return;

				const cleanedTitle = cleanTaskTitleLegacy(task);

				await MarkdownUIRenderer.renderTaskDisc(
					plugin.app,
					cleanedTitle,
					el,
					task.filePath,
					componentRef.current
				);

				if (cancelled) {
					el.innerHTML = '';
					return;
				}

				hookMarkdownLinkMouseEventHandlers(plugin.app, plugin, el, task.filePath, task.filePath);
			} catch (err) {
				console.error('Error rendering task title:', err);
			}
		})();

		// return () => {
		// 	cancelled = true;
		// };
	}, [task.id, task.title, task.filePath, plugin.settings.data.globalSettings.searchQuery]);

	// useEffect(() => {
	// 	const allSubTasks = task.body.filter(line => isTaskLine(line.trim()));
	// 	// Render subtasks after componentRef is initialized
	// 	allSubTasks.forEach((subtaskText, index) => {
	// 		const uniqueKey = `${task.id}-${index}`;
	// 		const element = subtaskTextRefs.current[uniqueKey];
	// 		const match = subtaskText.match(TaskRegularExpressions.taskRegex);
	// let strippedSubtaskText = match ? match?.length >= 5 ? match[4].trim() : subtaskText.trim() : subtaskText.trim();

	// 		if (element && strippedSubtaskText !== "") {
	// 			// console.log("renderSubTasks : This useEffect should only run when subTask updates | Calling rendered with:\n", subtaskText);
	// 			element.empty(); // Clear previous content

	// 			// NOTE : This search method is not working smoothly, hence using the first approach in file TaskBoardViewContent.tsx
	// 			// const searchQuery = plugin.settings.data.globalSettings.searchQuery || '';
	// 			// if (searchQuery) {
	// 			// 	const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	// 			// 	const regex = new RegExp(`(${escapedQuery})`, "gi");
	// 			// 	strippedSubtaskText = searchQuery ? strippedSubtaskText.replace(regex, `<mark style="background: #FFF3A3A6;">$1</mark>`) : strippedSubtaskText;
	// 			// }

	// MarkdownUIRenderer.renderSubtaskText(
	// 	plugin.app,
	// 	strippedSubtaskText,
	// 	element,
	// 	task.filePath,
	// 	componentRef.current
	// );

	// 			hookMarkdownLinkMouseEventHandlers(plugin.app, plugin, element, task.filePath, task.filePath);
	// 		}
	// 	});
	// }, [task.body, task.filePath]);

	// ========================================
	// SUBTASKS RENDERING WITH STABLE useLayoutEffect
	// ========================================
	useEffect(() => {
		if (!componentRef.current) return;

		const allSubTasks = task.body.filter(line => isTaskLine(line.trim()));
		let cancelled = false;

		(async () => {
			for (const [index, subtaskText] of allSubTasks.entries()) {
				if (cancelled) break;

				const uniqueKey = `${task.id}-${index}`;
				const element = subtaskTextRefs.current.get(uniqueKey);
				if (!element) continue;


				try {
					element.innerHTML = '';
					const match = subtaskText.match(TaskRegularExpressions.taskRegex);
					let strippedSubtaskText = match ? match?.length >= 5 ? match[4].trim() : subtaskText.trim() : subtaskText.trim();
					await MarkdownUIRenderer.renderSubtaskText(
						plugin.app,
						strippedSubtaskText,
						element,
						task.filePath,
						componentRef.current
					);

					hookMarkdownLinkMouseEventHandlers(plugin.app, plugin, element, task.filePath, task.filePath);

					if (cancelled) {
						element.innerHTML = '';
						break;
					}
				} catch (err) {
					console.error('Error rendering subtask:', err);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [task.id, task.body, task.filePath]);


	// ========================================
	// DESCRIPTION RENDERING WITH STABLE useLayoutEffect
	// ========================================
	useEffect(() => {
		const uniqueKey = `${taskIdKey}-desc`;
		const container = taskItemBodyDescriptionRef.current[uniqueKey];
		// const container =
		// 	showDescriptionSection
		// 		? descriptionContentRefExpanded.current
		// 		: descriptionContentRefCollapsed.current;


		if (!container) return;

		let descriptionContent = task.body
			?.filter((line) => !isTaskLine(line))
			.join("\n")
			.trim();

		if (!descriptionContent) {
			container.empty();
			return;
		}

		container.empty();

		MarkdownUIRenderer.renderTaskDisc(
			plugin.app,
			descriptionContent,
			container,
			task.filePath,
			componentRef.current
		);

		hookMarkdownLinkMouseEventHandlers(
			plugin.app,
			plugin,
			container,
			task.filePath,
			task.filePath
		);
	}, [
		task.body?.join("\n"),
		showDescriptionSection,
		isDescriptionExpanded
	]);

	// ========================================
	// RENDER DESCRIPTION SECTION (NO MEMO, NO DOM MANIPULATION)
	// ========================================
	const renderDescriptionSection = () => {
		// const uniqueKey = `${taskIdKey}-desc`;
		// const descElement = taskItemBodyDescriptionRef.current[uniqueKey];
		const descriptionContent = task.body
			? task.body.filter((line) => !isTaskLine(line)).join("\n").trim()
			: "";

		if (!descriptionContent) return null;

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
		}
		return null;
	};


	// ========================================
	// TOGGLE DESCRIPTION FUNCTION
	// ========================================
	const toggleDescription = async () => {
		const status = isDescriptionExpanded;
		setIsDescriptionExpanded((prev) => !prev);

		if (!status) {
			await renderDescriptionSection();
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

	// ========================================
	// ALL UTIL FUNCTIONS
	// ========================================

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

	// ========================================
	// ALL EVENTS HANDLING
	// ========================================

	useEffect(() => {
		const setCardLoading = (eventData: UpdateTaskEventData) => {
			// console.log("Refreshing the animation of only following ID :", eventData.taskID, "\nWith state :", eventData.state, "\nCurrent task ID :", task.legacyId, taskIdKey, "\nCondition :", eventData.taskID !== taskIdKey);
			if (!eventData || !eventData?.taskID) setCardLoadingAnimation(false);

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

		setCardLoadingAnimation(true);
		setIsChecked(true);
		// const eventData: UpdateTaskEventData = { taskID: taskIdKey, state: true };
		// eventEmitter.emit("UPDATE_TASK", eventData); // Trigger animation

		const condition = await verifySubtasksAndChildtasksAreComplete(plugin, task);
		if (condition || isThistaskCompleted) {
			// if (isTaskNotePresentInTags(taskNoteIdentifierTag, task.tags)) {
			// 	handleTaskNoteStatusChange(plugin, task);
			// } else {
			// 	handleCheckboxChange(plugin, task);
			// }

			const isTaskNote = isTaskNotePresentInTags(taskNoteIdentifierTag, task.tags);

			// The task update functions trigger a re-render, but we should ensure
			// the loading state is reset in case the component instance is reused.
			try {
				// Route to appropriate handler based on task type
				if (isTaskNote) {
					await handleTaskNoteStatusChange(plugin, task);
				} else {
					handleCheckboxChange(plugin, task);
				}
			} catch (error) {
				console.error("Error updating task:", error);
			}

			// The component might be unmounted by the time this runs, but this is a safeguard.
			// The event-based system should ideally handle the final state.
			// A short delay can prevent a flicker if the re-render is immediate, hence providing 1 second.
			setTimeout(() => {
				setCardLoadingAnimation(false);
				// const isTaskCompletedNow = isTaskNote
				// 	? isTaskCompleted(task.status, true, plugin.settings)
				// 	: isTaskCompleted(task.title, false, plugin.settings);
				// console.log("IsTaskNOte :", isTaskNote, "\nIsTaskCompletedNow : ", isTaskCompletedNow);
				// setIsChecked(isTaskCompletedNow);
			}, 2000);

		} else {
			new Notice(t("complete-all-child-tasks-before-completing-task"), 5000);
			// Reset loading state immediately because we didn't proceed
			setCardLoadingAnimation(false);
			// const isTaskCompletedNow = isTaskNote
			// 	? isTaskCompleted(task.status, true, plugin.settings)
			// 	: isTaskCompleted(task.title, false, plugin.settings);
			setIsChecked(isThistaskCompleted);
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

		setCardLoadingAnimation(true);

		try {
			if (!isTaskNotePresentInTags(taskNoteIdentifierTag, task.tags)) {
				// onSubTasksChange(updatedTask); // Notify parent of the change
				handleSubTasksChange(plugin, task, updatedTask);
			} else {
				// If it's a task note, open the note for editing
				handleTaskNoteBodyChange(plugin, task, updatedTask);
			}
		} finally {
			// The component might be unmounted by the time this runs, but this is a safeguard.
			// The event-based system should ideally handle the final state.
			// A short delay can prevent a flicker if the re-render is immediate, hence providing 1 second.
			setTimeout(() => setCardLoadingAnimation(false), 2000);
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

	const handleMenuButtonClicked = (event: React.MouseEvent) => {
		event.stopPropagation();
		const taskItemMenu = new Menu();

		taskItemMenu.addItem((item) => {
			item.setTitle(t("properties"));
			item.setIsLabel(true);
		});
		taskItemMenu.addItem((item) => {
			item.setTitle(t("status"));
			item.setIcon("info");
			const statusMenu = item.setSubmenu()

			const customStatues = getCustomStatusOptionsForDropdown(plugin.settings.data.globalSettings.tasksPluginCustomStatuses);
			customStatues.forEach((status) => {
				statusMenu.addItem((item) => {
					item.setTitle(status.text);
					// item.setIcon("eye-off"); // TODO : In future map lucude-icons with the ITS theme emoji icons for custom statuses.
					item.onClick(() => {
						updateTaskItemStatus(plugin, task, status.value);
					})
				});
			})
		});

		taskItemMenu.addSeparator();

		taskItemMenu.addItem((item) => {
			item.setTitle(t("quick-actions"));
			item.setIsLabel(true);
		});
		taskItemMenu.addItem((item) => {
			item.setTitle(t("copy-task-title"));
			item.setIcon("eye-off");
			item.onClick(async () => {
			});

			// Priority submenu
			taskItemMenu.addItem((item) => {
				item.setTitle(t("priority"));
				item.setIcon("flag");
				const priMenu = item.setSubmenu();
				const priorities = [
					{ label: t("none"), value: 0 },
					{ label: t("low"), value: 1 },
					{ label: t("medium"), value: 2 },
					{ label: t("high"), value: 3 },
				];
				priorities.forEach((p) => {
					priMenu.addItem((it) => {
						it.setTitle(p.label);
						it.onClick(() => updateTaskItemPriority(plugin, task, p.value));
					});
				});
			});

			// Dates submenu
			taskItemMenu.addItem((item) => {
				item.setTitle(t("dates"));
				item.setIcon("calendar");
				const dateMenu = item.setSubmenu();
				dateMenu.addItem((it) => {
					it.setTitle(t("start-date"));
					it.onClick(async () => {
						const newDate = await showTextInputModal(plugin.app, { title: t("set-start-date"), placeholder: 'YYYY-MM-DD', initialValue: task.startDate || '' });
						if (newDate) updateTaskItemDate(plugin, task, 'startDate', newDate);
					});
				});
				dateMenu.addItem((it) => {
					it.setTitle(t("scheduled-date"));
					it.onClick(async () => {
						const newDate = await showTextInputModal(plugin.app, { title: t("set-scheduled-date"), placeholder: 'YYYY-MM-DD', initialValue: task.scheduledDate || '' });
						if (newDate) updateTaskItemDate(plugin, task, 'scheduledDate', newDate);
					});
				});
				dateMenu.addItem((it) => {
					it.setTitle(t("due-date"));
					it.onClick(async () => {
						const newDate = await showTextInputModal(plugin.app, { title: t("set-due-date"), placeholder: 'YYYY-MM-DD', initialValue: task.due || '' });
						if (newDate) updateTaskItemDate(plugin, task, 'due', newDate);
					});
				});
			});

			// Reminder item - open prompt for date/time
			taskItemMenu.addItem((item) => {
				item.setTitle(t("reminder"));
				item.setIcon("clock");
				item.onClick(async () => {
					const newReminder = await showTextInputModal(plugin.app, { title: t("set-reminder"), placeholder: 'YYYY-MM-DD HH:mm', initialValue: task.reminder || '' });
					if (newReminder) updateTaskItemReminder(plugin, task, newReminder);
				});
			});

			// Tags editor modal
			taskItemMenu.addItem((item) => {
				item.setTitle(t("tags"));
				item.setIcon("tag");
				item.onClick(() => {
					const modal = new EditTagsModal(plugin, task.tags || [], (newTags: string[]) => {
						updateTaskItemTags(plugin, task, newTags.map((tg) => (tg.startsWith('#') ? tg : `#${tg}`)));
					});
					modal.open();
				});
			});
		});
		taskItemMenu.addItem((item) => {
			item.setTitle(t("open-note"));
			item.setIcon("eye-off");
			item.onClick(async () => {
			});
		});
		// Note actions submenu
		taskItemMenu.addItem((item) => {
			item.setTitle(t("contextMenus.task.noteActions"));
			item.setIcon("file-text");

			const submenu = (item as any).setSubmenu();

			// Get the file for the task
			const file = plugin.app.vault.getAbstractFileByPath(task.filePath);
			if (file instanceof TFile) {
				// Try to populate with Obsidian's native file menu
				try {
					// Trigger the file-menu event to populate with default actions
					plugin.app.workspace.trigger("file-menu", submenu, file, "file-explorer");
				} catch (error) {
					console.debug("Native file menu not available, using fallback");
				}

				// Add common file actions (these will either supplement or replace the native menu)
				submenu.addItem((subItem: any) => {
					subItem.setTitle(t("contextMenus.task.rename"));
					subItem.setIcon("pencil");
					subItem.onClick(async () => {
						try {
							// Modal-based rename
							const currentName = file.basename;
							const newName = await showTextInputModal(plugin.app, {
								title: t("contextMenus.task.renameTitle"),
								placeholder: t("contextMenus.task.renamePlaceholder"),
								initialValue: currentName,
							});

							if (newName && newName.trim() !== "" && newName !== currentName) {
								// Ensure the new name has the correct extension
								const extension = file.extension;
								const finalName = newName.endsWith(`.${extension}`)
									? newName
									: `${newName}.${extension}`;

								// Construct the new path
								const newPath = file.parent
									? `${file.parent.path}/${finalName}`
									: finalName;

								// Rename the file
								await plugin.app.vault.rename(file, newPath);
								new Notice(
									t("contextMenus.task.notices.renameSuccess") + finalName,

								);

								// // Trigger update callback
								// if (options.onUpdate) {
								// 	options.onUpdate();
								// }
							}
						} catch (error) {
							console.error("Error renaming file:", error);
							new Notice(t("contextMenus.task.notices.renameFailure"));
						}
					});
				});

				submenu.addItem((subItem: any) => {
					subItem.setTitle(t("delete-note"));
					subItem.setIcon("trash");
					subItem.onClick(async () => {
						// Show confirmation and delete
						const confirmed = await showConfirmationModal(plugin.app, {
							title: t("contextMenus.task.deleteTitle"),
							message: t("contextMenus.task.deleteMessage") + file.name,
							confirmText: t("contextMenus.task.deleteConfirm"),
							cancelText: t("common.cancel"),
							isDestructive: true,
						});
						if (confirmed) {
							plugin.app.vault.trash(file, true);
						}
					});
				});

				submenu.addSeparator();

				submenu.addItem((subItem: any) => {
					subItem.setTitle(t("contextMenus.task.copyPath"));
					subItem.setIcon("copy");
					subItem.onClick(async () => {
						try {
							await navigator.clipboard.writeText(file.path);
							new Notice(t("contextMenus.task.notices.copyPathSuccess"));
						} catch (error) {
							new Notice(t("contextMenus.task.notices.copyFailure"));
						}
					});
				});

				submenu.addItem((subItem: any) => {
					subItem.setTitle(t("contextMenus.task.copyUrl"));
					subItem.setIcon("link");
					subItem.onClick(async () => {
						try {
							const url = `obsidian://open?vault=${encodeURIComponent(plugin.app.vault.getName())}&file=${encodeURIComponent(file.path)}`;
							await navigator.clipboard.writeText(url);
							new Notice(t("contextMenus.task.notices.copyUrlSuccess"));
						} catch (error) {
							new Notice(t("contextMenus.task.notices.copyFailure"));
						}
					});
				});

				submenu.addSeparator();

				submenu.addItem((subItem: any) => {
					subItem.setTitle(t("contextMenus.task.showInExplorer"));
					subItem.setIcon("folder-open");
					subItem.onClick(() => {
						// Reveal file in file explorer
						plugin.app.workspace
							.getLeaf()
							.setViewState({
								type: "file-explorer",
								state: {},
							})
							.then(() => {
								// Focus the file in the explorer
								const fileExplorer =
									plugin.app.workspace.getLeavesOfType("file-explorer")[0];
								if (fileExplorer?.view && "revealInFolder" in fileExplorer.view) {
									(fileExplorer.view as any).revealInFolder(file);
								}
							});
					});
				});
			}
		});

		// // Show minimize or maximize option based on current state
		// if (columnData.minimized) {
		// 	taskItemMenu.addItem((item) => {
		// 		item.setTitle(t("maximize-column"));
		// 		item.setIcon("panel-left-open");
		// 		item.onClick(async () => {
		// 			await handleMinimizeColumn();
		// 		});
		// 	});
		// } else {
		// 	taskItemMenu.addItem((item) => {
		// 		item.setTitle(t("minimize-column"));
		// 		item.setIcon("panel-left-close");
		// 		item.onClick(async () => {
		// 			await handleMinimizeColumn();
		// 		});
		// 	});
		// }

		// Use native event if available (React event has nativeEvent property)
		taskItemMenu.showAtMouseEvent(
			(event instanceof MouseEvent ? event : event.nativeEvent)
		);
	}

	// Handlers for drag and drop
	const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		console.log("TaskItem : handleDragStart...");
		if (!columnData) {
			e.preventDefault();
			console.warn('handleDragStart: columnData is undefined');
			return;
		}

		setIsDragging(true);
		// Delegate to manager for standardized behavior (sets current payload and dims element)
		try {
			const el = taskItemRef.current as HTMLDivElement;
			const payload: currentDragDataPayload = { task, sourceColumnData: columnData, currentBoardIndex: activeBoardSettings.index, swimlaneData: swimlaneData };
			dragDropTasksManagerInsatance.handleDragStartEvent(e.nativeEvent as DragEvent, el, payload, 0);

			// Add dragging class after a small delay to not affect the drag image
			const clone = el.cloneNode(true) as HTMLDivElement;
			e.dataTransfer?.setDragImage(el, 0, 0);
			requestAnimationFrame(() => {
				clone.classList.add("task-item-dragging");
				console.log("TaskItem : handleDragStart... done : ", el);
			});

			// Also set a drag image from the whole task element so the preview is the full card
			// TODO : The drag image is taking too much width and also its still in its default state, like very dimmed opacity. Improve it to get a nice border and increase the opacity so it looks more real.
			// if (taskItemRef.current && e.dataTransfer) {
			// 	console.log("TaskItemRef.current", taskItemRef.current);
			// 	const clone = taskItemRef.current.cloneNode(true) as HTMLElement;
			// 	// clone.style.boxShadow = '0 8px 16px rgba(0,0,0,0.12)';
			// 	clone.style.opacity = '0.5';
			// 	clone.style.position = 'absolute';
			// 	// clone.style.top = '-9999px';
			// 	// document.body.appendChild(clone);
			// 	const rect = taskItemRef.current.getBoundingClientRect();
			// 	e.dataTransfer.setDragImage(clone, rect.width, rect.height);
			// 	setTimeout(() => {
			// 		try { document.body.removeChild(clone); } catch { }
			// 	}, 0);
			// }
		} catch (err) {
			// fallback minimal behavior
			// try {
			// 	e.dataTransfer.setData('application/json', JSON.stringify({ task, sourceColumnData: columnData }));
			// 	e.dataTransfer.effectAllowed = 'move';
			// } catch (ex) {/* ignore */ }

			console.error(err);
		}
	}, [task, columnData]);

	const handleDragEnd = useCallback(() => {
		console.log("TaskItem : handleDragEnd...");
		setIsDragging(false);

		// Remove dim effect from this dragged task and clear manager state
		if (taskItemRef.current) {
			dragDropTasksManagerInsatance.removeDimFromDraggedTaskItem(taskItemRef.current);
		}

		// Clear manager drag payload and any styling on columns/task-items
		dragDropTasksManagerInsatance.clearAllDragStyling();
		dragDropTasksManagerInsatance.clearCurrentDragData();
	}, []);

	// ========================================
	// ALL RENDERING CODE
	// ========================================

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
										if (
											(!activeBoardSettings?.showColumnTags) &&
											columnData &&
											columnData?.colType === colTypeNames.namedTag &&
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
										onDoubleClick={(e) => {
											e.preventDefault();
										}}
									/>
									{/* Render each subtask separately */}
									<div
										className={isSubTaskCompleted ? `subtaskTextRenderer subtaskTextRenderer-checked` : `subtaskTextRenderer`}
										ref={(el) => {
											if (el) {
												subtaskTextRefs.current.set(uniqueKey, el);
											} else {
												subtaskTextRefs.current.delete(uniqueKey);
											}
										}}
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

	// ========================================
	// RETURN STATEMENT (UPDATED)
	// ========================================
	return (
		<div className='taskItemContainer'>
			<div
				ref={taskItemRef}
				className={`taskItem ${isThistaskCompleted ? 'completed' : ''} ${isDragging ? 'taskItem-dragging' : ''}`}
				key={taskIdKey}
				style={{ backgroundColor: getCardBgBasedOnTag(task.tags) }}
				onDoubleClick={handleDoubleClickOnCard}
				onContextMenu={handleMenuButtonClicked}
			>
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
					{/* Drag Handle */}
					{Platform.isPhone && (
						<>
							<div className="taskItemMenuBtn" aria-label={t("open-task-menu")}><EllipsisVertical size={14} enableBackground={0} opacity={0.4} onClick={handleMenuButtonClicked} /></div>
						</>
					)}
					{!Platform.isPhone && (
						<>
							<div className="taskItemDragBtn"
								aria-label={t("drag-task-card")}
								draggable={true}
								onDragStart={handleDragStart}
								onDragEnd={handleDragEnd}
							>
								<RxDragHandleDots2 size={14} enableBackground={0} opacity={0.4} />
							</div>
						</>
					)}
					<div className="taskItemMainBody">
						<div className="taskItemMainBodyTitleNsubTasks">
							<input
								id={`${task.id}-checkbox`}
								type="checkbox"
								checked={false}
								className={`taskItemCheckbox${cardLoadingAnimation ? '-checked' : ''}`}
								data-task={task.status}
								dir='auto'
								onChange={handleMainCheckBoxClick}
								onClick={(e) => {
									if (cardLoadingAnimation) {
										e.preventDefault();
									}
								}}
								onDoubleClick={(e) => {
									e.preventDefault();
								}}
								disabled={cardLoadingAnimation}
								aria-disabled={cardLoadingAnimation}
								aria-busy={cardLoadingAnimation}
								readOnly={cardLoadingAnimation}
							/>
							<div className="taskItemBodyContent">
								<div className="taskItemTitle" ref={taskTitleRendererRef} />
								<div className="taskItemBody">
									{memoizedRenderSubTasks}
								</div>
							</div>
						</div>
						{showDescriptionSection && (
							<div className='taskItemMainBodyDescriptionSectionVisible'>
								{renderDescriptionSection()}
							</div>
						)}
						{!showDescriptionSection && (
							<div className="taskItemMainBodyDescription">
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
							</div>
						)}
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
