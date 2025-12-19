// /src/components/Column.tsx

import React, { memo, useCallback, useEffect, useMemo, useState, useRef } from 'react';

import { CSSProperties } from 'react';
import TaskItem from './TaskItem';
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
import { dragDropTasksManagerInsatance } from 'src/managers/DragDropTasksManager';
import { columnTypeAndNameMapping } from 'src/interfaces/Mapping';
import { colType } from 'src/interfaces/Enums';

type CustomCSSProperties = CSSProperties & {
	'--task-board-column-width': string;
};

export interface ColumnProps {
	plugin: TaskBoard;
	columnIndex: number;
	activeBoardData: Board;
	collapsed?: boolean;
	columnData: ColumnData;
	tasksForThisColumn: taskItem[];
}


const Column: React.FC<ColumnProps> = ({
	plugin,
	columnIndex,
	activeBoardData,
	columnData,
	tasksForThisColumn,
}) => {
	if (activeBoardData?.hideEmptyColumns && (tasksForThisColumn === undefined || tasksForThisColumn.length === 0)) {
		return null; // Don't render the column if it has no tasks and empty columns are hidden
	}
	// Local tasks state, initially set from external tasks
	// const [tasks, setTasks] = useState<taskItem[]>(tasksForThisColumn);
	const tasks = useMemo(() => tasksForThisColumn, [tasksForThisColumn]);
	const [isDragOver, setIsDragOver] = useState(false);
	const [insertIndex, setInsertIndex] = useState<number | null>(null);
	const insertIndexRef = useRef<number | null>(null);
	const rafRef = useRef<number | null>(null);

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
	// Local tasks state, initially set from external tasks
	const [localTasks, setLocalTasks] = useState(tasksForThisColumn);
	// console.log("Column.tsx : Data in tasks :", tasks);

	// // Sync local tasks state with external tasks when they change
	// useEffect(() => {
	// 	setTasks(tasksForThisColumn);
	// }, [tasksForThisColumn]);

	// // Render tasks using the tasks passed from KanbanBoard
	// useEffect(() => {
	// 	if (allTasksExternal.Pending.length > 0 || allTasksExternal.Completed.length > 0) {
	// 		columnSegregator(plugin, setTasks, activeBoardIndex, colType, columnData, allTasksExternal);
	// 	}
	// }, [colType, columnData, allTasksExternal]);

	const columnWidth = plugin.settings.data.globalSettings.columnWidth || '273px';
	// const activeBoardSettings = plugin.settings.data.boardConfigs[activeBoardIndex];

	// Extra code to provide special data-types for theme support.
	const tagColors = plugin.settings.data.globalSettings.tagColors;
	const tagColorMap = new Map(tagColors.map((t) => [t.name, t]));
	let tagData = tagColorMap.get(columnData?.coltag || '');
	if (!tagData) {
		tagColorMap.forEach((tagColor, tagNameKey, mapValue) => {
			const result = matchTagsWithWildcards(tagNameKey, columnData?.coltag || '');
			// console.log("Column.tsx : Matching tag result : ", { tagNameKey, columnTag: columnData?.coltag, result });
			// Return the first match found
			if (result) tagData = tagColor;
		});
	}

	async function handleMinimizeColumn() {
		// Find the board and column indices
		const boardIndex = plugin.settings.data.boardConfigs.findIndex(
			(board: Board) => board.name === activeBoardData.name
		);

		if (boardIndex !== -1) {
			const columnIndex = plugin.settings.data.boardConfigs[boardIndex].columns.findIndex(
				(col: ColumnData) => col.name === columnData.name
			);

			if (columnIndex !== -1) {
				// Set the minimized property to true
				plugin.settings.data.boardConfigs[boardIndex].columns[columnIndex].minimized = !plugin.settings.data.boardConfigs[boardIndex].columns[columnIndex].minimized;

				// Save the settings
				await plugin.saveSettings();

				// Refresh the board view
				eventEmitter.emit('REFRESH_BOARD');
			}
		}
	}

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

	// Detect external changes in tasksForThisColumn
	useEffect(() => {
		setLocalTasks(tasksForThisColumn);
	}, [tasksForThisColumn]);

	// Drag and drop handlers to reorder within the column
	const handleTaskDragStart = (e: React.DragEvent<HTMLDivElement>, dragIndex: number) => {
		e.dataTransfer.setData('text/plain', dragIndex.toString());
		e.dataTransfer.effectAllowed = 'move';
	};

	const handleTaskDrop = async (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
		e.preventDefault();
		setIsDragOver(false);
		setInsertIndex(null);
		const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
		if (isNaN(dragIndex) || dragIndex === dropIndex) return;
		const updated = [...localTasks];
		const [moved] = updated.splice(dragIndex, 1);
		updated.splice(dropIndex, 0, moved);
		setLocalTasks(updated);
		// If this column uses manualOrder, update the columnData.tasksIdManualOrder to reflect new order
		const hasManualOrder = Array.isArray(columnData.sortCriteria) && columnData.sortCriteria.some((c) => c.criteria === 'manualOrder');
		if (hasManualOrder) {
			columnData.tasksIdManualOrder = updated.map(t => t.id);
		}
		// clear any pending raf
		if (rafRef.current) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
		// const { updateTaskOrderInColumn } = await import('../../utils/DragDropTaskManager');
		// await updateTaskOrderInColumn(plugin, columnData, updated);
	};

	// Handler for when a task is dropped onto this column
	const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(false);

		if (columnData.colType !== 'namedTag') return;

		try {
			// Get the data of the dragged task
			const taskData = e.dataTransfer.getData('application/json');
			if (taskData) {
				const { task, sourceColumnData } = JSON.parse(taskData);

				// Ensure we have valid data
				if (!task || !sourceColumnData) return;

				// Get the target column container
				const targetColumnContainer = (e.currentTarget) as HTMLDivElement;
				// Get the source column container
				const allColumnContainers = Array.from(document.querySelectorAll('.TaskBoardColumnsSection')) as HTMLDivElement[];
				const sourceColumnContainer = allColumnContainers.find(container => {
					const containerTag = container.getAttribute('data-column-tag-name');
					return containerTag === sourceColumnData.coltag || sourceColumnData.coltag?.includes(containerTag || '');
				}) || targetColumnContainer;

				// If target column uses manualOrder, disallow cross-column drops (only allow intra-column reordering)
				const hasManualOrder = Array.isArray(columnData.sortCriteria) && columnData.sortCriteria.some((c) => c.criteria === 'manualOrder');
				if (hasManualOrder && sourceColumnData.coltag !== columnData.coltag) {
					// Not allowed: ignore drop
					dragDropTasksManagerInsatance.clearCurrentDragData();
					return;
				}

				// Use the DragDropTasksManager to handle the drop
					// If this is an intra-column reorder (same column) and we have an insertIndex, handle locally
				try {
					const dragIdxStr = e.dataTransfer.getData('text/plain');
					const dragIdx = dragIdxStr ? parseInt(dragIdxStr) : NaN;
						if (sourceColumnData.coltag === columnData.coltag && !isNaN(dragIdx) && insertIndexRef.current !== null) {
						// Reorder locally
						const updated = [...localTasks];
							const [moved] = updated.splice(dragIdx, 1);
							updated.splice(insertIndexRef.current!, 0, moved);
						setLocalTasks(updated);
							setInsertIndex(null);
							insertIndexRef.current = null;
						// Update manual order if applicable
						const hasManualOrderLocal = Array.isArray(columnData.sortCriteria) && columnData.sortCriteria.some((c) => c.criteria === 'manualOrder');
						if (hasManualOrderLocal) {
							columnData.tasksIdManualOrder = updated.map(t => t.id);
						}
						// Clear manager payload and skip default handling
						dragDropTasksManagerInsatance.clearCurrentDragData();
						return;
					}
				} catch (err) {
					// ignore and continue to default handling
				}

				dragDropTasksManagerInsatance.handleDrop(
					e.nativeEvent,
					sourceColumnData,
					sourceColumnContainer,
					columnData,
					targetColumnContainer
				);

				// Clear manager payload (drag finished)
				dragDropTasksManagerInsatance.clearCurrentDragData();

				// TODO : Implement the actual task property update logic based on source and target column data
				// This will be called after validation passes
			}
		} catch (error) {
			console.error('Error handling task drop:', error);
		}
	}, [columnData, plugin]);

	// Handle the dragover event to allow the drop
	const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		// Only allow drop if this column is of type "namedTag"
		if (columnData.colType === colType.namedTag) {
			// Always prevent default to indicate drop is allowed unless we explicitly set otherwise
			e.preventDefault();
			setIsDragOver(true);
			try {
				// Try to read payload from the DataTransfer first
				let taskDataStr = '';
				try {
					taskDataStr = e.dataTransfer.getData('application/json');
				} catch (err) {
					// ignore - some environments restrict access
				}

				let payload: any = null;
				if (taskDataStr) {
					try { payload = JSON.parse(taskDataStr); } catch {}
				}

				// Fallback to manager-stored payload if dataTransfer is empty
				if (!payload) {
					payload = dragDropTasksManagerInsatance.getCurrentDragData();
				}

				if (!payload) return;

				const { task, sourceColumnData } = payload;
				if (!task || !sourceColumnData) return;

				// Get the target column container
				const targetColumnContainer = (e.currentTarget) as HTMLDivElement;
				// Get the source column container (best-effort by matching tag)
				const allColumnContainers = Array.from(document.querySelectorAll('.TaskBoardColumnsSection')) as HTMLDivElement[];
				const sourceColumnContainer = allColumnContainers.find(container => {
					const containerTag = container.getAttribute('data-column-tag-name');
					return containerTag === sourceColumnData.coltag || sourceColumnData.coltag?.includes(containerTag || '');
				}) || targetColumnContainer;

				// Use the DragDropTasksManager to handle the drag over (this sets classes and dropEffect)
				dragDropTasksManagerInsatance.handleDragOver(
					e.nativeEvent,
					sourceColumnData,
					sourceColumnContainer,
					columnData,
					targetColumnContainer
				);

				// Ensure cursor reflects allowed/not-allowed (best-effort fallback)
				const allowed = dragDropTasksManagerInsatance.isTaskDropAllowed(sourceColumnData, columnData);
				e.dataTransfer.dropEffect = allowed ? 'move' : 'none';
			} catch (error) {
				console.error('Error handling drag over:', error);
			}
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
		setIsDragOver(false);
		setInsertIndex(null);
	}, []);

	const isAdvancedFilterApplied = !isRootFilterStateEmpty(columnData.filters);

	return (
		<div
			className={`TaskBoardColumnsSection ${columnData.minimized ? 'minimized' : ''} ${isDragOver ? 'dragover' : ''}`}
			style={{ '--task-board-column-width': columnData.minimized ? '3rem' : columnWidth } as CustomCSSProperties}
			data-column-type={columnData.colType}
			data-column-tag-name={tagData?.name}
			data-column-tag-color={tagData?.color}
			onDrop={handleDrop}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
				onDragEnd={() => { setIsDragOver(false); setInsertIndex(null); }}
		>
			{columnData.minimized ? (
				// Minimized view - vertical bar with count and rotated text
				<div className="taskBoardColumnMinimized">
					<div className={`taskBoardColumnSecHeaderTitleSecColumnCount ${isAdvancedFilterApplied ? 'active' : ''}`} onClick={(evt) => openColumnMenu(evt)} aria-label={t("open-column-menu")}>
						{tasksForThisColumn.length}
					</div>
					<div className="taskBoardColumnMinimizedTitle" onClick={async () => {
						await handleMinimizeColumn();
						eventEmitter.emit('REFRESH_BOARD');
					}}>{columnData.name}</div>
				</div>
			) : (
				// Normal view
				<>
					<div className="taskBoardColumnSecHeader">
						<div className="taskBoardColumnSecHeaderTitleSec">
							{/* <button className="columnDragIcon" aria-label='More Column Options' ><RxDragHandleDots2 /></button> */}
							<div className="taskBoardColumnSecHeaderTitleSecColumnTitle">{columnData.name}</div>
						</div>
						<div className={`taskBoardColumnSecHeaderTitleSecColumnCount ${isAdvancedFilterApplied ? 'active' : ''}`} onClick={(evt) => openColumnMenu(evt)} aria-label={t("open-column-menu")}>{tasksForThisColumn.length}</div>
						{/* <RxDotsVertical /> */}
					</div>
					<div className={`tasksContainer${plugin.settings.data.globalSettings.showVerticalScroll ? '' : '-SH'}`}>
						{localTasks.length > 0 ? (
							(() => {
								const elements: React.ReactNode[] = [];
								for (let i = 0; i < localTasks.length; i++) {
									// If insertIndex points to this position, render placeholder
									if (insertIndex === i) {
										elements.push(
											<div key={`placeholder-${i}`} className="task-insert-placeholder"><span className="task-insert-text">Drop here</span></div>
										);
									}
									const task = localTasks[i];
									elements.push(
										<div
											key={task.id}
											className="taskItemFadeIn"
											draggable={true}
											onDragStart={e => handleTaskDragStart(e, i)}
											onDragOver={e => {
												e.preventDefault();
												setIsDragOver(true);
												// Determine insertion position based on mouse Y
												const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
												const offset = e.clientY - rect.top;
												const position = offset > rect.height / 2 ? i + 1 : i;
												// Throttle updates to avoid reflow flicker
												scheduleSetInsertIndex(position);
												// prefer move effect
												e.dataTransfer.dropEffect = 'move';
											}}
											onDrop={e => handleTaskDrop(e, i)}
										>
											<TaskItem
												key={task.id}
												plugin={plugin}
												task={task}
												columnIndex={columnIndex}
												activeBoardSettings={activeBoardData}
											/>
										</div>
									);
								}
								// If insertIndex points to end (after last item)
								if (insertIndex === localTasks.length) {
									elements.push(
										<div key={`placeholder-end`} className="task-insert-placeholder"><span className="task-insert-text">Drop here</span></div>
									);
								}
								return elements;
							})()
						) : (
							<p>{t("no-tasks-available")}</p>
						)}
					</div>
				</>
			)}
		</div>
	);

};

// const MemoizedTaskItem = memo(TaskItem, (prevProps, nextProps) => {
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

export default memo(Column);
