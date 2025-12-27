// src/components/KanbanView/KanbanSwimlanesContainer.tsx

import React, { useMemo, memo } from 'react';
import { Board, ColumnData } from 'src/interfaces/BoardConfigs';
import { taskItem, taskJsonMerged } from 'src/interfaces/TaskItem';
import Column from './Column';
import LazyColumn from './LazyColumn';
import type TaskBoard from 'main';
import { t } from 'src/utils/lang/helper';
import { Menu } from 'obsidian';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa';

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
	// minimized: boolean;
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
	const { property, sortCriteria, customSortOrder, customValue, groupAllRest, maxHeight: maxSwimlaneHeight, verticalHeaderUI } = board.swimlanes;
	const swimlanes = useMemo(() => {
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

		if (sortCriteria === 'custom' && customSortOrder && customSortOrder.length > 0) {
			// Use custom sort order
			sortedSwimlaneValues = customSortOrder.map((item) => ({
				value: item.value.replace('#', ''),
				index: item.index,
			}));

			// Add remaining values that are not in customSortOrder
			const customValues = new Set(customSortOrder.map((item) => item.value.replace('#', '')));
			const remainingValues = uniqueSwimlanValues.filter((val) => !customValues.has(val));
			console.log("KanbanSwimlanesContainer...\ncustomValues", customValues, "\nremainingValues", remainingValues);

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
				// Filter tasks in this column that match the swimlane value for the selected property
				return columnTasks.filter((task) => {
					const values = getPropertyValues(task, property, customValue);
					return values.includes(swimlaneItem.value);
				});
			});

			return {
				swimlaneName: t(property) + ': ' + swimlaneItem.value,
				swimlaneValue: swimlaneItem.value,
				tasks: tasksByColumn,
			};
		});

		// Filter out empty swimlanes if showEmptySwimlanes is false
		if (!board.swimlanes.showEmptySwimlanes) {
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

		// Render a sticky header row of column headers across swimlanes
		return (
			<div className="kanbanSwimlanesGrid">
				{/* Top header showing column headers and counts */}
				<div className="swimlanesHeaderContainer">
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
								hideColumnHeader={false}
								headerOnly={true}
							/>
						))}
					</div>
				</div>

				{/* Swimlane Rows */}
				<div className="swimlanesContainer">
					{swimlanes.map((swimlane, rowIndex) => (
						<React.Fragment key={swimlane.swimlaneValue}>
							{verticalHeaderUI ? (
								<div className="swimlaneRow vertical">
									{/* Swimlane Label */}
									<div className='swimlaneHeaderContainer-vertical'>
										<div className='swimlaneHeader-vertical'>
											<div className="swimlaneLabel-vertical" title={swimlane.swimlaneName}>
												{swimlane.swimlaneName}
											</div>
											<div className='swimlaneHeaderSwimlaneCount'>
												{swimlane.tasks.flat().length ?? 0}
											</div>
										</div>
									</div>

									{/* Columns for this Swimlane */}
									<div className="swimlaneColumnsWrapper" style={{ maxHeight: maxSwimlaneHeight }}>
										{activeColumns.map((column, colIndex) => {
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
													hideColumnHeader={rowIndex !== 0}
													swimlaneData={swimlaneData}
												/>
											);
										})}
									</div>
								</div>
							) : (
								<div className="swimlaneRow">
									{/* Swimlane Label */}
									<div className='swimlaneHeaderContainer'>
										<div className='swimlaneHeader'>
											<div className="swimlaneLabel" title={swimlane.swimlaneName}>
												{swimlane.swimlaneName}
											</div>
											<div className='swimlaneHeaderSwimlaneCount'>
												{swimlane.tasks.flat().length ?? 0}
											</div>
										</div>
									</div>

									{/* Columns for this Swimlane */}
									<div className="swimlaneColumnsWrapper" style={{ maxHeight: maxSwimlaneHeight }}>
										{activeColumns.map((column, colIndex) => {
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
													hideColumnHeader={rowIndex !== 0}
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
	swimlaneData: { property: string, value: string };
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
