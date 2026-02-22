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
	currentBoardData: Board;
	currentBoardIndex: number;
	filteredAndSearchedTasks: taskJsonMerged;
	freshInstall: boolean;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ plugin, currentBoardData, currentBoardIndex, filteredAndSearchedTasks, freshInstall }) => {
	const [loading, setLoading] = useState(true);

	// Check if lazy loading is enabled
	const ColumnComponent = LazyColumn; // lazyLoadingEnabled ? LazyColumn : Column;

	// Second memo: Segregate filtered tasks by column (for Kanban view only)
	const allTasksArrangedPerColumn = useMemo(() => {
		if (currentBoardData && filteredAndSearchedTasks) {
			return currentBoardData.columns
				.filter((column) => column.active)
				.map((column: ColumnData) =>
					columnSegregator(plugin.settings, currentBoardData, column, filteredAndSearchedTasks, (updatedBoardData: Board) => {
						// plugin.settings.data.boardConfigs[board.index] = updatedBoardData;

						// TODO Add a debounce here, as this callback will be called at high rate.
						plugin.taskBoardFileManager.saveBoard(updatedBoardData);
					})
				);
		}
		return [];
	}, [filteredAndSearchedTasks, currentBoardData]);

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
				) : currentBoardData?.columns?.length === 0 ? (
					<div className="emptyBoardMessage">
						Create columns on this board using the board config modal from top right corner button.
					</div>
				) : currentBoardData?.swimlanes?.enabled ? (
					<KanbanSwimlanesContainer
						plugin={plugin}
						currentBoardData={currentBoardData}
						currentBoardIndex={currentBoardIndex}
						tasksPerColumn={allTasksArrangedPerColumn}
					/>
				) : (
					currentBoardData?.columns
						.filter((column) => column.active)
						.map((column, index) => (
							<MemoizedColumn
								key={index}
								plugin={plugin}
								activeBoardData={currentBoardData}
								columnData={column}
								activeBoardIndex={currentBoardIndex}
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
	activeBoardData: Board;
	columnData: ColumnData;
	activeBoardIndex: number;
	tasksForThisColumn: taskItem[];
	Component: typeof LazyColumn;
}>(({ Component, ...props }) => {
	return <Component {...props} />;
}, (prevProps, nextProps) => {
	return (
		prevProps.activeBoardData === nextProps.activeBoardData &&
		prevProps.columnData === nextProps.columnData &&
		prevProps.tasksForThisColumn === nextProps.tasksForThisColumn &&
		prevProps.Component === nextProps.Component
	);
});

export default memo(KanbanBoard);
