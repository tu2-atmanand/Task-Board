// src/components/KanbanBoard.tsx

import { Board, ColumnData } from "../../interfaces/BoardConfigs";
import React, { memo, useEffect, useMemo, useState } from "react";
import { taskItem, taskJsonMerged } from "src/interfaces/TaskItem";

import { App } from "obsidian";
import LazyColumn from "./LazyColumn";
import KanbanSwimlanesContainer from "./KanbanSwimlanesContainer";
import type TaskBoard from "main";
import { t } from "src/utils/lang/helper";
import { columnSegregator } from "src/utils/algorithms/ColumnSegregator";

interface KanbanBoardProps {
	app: App;
	plugin: TaskBoard;
	board: Board;
	filteredAndSearchedTasks: taskJsonMerged;
	freshInstall: boolean;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ plugin, board, filteredAndSearchedTasks, freshInstall }) => {
	const [loading, setLoading] = useState(true);

	// Check if lazy loading is enabled
	const ColumnComponent = LazyColumn; // lazyLoadingEnabled ? LazyColumn : Column;

	// Second memo: Segregate filtered tasks by column (for Kanban view only)
	const allTasksArrangedPerColumn = useMemo(() => {
		if (board && filteredAndSearchedTasks) {
			const finalArrangedTasks = board.columns
				.filter((column) => column.active)
				.map((column: ColumnData) =>
					columnSegregator(plugin.settings, board.index, column, filteredAndSearchedTasks, (updatedBoardData: Board) => {
						plugin.settings.data.boardConfigs[board.index] = updatedBoardData;
					})
				);

			setLoading(false);
			return finalArrangedTasks;
		}

		setLoading(false);
		return [];
	}, [filteredAndSearchedTasks, board]);

	// Memoize columns separation for swimlanes
	const { columnsInSwimlanes, columnsOutsideSwimlanes, swimlaneColumnTasks, outsideSwimlaneColumnTasks } = useMemo(() => {
		if (!board?.swimlanes?.enabled) {
			return {
				columnsInSwimlanes: [],
				columnsOutsideSwimlanes: [],
				swimlaneColumnTasks: [],
				outsideSwimlaneColumnTasks: []
			};
		}

		const activeColumns = board.columns.filter((column) => column.active);
		const outsideSwimlanes: ColumnData[] = [];
		const insideSwimlanes: ColumnData[] = [];
		const outsideTasks: taskItem[][] = [];
		const insideTasks: taskItem[][] = [];

		activeColumns.forEach((column, index) => {
			if (column.swimlaneEnabled === false) {
				outsideSwimlanes.push(column);
				outsideTasks.push(allTasksArrangedPerColumn[index] || []);
			} else {
				insideSwimlanes.push(column);
				insideTasks.push(allTasksArrangedPerColumn[index] || []);
			}
		});

		return {
			columnsOutsideSwimlanes: outsideSwimlanes,
			columnsInSwimlanes: insideSwimlanes,
			outsideSwimlaneColumnTasks: outsideTasks,
			swimlaneColumnTasks: insideTasks
		};
	}, [board, allTasksArrangedPerColumn]);

	// useEffect(() => {
	// 	if (allTasksArrangedPerColumn.flat().length > 0) {
	// 		setLoading(false);
	// 	}
	// }, [allTasksArrangedPerColumn]);

	const renderColumns = (columns: ColumnData[], tasks: taskItem[][]) => {
		return columns.map((column, index) => (
			<MemoizedColumn
				key={`${column.id}-${index}`}
				plugin={plugin}
				columnIndex={column.index}
				activeBoardData={board}
				columnData={column}
				tasksForThisColumn={tasks[index] || []}
				Component={ColumnComponent}
			/>
		));
	};

	const renderLoadingOrEmpty = () => {
		if (loading) {
			return (
				<div className="loadingContainer">
					{freshInstall ? (
						<h2 className="initializationMessage">
							{t("fresh-install-1")}
							<br />
							<br />
							{t("fresh-install-2")}
							<br />
							<br />
							{t("fresh-install-3")}
						</h2>
					) : (
						<>
							<div className="spinner"></div>
							<p>{t("loading-tasks")}</p>
						</>
					)}
				</div>
			);
		}

		if (board?.columns?.length === 0) {
			return (
				<div className="emptyBoardMessage">
					Create columns on this board using the board config modal from top right corner button.
				</div>
			);
		}

		return null;
	};

	// When swimlanes are enabled but some columns are excluded
	const hasExcludedColumns = board?.swimlanes?.enabled && columnsOutsideSwimlanes.length > 0;
	const hasSwimlaneColumns = board?.swimlanes?.enabled && columnsInSwimlanes.length > 0;

	// Create a modified board for swimlanes that only contains swimlane-enabled columns
	const swimlaneBoard = hasSwimlaneColumns ? {
		...board,
		columns: columnsInSwimlanes
	} : null;

	return (
		<div className="kanbanBoard">
			{hasExcludedColumns && (
				<div className="columnsContainer">
					{renderColumns(columnsOutsideSwimlanes, outsideSwimlaneColumnTasks)}
				</div>
			)}
			{hasSwimlaneColumns ? (
				<KanbanSwimlanesContainer
					plugin={plugin}
					board={swimlaneBoard!}
					tasksPerColumn={swimlaneColumnTasks}
				/>
			) : (
				!hasExcludedColumns && (
					<div className="columnsContainer">
						{renderLoadingOrEmpty() || (
							board?.columns
								.filter((column) => column.active)
								.map((column, index) => (
									<MemoizedColumn
										key={index}
										plugin={plugin}
										columnIndex={column.index}
										activeBoardData={board}
										columnData={column}
										tasksForThisColumn={allTasksArrangedPerColumn[index]}
										Component={ColumnComponent}
									/>
								))
						)}
					</div>
				)
			)}
		</div>
	);
};

const MemoizedColumn = memo<{
	plugin: TaskBoard;
	columnIndex: number;
	activeBoardData: Board;
	columnData: ColumnData;
	tasksForThisColumn: taskItem[];
	Component: typeof LazyColumn;
}>(({ Component, ...props }) => {
	return <Component {...props} />;
}, (prevProps, nextProps) => {
	return (
		prevProps.tasksForThisColumn === nextProps.tasksForThisColumn &&
		prevProps.columnData === nextProps.columnData &&
		prevProps.Component === nextProps.Component
	);
});

export default memo(KanbanBoard);
