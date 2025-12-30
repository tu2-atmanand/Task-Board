// src/components/KanbanView/LazyColumn.tsx

import React, { memo, useMemo, useState, useEffect, useRef, useCallback } from 'react';

import { CSSProperties } from 'react';
import TaskItem, { swimlaneDataProp } from './TaskItem';
import { t } from 'src/utils/lang/helper';
import TaskBoard from 'main';
import { Board, ColumnData, RootFilterState } from 'src/interfaces/BoardConfigs';
import { taskItem } from 'src/interfaces/TaskItem';
import { Menu, Platform } from 'obsidian';
import { ViewTaskFilterPopover } from 'src/components/BoardFilters/ViewTaskFilterPopover';
import { eventEmitter } from 'src/services/EventEmitter';
import { bugReporter } from 'src/services/OpenModals';
import { ViewTaskFilterModal } from 'src/components/BoardFilters';
import { ConfigureColumnSortingModal } from 'src/modals/ConfigureColumnSortingModal';
import { matchTagsWithWildcards } from 'src/utils/algorithms/ScanningFilterer';
import { isRootFilterStateEmpty } from 'src/utils/algorithms/BoardFilterer';
import { dragDropTasksManagerInsatance, currentDragDataPayload } from 'src/managers/DragDropTasksManager';

type CustomCSSProperties = CSSProperties & {
	'--task-board-column-width': string;
};

export interface LazyColumnProps {
	plugin: TaskBoard;
	columnIndex: number;
	activeBoardData: Board;
	collapsed?: boolean;
	columnData: ColumnData;
	tasksForThisColumn: taskItem[];
	swimlaneData?: swimlaneDataProp;
	hideColumnHeader?: boolean;
	headerOnly?: boolean;
}

