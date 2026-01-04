// src/components/KanbanView/KanbanSwimlanesContainer.tsx

import React, { useMemo, memo } from 'react';
import { Board, ColumnData } from 'src/interfaces/BoardConfigs';
import { taskItem, taskJsonMerged } from 'src/interfaces/TaskItem';
import Column from './Column';
import LazyColumn from './LazyColumn';
import type TaskBoard from 'main';
import { t } from 'src/utils/lang/helper';
import { ChevronDown, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';
import { eventEmitter } from 'src/services/EventEmitter';
import { colTypeNames } from 'src/interfaces/Enums';

interface KanbanSwimlanesContainerProps {
	plugin: TaskBoard;
	board: Board;
	allTasks: taskJsonMerged | undefined;
	tasksPerColumn: taskItem[][];
	lazyLoadingEnabled: boolean;
}

interface SwimlaneRow {
	swimlaneName: string;
	swimlaneValue: string;
	tasks: taskItem[][];
	minimized: boolean;
}

const KanbanSwimlanesContainer: React.FC<KanbanSwimlanesContainerProps> = ({
	plugin,
	board,
	allTasks,
	tasksPerColumn,
	lazyLoadingEnabled,
}) => {
	const ColumnComponent = lazyLoadingEnabled ? LazyColumn : Column;

	// Extract and organize swimlanes using tasksPerColumn (already segregated per active column)
	const {
		property,
		sortCriteria,
		customSortOrder,
		customValue,
		groupAllRest,
		maxHeight: maxSwimlaneHeight,
		verticalHeaderUI,
		minimized
	} = board.swimlanes;

	const swimlanes: SwimlaneRow[] = useMemo(() => {
		if (!board.swimlanes?.enabled || !tasksPerColumn) {
			return [];
		}


		// Get all active columns
		const activeColumns = board.columns.filter((col) => col.active);
		if (activeColumns.length === 0) return [];

		// Extract unique values for the swimlane property from tasksPerColumn
		const uniqueSwimlanValues = extractUniquePropertyValuesFromColumns(
			tasksPerColumn,
			property,
			customValue
		);

		// Sort the swimlane values
		let sortedSwimlaneValues: { value: string; index: number }[] = [];

		// When grouping remaining values into a single "All rest" swimlane,
		// keep the remaining values so we can aggregate tasks later.
		let customValues: Set<string> = new Set();
		let remainingValuesForAllRest: string[] = [];

		if (sortCriteria === 'custom' && customSortOrder && customSortOrder.length > 0) {
			// Use custom sort order
			sortedSwimlaneValues = customSortOrder.map((item) => ({
				value: item.value.replace('#', ''),
				index: item.index,
			}));

			// Add remaining values that are not in customSortOrder
			customValues = new Set(customSortOrder.map((item) => item.value.replace('#', '').toLocaleLowerCase()));
			const remainingValues = uniqueSwimlanValues.filter((val) => !customValues.has(val));
			// console.log("KanbanSwimlanesContainer...\ncustomValues", customValues, "\nremainingValues", remainingValues);

			if (!groupAllRest) {
				if (remainingValues.length > 0) {
					const maxIndex = Math.max(...customSortOrder.map((item) => item.index), 0);
					sortedSwimlaneValues = [
						...sortedSwimlaneValues,
						...remainingValues.map((val, idx) => ({
							value: val,
							index: maxIndex + idx + 1,
						})),
					];
				}
			} else {
				// If user has set to group all the remaining values into a single swimlane...
				// Then will create only a single swimlane at the bottom of all the custom ones and name it as "All rest".
				if (remainingValues.length > 0) {
					const maxIndex = Math.max(...customSortOrder.map((item) => item.index), 0);
					sortedSwimlaneValues = [
						...sortedSwimlaneValues,
						{
							value: 'All rest',
							index: maxIndex + 1,
						},
					];
					// remember which values are part of the "rest" so we can aggregate tasks later
					remainingValuesForAllRest = remainingValues;
				}
			}
		} else if (sortCriteria === 'asc') {
			// Sort ascending
			sortedSwimlaneValues = uniqueSwimlanValues
				.sort()
				.map((val, idx) => ({
					value: val,
					index: idx + 1,
				}));
		} else if (sortCriteria === 'desc') {
			// Sort descending
			sortedSwimlaneValues = uniqueSwimlanValues
				.sort((a, b) => b.localeCompare(a))
				.map((val, idx) => ({
					value: val,
					index: idx + 1,
				}));
		}

		// Create swimlane rows with tasks organized by column
		const swimlaneRows: SwimlaneRow[] = sortedSwimlaneValues.map((swimlaneItem) => {
			const tasksByColumn = activeColumns.map((column, colIdx) => {
				// tasksPerColumn is expected to align with active columns order
				const columnTasks = tasksPerColumn[colIdx] || [];

				// If this swimlane is the aggregated "All rest", include any task whose
				// property values are in the remainingValuesForAllRest list.
				if (swimlaneItem.value === 'All rest') {
					if (!remainingValuesForAllRest || remainingValuesForAllRest.length === 0) return [];
					return columnTasks.filter((task: taskItem) => {
						const values = getPropertyValues(task, property, customValue);
						if (property === "tags") {
							values.map((tag: string) => tag.replace('#', '').toLocaleLowerCase());
							const doesValuesHaveCustomValues = values.some((v: string) => customValues.has(v));
							return values.some((v: string) => remainingValuesForAllRest.includes(v) && !doesValuesHaveCustomValues) || values.length === 0;
						}

						return values.some((v) => remainingValuesForAllRest.includes(v));
					});
				}

				// Default behavior: filter tasks that include the exact swimlane value
				return columnTasks.filter((task) => {
					const values = getPropertyValues(task, property, customValue);
					if (property === "tags") {
						values.map((tag: string) => tag.replace('#', '').toLocaleLowerCase());
						return values.includes(swimlaneItem.value.replace('#', '').toLocaleLowerCase());
					}

					return values.includes(swimlaneItem.value);
				});
			});

			const swimlaneName = t(property) + ': ' + swimlaneItem.value;
			const isSwimlaneMinimized = minimized?.includes(swimlaneName) ?? false;

			return {
				swimlaneName: swimlaneName,
				swimlaneValue: swimlaneItem.value,
				tasks: tasksByColumn,
				minimized: isSwimlaneMinimized,
			};
		});

		// Filter out empty swimlanes if hideEmptySwimlanes is false
		if (board.swimlanes.hideEmptySwimlanes) {
			return swimlaneRows.filter((row) =>
				row.tasks.some((columnTasks) => columnTasks.length > 0)
			);
		}

		return swimlaneRows;
	}, [board, tasksPerColumn, plugin]);

	if (swimlanes.length === 0) {
		return (
			<div className="emptyBoardMessage">
				{t('no-swimlanes-found') || 'No swimlanes found for this configuration.'}
			</div>
		);
	}

	// function openSwimlaneMenu(event: MouseEvent | React.MouseEvent, rowIndex: number) {
	// 	const swimlaneMenu = new Menu();

	// 	swimlaneMenu.addItem((item) => {
	// 		item.setTitle(t("quick-actions"));
	// 		item.setIsLabel(true);
	// 	});

	// 	// Show minimize or maximize option based on current state
	// 	if (swimlanes[rowIndex].minimized) {
	// 		swimlaneMenu.addItem((item) => {
	// 			item.setTitle(t("maximize-column"));
	// 			item.setIcon("panel-left-open");
	// 			item.onClick(async () => {
	// 				// await handleMinimizeSwimlane(); // TODO : Implementation pending
	// 			});
	// 		});
	// 	} else {
	// 		swimlaneMenu.addItem((item) => {
	// 			item.setTitle(t("minimize-column"));
	// 			item.setIcon("panel-left-close");
	// 			item.onClick(async () => {
	// 				// await handleMinimizeSwimlane(); // TODO : Implementation pending
	// 			});
	// 		});
	// 	}

	// 	// Use native event if available (React event has nativeEvent property)
	// 	swimlaneMenu.showAtMouseEvent(
	// 		(event instanceof MouseEvent ? event : event.nativeEvent)
	// 	);
	// }

	const activeColumns = board.columns.filter((col) => col.active);

	async function handleSwimlaneMinimize(rowIndex: number) {
		try {
			const swimlaneName = swimlanes[rowIndex]?.swimlaneName;
			if (!swimlaneName) return;
			const boardIndex = plugin.settings.data.boardConfigs.findIndex((b) => b.name === board.name);
			if (boardIndex === -1) return;
			const swimCfg = plugin.settings.data.boardConfigs[boardIndex].swimlanes || { minimized: [] };
			const arr = Array.isArray(swimCfg.minimized) ? [...swimCfg.minimized] : [];
			const idx = arr.indexOf(swimlaneName);
			if (idx === -1) arr.push(swimlaneName); else arr.splice(idx, 1);
			plugin.settings.data.boardConfigs[boardIndex].swimlanes.minimized = arr;
			await plugin.saveSettings();
			eventEmitter.emit('REFRESH_BOARD');
		} catch (err) {
			console.error('Error toggling swimlane minimize:', err);
		}
	}

	// Render a sticky header row of column headers across swimlanes
	return (
		<div className="kanbanSwimlanesGrid">

			{/* Swimlane Rows */}
			<div className="swimlanesContainer">
				{/* Top header showing column headers and counts */}
				<div className={`swimlanesHeaderContainer${verticalHeaderUI ? ' verticalUI' : ''}`}>
					<div className="swimlanesHeaderRow">
						{activeColumns.map((column, colIndex) => (
							<MemoizedSwimlanColumn
								key={`header-${column.id}`}
								plugin={plugin}
								columnIndex={column.index}
								activeBoardData={board}
								columnData={column}
								tasksForThisColumn={tasksPerColumn?.[colIndex] || []}
								Component={ColumnComponent}
								headerOnly={true}
							/>
						))}
					</div>
				</div>
				{swimlanes.map((swimlane, rowIndex) => (
					<React.Fragment key={swimlane.swimlaneValue}>
						{verticalHeaderUI ? (
							<div className={`swimlaneRow verticalUI ${swimlane.minimized ? 'minimized' : ''}`}>
								{/* Swimlane Label */}
								<div className='swimlaneHeaderContainer-vertical'>
									<div className='swimlaneHeader-vertical'>
										<div className='swimlaneHeaderSwimlaneCount-vertical'>
											{swimlane.tasks.flat().length ?? 0}
										</div>
										<div className="swimlaneLabel-vertical" title={swimlane.swimlaneName}>
											{swimlane.swimlaneName}
										</div>
										<div className='swimlaneHeaderContainerMinimizICon' onClick={() => handleSwimlaneMinimize(rowIndex)}>
											{swimlane.minimized ? (<ChevronRight />) : (<ChevronDown />)}
										</div>
									</div>
								</div>

								{/* Columns for this Swimlane */}
								<div className="swimlaneColumnsWrapper" style={{ maxHeight: swimlane.minimized ? '0px' : maxSwimlaneHeight }}>
									{swimlane.minimized ? null : activeColumns.map((column, colIndex) => {
										const swimlaneData = {
											property: board.swimlanes.property,
											value: swimlane.swimlaneValue,
										};

										return (
											<MemoizedSwimlanColumn
												key={`${swimlane.swimlaneValue}-${column.id}`}
												plugin={plugin}
												columnIndex={column.index}
												activeBoardData={board}
												columnData={column}
												tasksForThisColumn={swimlane.tasks[colIndex] || []}
												Component={ColumnComponent}
												swimlaneData={swimlaneData}
												hideColumnHeader={true}
											/>
										);
									})}
								</div>
							</div>
						) : (
							<div className={`swimlaneRow ${swimlane.minimized ? 'minimized' : ''}`}>
								{/* Swimlane Label */}
								<div className='swimlaneHeaderContainer'>
									<div className='swimlaneHeader'>
										<div className='swimlaneHeaderContainerMinimizICon' onClick={() => handleSwimlaneMinimize(rowIndex)}>
											{swimlane.minimized ? (<ChevronRight />) : (<ChevronDown />)}
										</div>
										<div className="swimlaneLabel" title={swimlane.swimlaneName}>
											{swimlane.swimlaneName}
										</div>
										<div className='swimlaneHeaderSwimlaneCount'>
											{swimlane.tasks.flat().length ?? 0}
										</div>
									</div>
								</div>

								{/* Columns for this Swimlane */}
								<div className="swimlaneColumnsWrapper" style={{ maxHeight: swimlane.minimized ? '0px' : maxSwimlaneHeight }}>
									{swimlane.minimized ? null : activeColumns.map((column, colIndex) => {
										const swimlaneData = {
											property: board.swimlanes.property,
											value: swimlane.swimlaneValue,
										};

										return (
											<MemoizedSwimlanColumn
												key={`${swimlane.swimlaneValue}-${column.id}`}
												plugin={plugin}
												columnIndex={column.index}
												activeBoardData={board}
												columnData={column}
												tasksForThisColumn={swimlane.tasks[colIndex] || []}
												Component={ColumnComponent}
												hideColumnHeader={true}
												swimlaneData={swimlaneData}
											/>
										);
									})}
								</div>
							</div>
						)}
					</React.Fragment>
				))}
			</div>
		</div>
	);
};

/**
 * Extract unique values for a given property from tasks already grouped per column
 */
function extractUniquePropertyValuesFromColumns(
	tasksPerColumn: taskItem[][],
	property: string,
	customValue?: string
): string[] {
	const uniqueValues = new Set<string>();

	tasksPerColumn.forEach((columnTasks) => {
		columnTasks.forEach((task) => {
			const values = getPropertyValues(task, property, customValue);
			values.forEach((v) => uniqueValues.add(v));
		});
	});

	return Array.from(uniqueValues).sort();
}

/**
 * Get property values from a single task
 */
function getPropertyValues(
	task: taskItem,
	property: string,
	customValue?: string
): string[] {
	let values: string[] = [];

	// console.log("getPropertyValues...", "\ntask:", task, "\nproperty", property, "\ncustomValue:", customValue);

	switch (property) {
		case 'tags':
			if (task.tags && Array.isArray(task.tags)) {
				values = task.tags.map((tag: string) => {
					if (typeof tag === 'string') return tag.replace('#', '');
					return '';
				}).filter((v: string) => v);
			}
			break;

		case 'priority':
			if (task.priority !== undefined && task.priority !== null) {
				values = [String(task.priority)];
			}
			break;

		case 'status':
			if (task.status) {
				values = [task.status];
			}
			break;

		// case 'project':
		// 	if (task.project) {
		// 		values = [task.project];
		// 	}
		// 	break;

		// case 'context':
		// 	if (task.context) {
		// 		values = [task.context];
		// 	}
		// 	break;

		// case 'custom':
		// 	if (customValue && task?.[customValue]) {
		// 		const customProp = task?.[customValue];
		// 		console.log("customValue", customValue, "\ntask[customValue]", task[customValue], "\ncustomProp", customProp);
		// 		if (Array.isArray(customProp)) {
		// 			values = customProp.map((v: any) => String(v)).filter((v) => v);
		// 		} else {
		// 			values = [String(customProp)];
		// 		}
		// 	}
		// 	break;

		default:
			break;
	}

	return values.filter((v) => v && v.trim());
}

/**
 * Memoized swimlane column component
 */
const MemoizedSwimlanColumn = memo<{
	plugin: TaskBoard;
	columnIndex: number;
	activeBoardData: Board;
	columnData: ColumnData;
	tasksForThisColumn: taskItem[];
	Component: typeof Column | typeof LazyColumn;
	hideColumnHeader?: boolean;
	swimlaneData?: { property: string, value: string };
	headerOnly?: boolean;
}>(({ Component, ...props }) => {
	return <Component {...props} />;
}, (prevProps, nextProps) => {
	return (
		prevProps.tasksForThisColumn === nextProps.tasksForThisColumn &&
		prevProps.columnData === nextProps.columnData &&
		prevProps.Component === nextProps.Component &&
		prevProps.hideColumnHeader === nextProps.hideColumnHeader
	);
});

export default memo(KanbanSwimlanesContainer);
