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
			return board.columns
				.filter((column) => column.active)
				.map((column: ColumnData) =>
					columnSegregator(plugin.settings, board.index, column, filteredAndSearchedTasks, (updatedBoardData: Board) => {
						plugin.settings.data.boardConfigs[board.index] = updatedBoardData;
					})
				);
		}
		return [];
	}, [filteredAndSearchedTasks, board]);

	useEffect(() => {
		if (allTasksArrangedPerColumn.flat().length > 0) {
			setLoading(false);
		}
	}, [allTasksArrangedPerColumn]);

	return (
		<div className="kanbanBoard">
			<div className="columnsContainer">
				{loading ? (
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
				) : board?.columns?.length === 0 ? (
					<div className="emptyBoardMessage">
						Create columns on this board using the board config modal from top right corner button.
					</div>
				) : board?.swimlanes?.enabled ? (
					<KanbanSwimlanesContainer
						plugin={plugin}
						board={board}
						tasksPerColumn={allTasksArrangedPerColumn}
					/>
				) : (
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
