// src/components/KanbanView/LazyColumn.tsx

import React, { memo, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { CSSProperties } from 'react';
import { Menu, Notice, Platform } from 'obsidian';
import { t } from 'i18next';
import { AlertOctagon } from 'lucide-react';
import TaskBoard from '../../../main.js';
import { Board, KanbanView, ColumnData, RootFilterState } from '../../interfaces/BoardConfigs.js';
import { taskCardStyleNames, viewTypeNames } from '../../interfaces/Enums.js';
import { taskItem } from '../../interfaces/TaskItem.js';
import { bugReporterManagerInsatance } from '../../managers/BugReporter.js';
import { dragDropTasksManagerInsatance } from '../../managers/DragDropTasksManager.js';
import { ConfigureColumnSortingModal } from '../../modals/ConfigureColumnSortingModal.js';
import { eventEmitter } from '../../services/EventEmitter.js';
import { isRootFilterStateEmpty } from '../../utils/algorithms/AdvancedFilterer.js';
import { matchTagsWithWildcards } from '../../utils/algorithms/ScanningFilterer.js';
import { AdvancedFilterModal } from '../AdvancedFilterer/index.js';
import { AdvancedFilterPopover } from '../AdvancedFilterer/Popover.js';
import TaskItem, { swimlaneDataProp } from '../TaskCard/TaskItem.js';
import TaskItemV2 from '../TaskCard/TaskItemV2.js';

type CustomCSSProperties = CSSProperties & {
	'--task-board-column-width': string;
};

export interface LazyColumnProps {
	plugin: TaskBoard;
	activeBoardData: Board;
	currentViewIndex: number;
	kanbanViewData: KanbanView;
	columnData: ColumnData;
	// columnIndex: number;
	tasksForThisColumn: taskItem[];
	// collapsed?: boolean;
	swimlaneData?: swimlaneDataProp;
	hideColumnHeader?: boolean;
	headerOnly?: boolean;
}

const LazyColumn: React.FC<LazyColumnProps> = ({
	plugin,
	activeBoardData,
	currentViewIndex,
	kanbanViewData,
	columnData,
	tasksForThisColumn,
	swimlaneData,
	hideColumnHeader = false,
	headerOnly = false,
}) => {
	// console.log("Column Data :", columnData);

	// Lazy loading configs
	const initialTaskCount = 20;
	const loadMoreCount = 10;
	const scrollThresholdPercent = 80;

	const [currentViewData, setCurrentViewData] = useState(kanbanViewData);

	// State for managing visible tasks
	const [visibleTaskCount, setVisibleTaskCount] = useState(initialTaskCount);
	const tasksContainerRef = useRef<HTMLDivElement>(null);

	// Drag and drop state
	const [isDragOver, setIsDragOver] = useState(false);
	const [insertIndex, setInsertIndex] = useState<number | null>(null);
	const insertIndexRef = useRef<number | null>(null);
	const rafRef = useRef<number | null>(null);
	const [localTasks, setLocalTasks] = useState(tasksForThisColumn);

	// Navigation visibility state
	const prevScrollTopRef = useRef<number>(0);
	// const isNavHiddenRef = useRef<boolean>(false);
	const scrollPositionWhenHiddenRef = useRef<number>(0);
	const SCROLL_UP_THRESHOLD = 10;

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

	const handleNavVisibility = () => {
		const container = tasksContainerRef.current;
		if (!container) return;

		const currentScrollTop = container.scrollTop;
		const isScrollingDown = currentScrollTop > prevScrollTopRef.current;
		const scrollDifference = Math.abs(currentScrollTop - prevScrollTopRef.current);
		// console.log("LazyColumn.tsx...\ncurrentScrollTop:", currentScrollTop, "\nisScrollingDown :", isScrollingDown, "\nscrollDifference :", scrollDifference, "\nisNavHiddenRef :");

		if (scrollDifference < 1) return;

		const htmlElement = document.documentElement;

		if (isScrollingDown) {
			// User is scrolling down - hide navigation
			htmlElement.classList.add('is-hidden-nav');
			// isNavHiddenRef.current = true;
			scrollPositionWhenHiddenRef.current = currentScrollTop;
		} else if (!isScrollingDown) {
			// User is scrolling up - show navigation after scrolling up by threshold
			const scrolledUpDistance = scrollPositionWhenHiddenRef.current - currentScrollTop;
			if (scrolledUpDistance >= SCROLL_UP_THRESHOLD) {
				htmlElement.classList.remove('is-hidden-nav');
				// isNavHiddenRef.current = false;
			}
		}

		// Update previous scroll position for next iteration
		prevScrollTopRef.current = currentScrollTop;
	};

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

				if (Platform.isMobile)
					handleNavVisibility();

				throttleTimeout = null;
			}, 100);
		};

		container.addEventListener('scroll', throttledScroll);
		return () => {
			container.removeEventListener('scroll', throttledScroll);
			if (throttleTimeout) clearTimeout(throttleTimeout);
		};
	}, [handleScroll]);

	// -------------------------------------------------
	// ALL DRAG AND DROP RELATED FUNCTIONS
	//
	// All these drag-drop handlers has been moved at the top of this file
	// so that useCallback can be initiazlied BEFORE any early returns
	// -------------------------------------------------

	/**
	 * This function will be only run when user will drag the taskItem on another taskItem.
	 * Computes insertion index based on mouse Y relative to task items inside the container.
	 */
	const handleTaskItemDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(true);
		try {
			const hasManualOrder = Array.isArray(columnData.sortCriteria) && columnData.sortCriteria.some((c) => c.criteria === 'manualOrder');
			if (!hasManualOrder) {
				if (insertIndexRef.current !== null) {
					scheduleSetInsertIndex(null);
				}
				dragDropTasksManagerInsatance.clearDesiredDropIndex();
				return;
			} else {
				let pos = 0;
				const hoveredElement = e.currentTarget;
				const draggedOverItemIndex = hoveredElement.getAttribute('data-taskitem-index');
				const draggedOverItemKey = hoveredElement.getAttribute('data-taskitem-id');
				const draggedItemKey = dragDropTasksManagerInsatance.getCurrentDragData()?.task.id;

				if (draggedOverItemKey && draggedOverItemIndex && draggedOverItemKey !== draggedItemKey) {
					const clientY = e.clientY;
					const rect = hoveredElement.getBoundingClientRect();
					const midpoint = rect.top + rect.height / 2;
					if (clientY < midpoint) {
						pos = parseInt(draggedOverItemIndex, 10);
					} else {
						pos = parseInt(draggedOverItemIndex, 10) + 1;
					}
					scheduleSetInsertIndex(pos);
					dragDropTasksManagerInsatance.setDesiredDropIndex(pos);
				} else {
					if (insertIndexRef.current !== null) {
						scheduleSetInsertIndex(null);
					}
					dragDropTasksManagerInsatance.clearDesiredDropIndex();
				}

				const targetColumnContainer = tasksContainerRef.current as HTMLDivElement;
				dragDropTasksManagerInsatance.handleCardDragOverEvent(e.nativeEvent as DragEvent, e.currentTarget as HTMLDivElement, targetColumnContainer, columnData);
			}
		} catch (error) {
			bugReporterManagerInsatance.addToLogs(119, String(error), "LazyColumn.tsx/handleTaskItemDragOver");
		}
	}, [scheduleSetInsertIndex, columnData]);

	const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(true);
		try {
			const targetColumnContainer = (e.currentTarget) as HTMLDivElement;
			dragDropTasksManagerInsatance.handleColumnDragOverEvent(e.nativeEvent, columnData, targetColumnContainer);
		} catch (error) {
			bugReporterManagerInsatance.addToLogs(120, String(error), "LazyColumn.tsx/handleDragOver");
		}
	}, [columnData]);

	const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		try {
			const container = e.currentTarget as HTMLElement;
			const x = e.clientX;
			const y = e.clientY;
			if (typeof x === 'number' && typeof y === 'number') {
				const rect = container.getBoundingClientRect();
				if (x >= rect.left + 10 && x <= rect.right - 10 && y >= rect.top && y <= rect.bottom) {
					return;
				}
			}
		} catch (err) {
			console.log("While drag leave : ", err);
		}

		setIsDragOver(false);
		setInsertIndex(null);
		dragDropTasksManagerInsatance.handleDragLeaveEvent(e.currentTarget as HTMLDivElement);
		dragDropTasksManagerInsatance.clearDesiredDropIndex();
	}, []);

	const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(false);
		setInsertIndex(null);

		try {
			const targetColumnContainer = (e.currentTarget) as HTMLDivElement;
			if (!targetColumnContainer) {
				throw `e.currentTarget not found : ${JSON.stringify(targetColumnContainer)}`;
			}

			dragDropTasksManagerInsatance.handleDropEvent(e.nativeEvent, columnData, targetColumnContainer, swimlaneData);
			dragDropTasksManagerInsatance.clearCurrentDragData();
			dragDropTasksManagerInsatance.clearDesiredDropIndex();
		} catch (error) {
			bugReporterManagerInsatance.addToLogs(118, String(error), "LazyColumn.tsx/handleDrop");
		}
	}, [columnData, plugin, swimlaneData]);

	// Cleanup any pending RAF on unmount
	useEffect(() => {
		return () => {
			if (rafRef.current) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
			document.documentElement.classList.remove('is-hidden-nav');
		};
	}, []);

	const shouldRenderEmptyColumn = !headerOnly && tasksForThisColumn?.length === 0;
	if (shouldRenderEmptyColumn) {
		return null;
	}

	const columnWidth = plugin.settings.data.columnWidth || '273px';

	// Extra code to provide special data-types for theme support.
	const tagColors = plugin.settings.data.tagColors;
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

	async function handleMinimizeColumn() {
		// const boardIndex = plugin.settings.data.boardConfigs.findIndex(
		// 	(board: Board) => board.name === activeBoardData.name
		// );

		// const boardIndex = activeBoardData.index;
		// if (boardIndex !== -1) {
		// NOTE : This extra thing we need to do because, the columnData.index is stored starting with 1 and not 0. Hence, I we will need to subtract 1 from it.
		// const columnIndex = plugin.settings.data.boardConfigs[boardIndex].columns.findIndex(
		// 	(col: ColumnData) => col.id === columnData.id
		// );
		const columnIndex = columnData.index - 1;

		if (columnIndex !== -1) {
			let newBoardData = activeBoardData;
			newBoardData.views[currentViewIndex].kanbanView!.columns[columnIndex].minimized = !newBoardData.views[currentViewIndex].kanbanView!.columns[columnIndex].minimized;
			plugin.taskBoardFileManager.saveBoard(newBoardData);

			eventEmitter.emit('REFRESH_BOARD');
		}
		// }
	}

	async function handleAlertButtonClick() {
		const message = "You have set a work limit of " + columnData.workLimit + " for this column. Dont be so hard on yourself. Limit your work to reduce workload burden.";
		new Notice(message, 0);
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

						// if (activeBoardData.index !== -1) {
						const columnIndex = activeBoardData.views[currentViewIndex].kanbanView!.columns.findIndex(
							(col: ColumnData) => col.id === columnData.id
						);

						if (columnIndex !== -1) {
							// Update the column configuration
							let newBoardData = activeBoardData;
							newBoardData.views[currentViewIndex].kanbanView!.columns[columnIndex] = updatedColumnConfiguration;
							plugin.taskBoardFileManager.saveBoard(newBoardData);

							// Refresh the board view
							eventEmitter.emit('REFRESH_BOARD');
						}
						// }
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
					// const boardIndex = plugin.settings.data.boardConfigs.findIndex(
					// 	(board: Board) => board.name === activeBoardData.name
					// );
					// const boardIndex = activeBoardData.index;
					// NOTE : This extra thing we need to do because, the columnData.index is stored starting with 1 and not 0. Hence, I we will need to subtract 1 from it.
					// const columnIndex = plugin.settings.data.boardConfigs[boardIndex].columns.findIndex(
					// 	(col: ColumnData) => col.id === columnData.id
					// );

					const columnIndex = columnData.index - 1;
					if (Platform.isMobile || Platform.isMacOS) {
						// If its a mobile platform, then we will open a modal instead of popover.
						const filterModal = new AdvancedFilterModal(
							plugin, true, activeBoardData.id, columnData.name, columnData.filters
						);

						// Set the close callback - mainly used for handling cancel actions
						filterModal.filterCloseCallback = async (filterState) => {
							if (filterState) {
								if (columnIndex !== -1) {
									// Update the column filters
									let newBoardData = activeBoardData;
									newBoardData.views[currentViewIndex].kanbanView!.columns[columnIndex].filters = filterState;

									plugin.taskBoardFileManager.saveBoard(newBoardData);

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
						const popover = new AdvancedFilterPopover(
							plugin,
							true, // forColumn is true
							activeBoardData.id,
							columnData.name,
							columnData.filters
						);

						// Set up close callback to save filter state
						popover.onClose = async (filterState?: RootFilterState) => {
							if (filterState) {
								if (columnIndex !== -1) {
									// Update the column filters
									let newBoardData = activeBoardData;
									newBoardData.views[currentViewIndex].kanbanView!.columns[columnIndex].filters = filterState;

									plugin.taskBoardFileManager.saveBoard(newBoardData);

									// Refresh the board view
									eventEmitter.emit('REFRESH_BOARD');
								}
							}
						};

						popover.showAtPosition(position);
					}
				} catch (error) {
					bugReporterManagerInsatance.showNotice(4, "Error showing filter popover", String(error), "Column.tsx/column-menu/configure-conlum-filters");
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
				// const boardIndex = plugin.settings.data.boardConfigs.findIndex(
				// 	(board: Board) => board.name === activeBoardData.name
				// );
				// const boardIndex = activeBoardData.index;

				// if (boardIndex !== -1) {
				// NOTE : This extra thing we need to do because, the columnData.index is stored starting with 1 and not 0. Hence, I we will need to subtract 1 from it.
				// const columnIndex = plugin.settings.data.boardConfigs[boardIndex].columns.findIndex(
				// 	(col: ColumnData) => col.id === columnData.id
				// );
				const columnIndex = columnData.index - 1;

				if (columnIndex !== -1) {
					// Set the active property to false
					let newBoardData = activeBoardData;
					newBoardData.views[currentViewIndex].kanbanView!.columns[columnIndex].active = false;

					plugin.taskBoardFileManager.saveBoard(newBoardData);

					// Refresh the board view
					eventEmitter.emit('REFRESH_BOARD');
				}
				// }
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

		// Show swimlane toggle option only when swimlanes are enabled
		const isSwimlanesEnabled = kanbanViewData.swimlanes.enabled;
		if (isSwimlanesEnabled) {
			columnMenu.addSeparator();
			columnMenu.addItem((item) => {
				const isSwimlaneEnabled = columnData.swimlaneEnabled;
				item.setTitle(isSwimlaneEnabled ? t("exclude-from-swimlanes") : t("include-in-swimlanes"));
				item.setIcon(isSwimlaneEnabled ? "layout-panel-left" : "rows-3");
				item.onClick(async () => {
					let updatedViewData = { ...kanbanViewData };
					updatedViewData.columns[columnData.index - 1].swimlaneEnabled = !isSwimlaneEnabled;

					let updatedBoardData = { ...activeBoardData };
					if (updatedBoardData.views[currentViewIndex].kanbanView) {
						updatedBoardData.views[currentViewIndex].kanbanView = updatedViewData;
						plugin.taskBoardFileManager.saveBoard(updatedBoardData);
					}

					// const boardIndex = activeBoardData.index;
					// if (boardIndex !== -1) {
					// 	const columnIndex = columnData.index - 1;
					// 	if (columnIndex !== -1) {
					// 		plugin.settings.data.boardConfigs[boardIndex].columns[columnIndex].swimlaneEnabled = !isSwimlaneEnabled;
					// 		await plugin.saveSettings();
					// 		eventEmitter.emit('REFRESH_BOARD');
					// 	}
					// }
				});
			});
		}

		// Use native event if available (React event has nativeEvent property)
		columnMenu.showAtMouseEvent(
			(event instanceof MouseEvent ? event : event.nativeEvent)
		);
	}

	// -------------------------------------------------
	// ALL DRAG AND DROP RELATED FUNCTIONS ARE DEFINED ABOVE TO PREVENT HOOK ORDERING ISSUES
	// -------------------------------------------------

	// -------------------------------------------------
	// Render
	// -------------------------------------------------

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

	const taskItemComponent = plugin.settings.data.taskCardStyle === taskCardStyleNames.EMOJI ? TaskItem : TaskItemV2;

	try {
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
									{columnData?.workLimit && tasksForThisColumn.length > columnData.workLimit && (
										<div className='taskBoardColumnSecHeaderTitleSecWorkLimitAlert' aria-label={t("work-limit-alert")} onClick={handleAlertButtonClick}>
											<AlertOctagon size={20} />
										</div>
									)}
								</div>
								<div className={`taskBoardColumnSecHeaderTitleSecColumnCount ${isAdvancedFilterApplied ? 'active' : ''}`} onClick={(evt) => openColumnMenu(evt)} aria-label={t("open-column-menu")}>
									{allTasks?.length ?? 0}
								</div>
							</div>
						)}
						<div
							className={`tasksContainer${plugin.settings.data.showVerticalScroll ? '' : ' SH'}`}
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
													// If insertIndex points to this position, render placeholder
													if (insertIndex === i) {
														elements.push(
															<div key={`placeholder-${i}`} className="task-insert-placeholder"><span className="task-insert-text">Drop here</span></div>
														);
													}
													const task = visibleTasks[i];
													elements.push(
														<div
															key={task.id}
															className="taskItemFadeIn"
															data-taskitem-index={i}
															data-taskitem-id={task.id}
															onDragOver={(e) => { handleTaskItemDragOver(e); }
															}
															onDrop={e => handleDrop(e)}
														>
															{React.createElement(taskItemComponent, {
																key: task.id,
																dataAttributeIndex: i,
																plugin: plugin,
																task: task,
																activeViewType: viewTypeNames.kanban, // Since this Column component will be always rendered inside a Kanban view.
																activeViewIndex: currentViewIndex,
																kanbanViewData: currentViewData,
																columnIndex: columnData.index,
																swimlaneData: swimlaneData
															})}
														</div>
													);
												}
												// If insertIndex points to end (after last item)
												if (localTasks && insertIndex === localTasks.length) {
													elements.push(
														<div key={`placeholder-end`} className="task-insert-placeholder"><span className="task-insert-text">Drop here</span></div>
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
	} catch (error) {
		bugReporterManagerInsatance.showNotice(180, "There was an issue rendering a particular column. This might cause the whole tab to go blank. Try, closing and opening Task Board again. If the issue still persists, please report this to the developer", JSON.stringify(error), "LazyColumn.tsx/return");
	}
};

export default memo(LazyColumn);
