// /src/components/Column.tsx

import React, { memo, useMemo } from 'react';

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
		const sortMenu = new Menu();

		sortMenu.addItem((item) => {
			item.setTitle(t("sort-and-filter"));
			item.setIsLabel(true);
		});
		sortMenu.addItem((item) => {
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
		sortMenu.addItem((item) => {
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

					if (Platform.isMobile) {
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

		sortMenu.addSeparator();

		sortMenu.addItem((item) => {
			item.setTitle(t("quick-actions"));
			item.setIsLabel(true);
		});
		sortMenu.addItem((item) => {
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

		// Use native event if available (React event has nativeEvent property)
		sortMenu.showAtMouseEvent(
			(event instanceof MouseEvent ? event : event.nativeEvent)
		);
	}

	const isAdvancedFilterApplied = !isRootFilterStateEmpty(columnData.filters);

	return (
		<div
			className={`TaskBoardColumnsSection ${columnData.minimized ? 'minimized' : ''}`}
			style={{ '--task-board-column-width': columnData.minimized ? '3rem' : columnWidth } as CustomCSSProperties}
			data-column-type={columnData.colType}
			data-column-tag-name={tagData?.name}
			data-column-tag-color={tagData?.color}
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
						{tasks.length > 0 ? (
							tasks.map((task, index) => {
								return (
									<div key={index} className="taskItemFadeIn">
										<TaskItem
											key={task.id}
											plugin={plugin}
											task={task}
											columnIndex={columnIndex}
											activeBoardSettings={activeBoardData}
										/>
									</div>
								);
							})
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
