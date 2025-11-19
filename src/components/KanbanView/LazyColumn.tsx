// src/components/KanbanView/LazyColumn.tsx

import React, { memo, useMemo, useState, useEffect, useRef, useCallback } from 'react';

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
}

const LazyColumn: React.FC<LazyColumnProps> = ({
	plugin,
	columnIndex,
	activeBoardData,
	columnData,
	tasksForThisColumn,
}) => {
	if (activeBoardData?.hideEmptyColumns && (tasksForThisColumn === undefined || tasksForThisColumn.length === 0)) {
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

	// Memoize all tasks
	const allTasks = useMemo(() => tasksForThisColumn, [tasksForThisColumn]);
	
	// Memoize visible tasks based on count
	const visibleTasks = useMemo(() => {
		return allTasks.slice(0, visibleTaskCount);
	}, [allTasks, visibleTaskCount]);

	// Reset visible count when tasks change (e.g., switching boards or filtering)
	useEffect(() => {
		setVisibleTaskCount(initialTaskCount);
	}, [tasksForThisColumn, initialTaskCount]);

	// Scroll event handler
	const handleScroll = useCallback(() => {
		const container = tasksContainerRef.current;
		if (!container) return;

		const { scrollTop, scrollHeight, clientHeight } = container;
		const scrollPercentage = ((scrollTop + clientHeight) / scrollHeight) * 100;

		// Load more tasks when scroll threshold is reached and there are more tasks to load
		if (scrollPercentage >= scrollThresholdPercent && visibleTaskCount < allTasks.length) {
			setVisibleTaskCount((prevCount) => {
				const newCount = Math.min(prevCount + loadMoreCount, allTasks.length);
				return newCount;
			});
		}
	}, [scrollThresholdPercent, visibleTaskCount, allTasks.length, loadMoreCount]);

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

	function openColumnMenu(event: MouseEvent | React.MouseEvent) {
		const sortMenu = new Menu();

		sortMenu.addItem((item) => {
			item.setTitle(t("sort-and-filter"));
			item.setIsLabel(true);
		});
		sortMenu.addItem((item) => {
			item.setTitle(t("configure-column-sorting"));
			item.setIcon("arrow-up-down");
			item.onClick(async () => {
				const modal = new ConfigureColumnSortingModal(
					plugin,
					columnData,
					(updatedColumnConfiguration: ColumnData) => {
						const boardIndex = plugin.settings.data.boardConfigs.findIndex(
							(board: Board) => board.name === activeBoardData.name
						);

						if (boardIndex !== -1) {
							const columnIndex = plugin.settings.data.boardConfigs[boardIndex].columns.findIndex(
								(col: ColumnData) => col.name === columnData.name
							);

							if (columnIndex !== -1) {
								plugin.settings.data.boardConfigs[boardIndex].columns[columnIndex] = updatedColumnConfiguration;
								plugin.saveSettings();
								eventEmitter.emit('REFRESH_BOARD');
							}
						}
					},
					() => {
						// onCancel callback
					}
				);
				modal.open();
			});
		});
		sortMenu.addItem((item) => {
			item.setTitle(t("configure-column-filtering"));
			item.setIcon("list-filter");
			item.onClick(async () => {
				try {
					const boardIndex = plugin.settings.data.boardConfigs.findIndex(
						(board: Board) => board.name === activeBoardData.name
					);
					const columnIndex = plugin.settings.data.boardConfigs[boardIndex].columns.findIndex(
						(col: ColumnData) => col.name === columnData.name
					);

					if (Platform.isMobile) {
						const filterModal = new ViewTaskFilterModal(
							plugin, true, undefined, boardIndex, columnData.name, columnData.filters
						);

						filterModal.filterCloseCallback = async (filterState) => {
							if (filterState && boardIndex !== -1) {
								if (columnIndex !== -1) {
									plugin.settings.data.boardConfigs[boardIndex].columns[columnIndex].filters = filterState;
									await plugin.saveSettings();
									eventEmitter.emit('REFRESH_BOARD');
								}
							}
						};

						filterModal.open();
					} else {
						const escapedTag = columnData.coltag ? CSS.escape(columnData.coltag) : '';
						const columnElement = document.querySelector(`[data-column-tag-name="${escapedTag}"]`) as HTMLElement;
						const position = columnElement
							? { x: columnElement.getBoundingClientRect().left, y: columnElement.getBoundingClientRect().top + 40 }
							: { x: 100, y: 100 };

						const popover = new ViewTaskFilterPopover(
							plugin,
							true,
							undefined,
							boardIndex,
							columnData.name,
							columnData.filters
						);

						popover.onClose = async (filterState?: RootFilterState) => {
							if (filterState && boardIndex !== -1) {
								if (columnIndex !== -1) {
									plugin.settings.data.boardConfigs[boardIndex].columns[columnIndex].filters = filterState;
									await plugin.saveSettings();
									eventEmitter.emit('REFRESH_BOARD');
								}
							}
						};

						popover.showAtPosition(position);
					}
				} catch (error) {
					bugReporter(plugin, "Error showing filter popover", String(error), "LazyColumn.tsx/column-menu/configure-column-filters");
				}
			});
		});

		sortMenu.addSeparator();

		sortMenu.addItem((item) => {
			item.setTitle(t("quick-actions"));
			item.setIsLabel(true);
		});
		sortMenu.addItem((item) => {
			item.setTitle(t("hide-column"));
			item.setIcon("eye-off");
			item.onClick(async () => {
				const boardIndex = plugin.settings.data.boardConfigs.findIndex(
					(board: Board) => board.name === activeBoardData.name
				);

				if (boardIndex !== -1) {
					const columnIndex = plugin.settings.data.boardConfigs[boardIndex].columns.findIndex(
						(col: ColumnData) => col.name === columnData.name
					);

					if (columnIndex !== -1) {
						plugin.settings.data.boardConfigs[boardIndex].columns[columnIndex].active = false;
						await plugin.saveSettings();
						eventEmitter.emit('REFRESH_BOARD');
					}
				}
			});
		});

		// Show minimize or maximize option based on current state
		if (columnData.minimized) {
			sortMenu.addItem((item) => {
				item.setTitle(t("maximize-column"));
				item.setIcon("panel-left-open");
				item.onClick(async () => {
					await handleMinimizeColumn();
				});
			});
		} else {
			sortMenu.addItem((item) => {
				item.setTitle(t("minimize-column"));
				item.setIcon("panel-left-close");
				item.onClick(async () => {
					await handleMinimizeColumn();
				});
			});
		}

		sortMenu.showAtMouseEvent(
			(event instanceof MouseEvent ? event : event.nativeEvent)
		);
	}

	return (
		<div
			className={`TaskBoardColumnsSection ${columnData.minimized ? 'minimized' : ''}`}
			style={{ '--task-board-column-width': columnData.minimized ? '3rem' : columnWidth } as CustomCSSProperties}
			data-column-type={columnData.colType}
			data-column-tag-name={tagData?.name}
			data-column-tag-color={tagData?.color}
		>
			{columnData.minimized ? (
				// Minimized view
				<div className="taskBoardColumnMinimized">
					<div className='taskBoardColumnSecHeaderTitleSecColumnCount' onClick={(evt) => openColumnMenu(evt)} aria-label={t("open-column-menu")}>
						{allTasks.length}
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
							<div className="taskBoardColumnSecHeaderTitleSecColumnTitle">{columnData.name}</div>
						</div>
						<div className='taskBoardColumnSecHeaderTitleSecColumnCount' onClick={(evt) => openColumnMenu(evt)} aria-label={t("open-column-menu")}>
							{allTasks.length}
						</div>
					</div>
					<div 
						className={`tasksContainer${plugin.settings.data.globalSettings.showVerticalScroll ? '' : '-SH'}`}
						ref={tasksContainerRef}
					>
						{visibleTasks.length > 0 ? (
							<>
								{visibleTasks.map((task, index = task.id) => {
									return (
										<div key={index} className="taskItemFadeIn">
											<TaskItem
												key={index}
												plugin={plugin}
												taskKey={index}
												task={task}
												columnIndex={columnIndex}
												activeBoardSettings={activeBoardData}
											/>
										</div>
									);
								})}
								{visibleTaskCount < allTasks.length && (
									<div className="lazyLoadIndicator">
										<p>{t("scroll-to-load-more")} ({visibleTaskCount} / {allTasks.length})</p>
									</div>
								)}
							</>
						) : (
							<p>{t("no-tasks-available")}</p>
						)}
					</div>
				</>
			)}
		</div>
	);
};

export default memo(LazyColumn);