const LazyColumn: React.FC<LazyColumnProps> = ({
	plugin,
	columnIndex,
	activeBoardData,
	columnData,
	tasksForThisColumn,
	swimlaneData,
	hideColumnHeader = false,
	headerOnly = false,
}) => {
	if (!headerOnly && activeBoardData?.hideEmptyColumns && (tasksForThisColumn === undefined || tasksForThisColumn?.length === 0)) {
		return null; // Don't render the column if it has no tasks and empty columns are hidden
	}

	// Lazy loading settings from plugin
	const lazySettings = plugin.settings.data.globalSettings.kanbanView;
	const initialTaskCount = lazySettings.initialTaskCount || 20;
	const loadMoreCount = lazySettings.loadMoreCount || 10;
	const scrollThresholdPercent = lazySettings.scrollThresholdPercent || 80;

	// State for managing visible tasks
	const [visibleTaskCount, setVisibleTaskCount] = useState(initialTaskCount);
	const tasksContainerRef = useRef<HTMLDivElement>(null);

	// Drag and drop state
	const [isDragOver, setIsDragOver] = useState(false);
	const [insertIndex, setInsertIndex] = useState<number | null>(null);
	const insertIndexRef = useRef<number | null>(null);
	const rafRef = useRef<number | null>(null);
	const [localTasks, setLocalTasks] = useState(tasksForThisColumn);

	const scheduleSetInsertIndex = (pos: number | null) => {
		if (insertIndexRef.current === pos) return;
		if (rafRef.current) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
		rafRef.current = requestAnimationFrame(() => {
			insertIndexRef.current = pos;
			setInsertIndex(pos);
			rafRef.current = null;
		});
	};

	// Memoize all tasks
	const allTasks = useMemo(() => tasksForThisColumn, [tasksForThisColumn]);
	// Memoize visible tasks based on count
	const visibleTasks = useMemo(() => {
		if (allTasks && allTasks?.length < 1) return [];

		return allTasks?.slice(0, visibleTaskCount) ?? [];
	}, [allTasks, visibleTaskCount]);

	// Reset visible count when tasks change (e.g., switching boards or filtering)
	useEffect(() => {
		setVisibleTaskCount(initialTaskCount);
	}, [tasksForThisColumn, initialTaskCount]);

	// Detect external changes in tasksForThisColumn for drag-drop
	useEffect(() => {
		setLocalTasks(tasksForThisColumn);
	}, [tasksForThisColumn]);

	// Scroll event handler
	const handleScroll = useCallback(() => {
		const container = tasksContainerRef.current;
		if (!container) return;

		const { scrollTop, scrollHeight, clientHeight } = container;
		const scrollPercentage = ((scrollTop + clientHeight) / scrollHeight) * 100;

		// Load more tasks when scroll threshold is reached and there are more tasks to load
		if (scrollPercentage >= scrollThresholdPercent && visibleTaskCount < allTasks?.length) {
			setVisibleTaskCount((prevCount) => {
				const newCount = Math.min(prevCount + loadMoreCount, allTasks?.length);
				return newCount;
			});
		}
	}, [scrollThresholdPercent, visibleTaskCount, allTasks?.length, loadMoreCount]);

	// Attach scroll listener
	useEffect(() => {
		const container = tasksContainerRef.current;
		if (!container) return;

		// Throttle scroll events for performance
		let throttleTimeout: NodeJS.Timeout | null = null;
		const throttledScroll = () => {
			if (throttleTimeout) return;
			throttleTimeout = setTimeout(() => {
				handleScroll();
				throttleTimeout = null;
			}, 100);
		};

		container.addEventListener('scroll', throttledScroll);
		return () => {
			container.removeEventListener('scroll', throttledScroll);
			if (throttleTimeout) clearTimeout(throttleTimeout);
		};
	}, [handleScroll]);

	const columnWidth = plugin.settings.data.globalSettings.columnWidth || '273px';

	// Extra code to provide special data-types for theme support.
	const tagColors = plugin.settings.data.globalSettings.tagColors;
	const tagColorMap = new Map(tagColors.map((t) => [t.name, t]));
	let tagData = tagColorMap.get(columnData?.coltag || '');
	if (!tagData) {
		tagColorMap.forEach((tagColor, tagNameKey) => {
			const result = matchTagsWithWildcards(tagNameKey, columnData?.coltag || '');
			if (result) tagData = tagColor;
		});
	}

	// Determine whether an advanced filter is applied (used by header count UI)
	const isAdvancedFilterApplied = !isRootFilterStateEmpty(columnData.filters);

	// If this column is requested to render header-only (used by swimlane top header), return just the header UI
	if (headerOnly) {
		return (
			<div
				className={`TaskBoardColumnsSection swimlaneMode${columnData.minimized ? ' minimized' : ''}`}
				data-column-id={columnData.id}
				style={{ '--task-board-column-width': columnData.minimized ? '3rem' : columnWidth } as CustomCSSProperties}
				data-column-type={columnData.colType}
				data-column-tag-name={tagData?.name}
				data-column-tag-color={tagData?.color}
			>
				{columnData.minimized ? (
					<div className={`taskBoardColumnSecHeaderTitleSecColumnCount ${isAdvancedFilterApplied ? 'active' : ''}`} onClick={(evt) => openColumnMenu(evt)} aria-label={t("open-column-menu")}>{allTasks?.length ?? 0}</div>
				) : (
					<div className="taskBoardColumnSecHeader">
						<div className="taskBoardColumnSecHeaderTitleSec">
							<div className="taskBoardColumnSecHeaderTitleSecColumnTitle">{columnData.name}</div>
						</div>
						<div className={`taskBoardColumnSecHeaderTitleSecColumnCount ${isAdvancedFilterApplied ? 'active' : ''}`} onClick={(evt) => openColumnMenu(evt)} aria-label={t("open-column-menu")}>
							{allTasks?.length ?? 0}
						</div>
					</div>
				)}
			</div>
		);
	}

	async function handleMinimizeColumn() {
		const boardIndex = plugin.settings.data.boardConfigs.findIndex(
			(board: Board) => board.name === activeBoardData.name
		);

		if (boardIndex !== -1) {
			const columnIndex = plugin.settings.data.boardConfigs[boardIndex].columns.findIndex(
				(col: ColumnData) => col.name === columnData.name
			);

			if (columnIndex !== -1) {
				plugin.settings.data.boardConfigs[boardIndex].columns[columnIndex].minimized = !plugin.settings.data.boardConfigs[boardIndex].columns[columnIndex].minimized;
				await plugin.saveSettings();
				eventEmitter.emit('REFRESH_BOARD');
			}
		}
	}

	/**
	 * Opens the column menu, which allows the user to sort and filter the tasks in the column,
	 * configure the column's sorting and filtering, and hide the column.
	 *
	 * @param {MouseEvent | React.MouseEvent} event - The event that triggered the menu
	 */
	function openColumnMenu(event: MouseEvent | React.MouseEvent) {
		const columnMenu = new Menu();

		columnMenu.addItem((item) => {
			item.setTitle(t("sort-and-filter"));
			item.setIsLabel(true);
		});
		columnMenu.addItem((item) => {
			item.setTitle(t("configure-column-sorting"));
			item.setIcon("arrow-up-down");
			item.onClick(async () => {
				// open sorting modal
				const modal = new ConfigureColumnSortingModal(
					plugin,
					columnData,
					(updatedColumnConfiguration: ColumnData) => {
						// Update the column configuration in the board data
						const boardIndex = plugin.settings.data.boardConfigs.findIndex(
							(board: Board) => board.name === activeBoardData.name
						);

						if (boardIndex !== -1) {
							const columnIndex = plugin.settings.data.boardConfigs[boardIndex].columns.findIndex(
								(col: ColumnData) => col.name === columnData.name
							);

							if (columnIndex !== -1) {
								// Update the column configuration
								plugin.settings.data.boardConfigs[boardIndex].columns[columnIndex] = updatedColumnConfiguration;

								// Save the settings
								plugin.saveSettings();

								eventEmitter.emit('REFRESH_BOARD');
							}
						}
					},
					() => {
						// onCancel callback - nothing to do
					}
				);
				modal.open();
			});
		});
		columnMenu.addItem((item) => {
			item.setTitle(t("configure-column-filtering"));
			item.setIcon("list-filter");
			item.onClick(async () => {
				try {
					// TODO : The indexes are finding using the name, this might create issues if there are duplicate names. Use the id to find the indexes.
					// Find board index once
					const boardIndex = plugin.settings.data.boardConfigs.findIndex(
						(board: Board) => board.name === activeBoardData.name
					);
					const columnIndex = plugin.settings.data.boardConfigs[boardIndex].columns.findIndex(
						(col: ColumnData) => col.name === columnData.name
					);

					if (Platform.isMobile || Platform.isMacOS) {
						// If its a mobile platform, then we will open a modal instead of popover.
						const filterModal = new ViewTaskFilterModal(
							plugin, true, undefined, boardIndex, columnData.name, columnData.filters
						);

						// Set the close callback - mainly used for handling cancel actions
						filterModal.filterCloseCallback = async (filterState) => {
							if (filterState && boardIndex !== -1) {
								if (columnIndex !== -1) {
									// Update the column filters
									plugin.settings.data.boardConfigs[boardIndex].columns[columnIndex].filters = filterState;

									// Save the settings
									await plugin.saveSettings();

									// Refresh the board view
									eventEmitter.emit('REFRESH_BOARD');
								}
							}
						};

						filterModal.open();
					} else {
						// Get the position of the menu (approximate column position)
						// Use CSS.escape to properly escape the selector value
						const escapedTag = columnData.coltag ? CSS.escape(columnData.coltag) : '';
						const columnElement = document.querySelector(`[data-column-tag-name="${escapedTag}"]`) as HTMLElement;
						const position = columnElement
							? { x: columnElement.getBoundingClientRect().left, y: columnElement.getBoundingClientRect().top + 40 }
							: { x: 100, y: 100 }; // Fallback position

						// Create and show filter popover
						// leafId is undefined for column filters (not tied to a specific leaf)
						const popover = new ViewTaskFilterPopover(
							plugin,
							true, // forColumn is true
							undefined,
							boardIndex,
							columnData.name,
							columnData.filters
						);

						// Set up close callback to save filter state
						popover.onClose = async (filterState?: RootFilterState) => {
							if (filterState && boardIndex !== -1) {
								if (columnIndex !== -1) {
									// Update the column filters
									plugin.settings.data.boardConfigs[boardIndex].columns[columnIndex].filters = filterState;

									// Save the settings
									await plugin.saveSettings();

									// Refresh the board view
									eventEmitter.emit('REFRESH_BOARD');
								}
							}
						};

						popover.showAtPosition(position);
					}
				} catch (error) {
					bugReporter(plugin, "Error showing filter popover", String(error), "Column.tsx/column-menu/configure-conlum-filters");
				}
			});
		});

		columnMenu.addSeparator();

		columnMenu.addItem((item) => {
			item.setTitle(t("quick-actions"));
			item.setIsLabel(true);
		});
		columnMenu.addItem((item) => {
			item.setTitle(t("hide-column"));
			item.setIcon("eye-off");
			item.onClick(async () => {
				// Find the board and column indices
				const boardIndex = plugin.settings.data.boardConfigs.findIndex(
					(board: Board) => board.name === activeBoardData.name
				);

				if (boardIndex !== -1) {
					const columnIndex = plugin.settings.data.boardConfigs[boardIndex].columns.findIndex(
						(col: ColumnData) => col.name === columnData.name
					);

					if (columnIndex !== -1) {
						// Set the active property to false
						plugin.settings.data.boardConfigs[boardIndex].columns[columnIndex].active = false;

						// Save the settings
						await plugin.saveSettings();

						// Refresh the board view
						eventEmitter.emit('REFRESH_BOARD');
					}
				}
			});
		});

		// Show minimize or maximize option based on current state
		if (columnData.minimized) {
			columnMenu.addItem((item) => {
				item.setTitle(t("maximize-column"));
				item.setIcon("panel-left-open");
				item.onClick(async () => {
					await handleMinimizeColumn();
				});
			});
		} else {
			columnMenu.addItem((item) => {
				item.setTitle(t("minimize-column"));
				item.setIcon("panel-left-close");
				item.onClick(async () => {
					await handleMinimizeColumn();
				});
			});
		}

		// Use native event if available (React event has nativeEvent property)
		columnMenu.showAtMouseEvent(
			(event instanceof MouseEvent ? event : event.nativeEvent)
		);
	}

	/**
	 * Handles the drop event of a task in this column.
	 * Moves the task from its original position (dragIndex) to the new position (dropIndex).
	 * Updates the localTasks state and the columnData.tasksIdManualOrder if the column uses manualOrder.
	 * Clears the raf timer to prevent any pending raf calls.
	 * @param {React.DragEvent<HTMLDivElement>} e - The drag event.
	 * @param {number} dropIndex - The index at which to drop the task.
	 */
	const handleTaskDrop = async (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
		e.preventDefault();
		setIsDragOver(false);
		setInsertIndex(null);

		const targetColumnContainer = tasksContainerRef.current;
		if (!targetColumnContainer) {
			return;
		}

		// We are basically doing same thing from the handleDrop function below.
		dragDropTasksManagerInsatance.handleDropEvent(
			e.nativeEvent,
			columnData,
			targetColumnContainer,
			swimlaneData
		);

		// Clear manager payload (drag finished)
		dragDropTasksManagerInsatance.clearCurrentDragData();
		dragDropTasksManagerInsatance.clearDesiredDropIndex();

		// const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
		// if (isNaN(dragIndex) || dragIndex === dropIndex) return;
		// const updated = [...localTasks];
		// const [moved] = updated.splice(dragIndex, 1);
		// updated.splice(dropIndex, 0, moved);
		// setLocalTasks(updated);
		// // If this column uses manualOrder, update the columnData.tasksIdManualOrder to reflect new order
		// const hasManualOrder = Array.isArray(columnData.sortCriteria) && columnData.sortCriteria.some((c) => c.criteria === 'manualOrder');
		// if (hasManualOrder) {
		// 	columnData.tasksIdManualOrder = updated.map(t => t.id);
		// }

		// clear any pending raf
		if (rafRef.current) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
	};

	const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(false);

		try {
			// Get the data of the dragged task -- No need anymore, since its already stored in the dragdropmanager.
			// const taskData = e.dataTransfer.getData('application/json');
			// if (taskData) {
			// 	const { task, sourceColumnData } = JSON.parse(taskData);

			// 	// Ensure we have valid data
			// 	if (!task || !sourceColumnData) return;

			// Get the target column container
			const targetColumnContainer = (e.currentTarget) as HTMLDivElement;


			// Try to locate the source container by stable column id first (works for all colTypes) -- No need to find this anymore, since I am not making use of sourceColumnContainer in dragdropmanager.
			// 	let sourceColumnContainer: HTMLDivElement | null = null;
			// 	if (sourceColumnData?.id) {
			// 		try {
			// 			const escapedId = CSS.escape(String(sourceColumnData.id));
			// 			sourceColumnContainer = document.querySelector(`.TaskBoardColumnsSection[data-column-id="${escapedId}"]`) as HTMLDivElement | null;
			// 		} catch (err) {
			// 			// fallback to tag-based lookup below
			// 		}
			// 	}
			// 	if (!sourceColumnContainer) {
			// 		// Fallback: find by tag name (legacy behavior)
			// 		console.log("------------- I hope this fall-back mechanism is never running -------------");
			// 		const allColumnContainers = Array.from(document.querySelectorAll('.TaskBoardColumnsSection')) as HTMLDivElement[];
			// 		sourceColumnContainer = allColumnContainers.find(container => {
			// 			const containerTag = container.getAttribute('data-column-tag-name');
			// 			return containerTag === sourceColumnData.coltag || sourceColumnData.coltag?.includes(containerTag || '');
			// 		}) || targetColumnContainer;
			// 	}

			// we will allow cross-column drops now with target column having manualOrder sortCriteria. Disabling below code.
			// const hasManualOrder = Array.isArray(columnData.sortCriteria) && columnData.sortCriteria.some((c) => c.criteria === 'manualOrder');
			// if (hasManualOrder && sourceColumnData.id !== columnData.id) {
			// 	// Not allowed: ignore drop
			// 	dragDropTasksManagerInsatance.clearCurrentDragData();
			// 	dragDropTasksManagerInsatance.clearDesiredDropIndex();
			// 	return;
			// }

			// // Use the DragDropTasksManager to handle the drop
			// try {
			// 	const dragIdxStr = e.dataTransfer.getData('text/plain');
			// 	const dragIdx = dragIdxStr ? parseInt(dragIdxStr) : NaN;
			// 	if (sourceColumnData.coltag === columnData.coltag && !isNaN(dragIdx) && insertIndexRef.current !== null) {
			// 		// Reorder locally
			// 		const updated = [...localTasks];
			// 		const [moved] = updated.splice(dragIdx, 1);
			// 		updated.splice(insertIndexRef.current!, 0, moved);
			// 		setLocalTasks(updated);
			// 		setInsertIndex(null);
			// 		insertIndexRef.current = null;
			// 		// Update manual order if applicable
			// 		const hasManualOrderLocal = Array.isArray(columnData.sortCriteria) && columnData.sortCriteria.some((c) => c.criteria === 'manualOrder');
			// 		if (hasManualOrderLocal) {
			// 			columnData.tasksIdManualOrder = updated.map(t => t.id);
			// 		}
			// 		// Clear manager payload and skip default handling
			// 		dragDropTasksManagerInsatance.clearCurrentDragData();
			// 		dragDropTasksManagerInsatance.clearDesiredDropIndex();
			// 		return;
			// 	}
			// } catch (err) {
			// 	// ignore and continue to default handling
			// }

			dragDropTasksManagerInsatance.handleDropEvent(
				e.nativeEvent,
				columnData,
				targetColumnContainer,
				swimlaneData
			);

			// Clear manager payload (drag finished)
			dragDropTasksManagerInsatance.clearCurrentDragData();
			dragDropTasksManagerInsatance.clearDesiredDropIndex();
			// }
		} catch (error) {
			console.error('Error handling task drop:', error);
		}
	}, [columnData, plugin]);

	// This function will be only run when user will drag the taskItem on another taskItem.
	// Compute insertion index based on mouse Y relative to task items inside the container.
	const handleTaskItemDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(true);
		try {
			// Only compute insertion index for columns that use "manualOrder" as the sorting criteria.
			const hasManualOrder = Array.isArray(columnData.sortCriteria) && columnData.sortCriteria.some((c) => c.criteria === 'manualOrder');
			console.log('hasManualOrder', hasManualOrder);
			if (!hasManualOrder) {
				// Clear any visual placeholder and desired index
				if (insertIndexRef.current !== null) {
					scheduleSetInsertIndex(null);
				}
				dragDropTasksManagerInsatance.clearDesiredDropIndex();
				return;
			} else {
				// APPROACH 1 - COMPUTE INSERTION INDEX BASED ON MOUSE Y POSITION BY COMPARING WITH TASK ITEM BOUNDING RECTANGLES
				// Else will proceed with finding the insertion index
				// const container = e.currentTarget.parentElement as HTMLDivElement;
				// const children = Array.from(container.querySelectorAll('.taskItemFadeIn')) as HTMLElement[];
				// let pos = children.length; // default to end
				// const clientY = e.clientY;
				// for (let i = 0; i < children.length; i++) {
				// 	const child = children[i];
				// 	const rect = child.getBoundingClientRect();
				// 	const midpoint = rect.top + rect.height / 2;
				// 	if (clientY < midpoint) {
				// 		pos = i;
				// 		break;
				// 	}
				// }

				// APPROACH 2 - DIRECTLY FETCH THE INDEX FROM THE DATA ATTRIBUTE OF THE HOVERED ELEMENT
				let pos = 0 // Default to top of the column
				const hoveredElement = e.currentTarget;
				const dataAttribute = hoveredElement.getAttribute('data-taskitem-index');
				console.log('dataAttribute', dataAttribute);
				if (dataAttribute) {
					const clientY = e.clientY;
					const rect = hoveredElement.getBoundingClientRect();
					const midpoint = rect.top + rect.height / 2;
					if (clientY < midpoint) {
						pos = parseInt(dataAttribute, 10);
					} else {
						pos = parseInt(dataAttribute, 10) + 1;
					}
				}


				// Throttle updates via RAF
				scheduleSetInsertIndex(pos);
				// Store desired drop index in manager
				dragDropTasksManagerInsatance.setDesiredDropIndex(pos);

				// // Use the DragDropTasksManager to handle the drag over (this sets classes and dropEffect)
				// dragDropTasksManagerInsatance.handleDragOver(
				// 	e.nativeEvent,
				// 	columnData,
				// 	container
				// );

				const targetColumnContainer = tasksContainerRef.current as HTMLDivElement;
				dragDropTasksManagerInsatance.handleCardDragOverEvent(e.nativeEvent as DragEvent, e.currentTarget as HTMLDivElement, targetColumnContainer, columnData);
			}
		} catch (error) {
			console.error('Error computing insert index:', error);
		}
	}, [scheduleSetInsertIndex, columnData]);

	const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(true);
		try {
			// // Try to read payload from the DataTransfer first
			// let taskDataStr = '';
			// try {
			// 	taskDataStr = e.dataTransfer.getData('application/json');
			// } catch (err) {
			// 	// ignore - some environments restrict access
			// }

			// let payload: any = null;
			// if (taskDataStr) {
			// 	try { payload = JSON.parse(taskDataStr); } catch { }
			// }

			// // Fallback to manager-stored payload if dataTransfer is empty
			// if (!payload) {
			// 	payload = dragDropTasksManagerInsatance.getCurrentDragData();
			// }

			// if (!payload) return;

			// const { task, sourceColumnData } = payload;
			// if (!task || !sourceColumnData) return;

			// Get the target column container
			const targetColumnContainer = (e.currentTarget) as HTMLDivElement;

			// // Try id-based lookup first
			// let sourceColumnContainer: HTMLDivElement | null = null;
			// if (sourceColumnData?.id) {
			// 	try {
			// 		const escapedId = CSS.escape(String(sourceColumnData.id));
			// 		sourceColumnContainer = document.querySelector(`.TaskBoardColumnsSection[data-column-id="${escapedId}"]`) as HTMLDivElement | null;
			// 	} catch (err) {
			// 		// ignore and fall back to tag-based lookup
			// 	}
			// }
			// if (!sourceColumnContainer) {
			// 	const allColumnContainers = Array.from(document.querySelectorAll('.TaskBoardColumnsSection')) as HTMLDivElement[];
			// 	sourceColumnContainer = allColumnContainers.find(container => {
			// 		const containerTag = container.getAttribute('data-column-tag-name');
			// 		return containerTag === sourceColumnData.coltag || sourceColumnData.coltag?.includes(containerTag || '');
			// 	}) || targetColumnContainer;
			// }

			// Use the DragDropTasksManager to handle the drag over (this sets classes and dropEffect)
			dragDropTasksManagerInsatance.handleColumnDragOverEvent(
				e.nativeEvent,
				columnData,
				targetColumnContainer
			);

			// Below code is not required, since, I will call the dragDropTasksManagerInsatance.handleCardDragOverEvent from handleTaskItemDragOver.
			// // If hovering over an actual card element, show card drop indicator
			// try {
			// 	const hovered = (e.target as HTMLElement).closest('.taskItem') as HTMLElement | null;
			// 	if (hovered) {
			// 		dragDropTasksManagerInsatance.handleCardDragOverEvent(e.nativeEvent as DragEvent, hovered);
			// 	}
			// } catch (err) {
			// 	// ignore
			// }

			// // Ensure cursor reflects allowed/not-allowed (best-effort fallback)
			// const allowed = dragDropTasksManagerInsatance.isTaskDropAllowed(sourceColumnData, columnData);
			// e.dataTransfer!.dropEffect = allowed ? 'move' : 'none';
		} catch (error) {
			console.error('Error handling drag over:', error);
		}
	}, [columnData]);

	// Cleanup any pending RAF on unmount
	useEffect(() => {
		return () => {
			if (rafRef.current) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
		};
	}, []);

	// Handle the dragleave event to remove the visual effect
	const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		// Avoid flicker: if the drag event indicates the pointer is still within the container bounds,
		// ignore this dragleave (this happens when moving between child elements).
		try {
			const container = e.currentTarget as HTMLElement;
			const x = e.clientX;
			const y = e.clientY;
			if (typeof x === 'number' && typeof y === 'number') {
				const rect = container.getBoundingClientRect();
				if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
					// still inside container — ignore to prevent CSS flicker
					return;
				}
			}
		} catch (err) {
			// ignore and continue cleanup
		}

		setIsDragOver(false);
		setInsertIndex(null);
		dragDropTasksManagerInsatance.clearDesiredDropIndex();
		// Let manager clean up the dropindicator and column highlight
		dragDropTasksManagerInsatance.handleDragLeaveEvent(e.currentTarget as HTMLDivElement);
	}, []);


	return (
		<div
			className={`TaskBoardColumnsSection${columnData.minimized ? ' minimized' : ''}`}
			data-column-id={columnData.id}
			style={{ '--task-board-column-width': columnData.minimized ? '3rem' : columnWidth } as CustomCSSProperties}
			data-column-type={columnData.colType}
			data-column-tag-name={tagData?.name}
			data-column-tag-color={tagData?.color}
		>
			{columnData.minimized && !hideColumnHeader ? (
				// Minimized view
				<div className="taskBoardColumnMinimized">
					<div className={`taskBoardColumnSecHeaderTitleSecColumnCount ${isAdvancedFilterApplied ? 'active' : ''}`} onClick={(evt) => openColumnMenu(evt)} aria-label={t("open-column-menu")}>
						{allTasks?.length ?? 0}
					</div>
					<div className="taskBoardColumnMinimizedTitle" onClick={async () => {
						await handleMinimizeColumn();
						eventEmitter.emit('REFRESH_BOARD');
					}}>{columnData.name}</div>
				</div>
			) : (
				// Normal view
				<>
					{!hideColumnHeader && (
						<div className="taskBoardColumnSecHeader">
							<div className="taskBoardColumnSecHeaderTitleSec">
								<div className="taskBoardColumnSecHeaderTitleSecColumnTitle">{columnData.name}</div>
							</div>
							<div className={`taskBoardColumnSecHeaderTitleSecColumnCount ${isAdvancedFilterApplied ? 'active' : ''}`} onClick={(evt) => openColumnMenu(evt)} aria-label={t("open-column-menu")}>
								{allTasks?.length ?? 0}
							</div>
						</div>
					)}
					<div
						className={`tasksContainer${plugin.settings.data.globalSettings.showVerticalScroll ? '' : '-SH'}`}
						ref={tasksContainerRef}
						onDragOver={(e) => { handleDragOver(e); }}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
						onDragEnd={(e) => { setIsDragOver(false); setInsertIndex(null); dragDropTasksManagerInsatance.clearAllDragStyling(); }}
					>
						{columnData.minimized ? <></> : (
							<>
								{visibleTasks && visibleTasks.length > 0 ? (
									<>
										{(() => {
											const elements: React.ReactNode[] = [];
											for (let i = 0; i < visibleTasks.length; i++) {
												const task = visibleTasks[i];
												elements.push(
													<div
														key={task.id}
														className="taskItemFadeIn"
														data-taskitem-index={i}
														onDragOver={(e) => { handleTaskItemDragOver(e); }
														}
														onDrop={e => handleTaskDrop(e, i)}
													>
														<TaskItem
															key={task.id}
															plugin={plugin}
															task={task}
															activeBoardSettings={activeBoardData}
															columnIndex={columnIndex}
															swimlaneData={swimlaneData}
														/>
													</div>
												);
											}
											return elements;
										})()}
										{allTasks && visibleTaskCount < allTasks.length && (
											<div className="lazyLoadIndicator">
												<p>{t("scroll-to-load-more")} ({visibleTaskCount} / {allTasks.length ?? 0})</p>
											</div>
										)}
									</>
								) : (
									<div onDragOver={(e) => { e.preventDefault(); }}>
										<p className='tasksContainerNoTasks'>{t("no-tasks-available")}</p>
									</div>
								)}
							</>
						)
						}
					</div>
				</>
			)
			}
		</div >
	);
};

export default memo(LazyColumn);
