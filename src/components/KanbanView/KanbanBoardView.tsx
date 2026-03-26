// src/components/KanbanBoard.tsx

import { Board, ColumnData, View } from "../../interfaces/BoardConfigs";
import React, { memo, useEffect, useMemo, useState } from "react";
import { taskItem, taskJsonMerged } from "src/interfaces/TaskItem";
import LazyColumn from "./LazyColumn";
import KanbanSwimlanesContainer from "./KanbanSwimlanesContainer";
import type TaskBoard from "main";
import { t } from "src/utils/lang/helper";
import { columnSegregator } from "src/utils/algorithms/ColumnSegregator";

interface KanbanBoardProps {
	plugin: TaskBoard;
	currentBoardData: Board;
	currentView: View;
	currentViewIndex: number;
	filteredAndSearchedTasks: taskJsonMerged;
	freshInstall: boolean;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ plugin, currentBoardData, currentView, currentViewIndex, filteredAndSearchedTasks, freshInstall }) => {
	const [loading, setLoading] = useState(true);

	// Check if lazy loading is enabled
	const ColumnComponent = LazyColumn; // lazyLoadingEnabled ? LazyColumn : Column;

	// Get columns from the current view's kanban configuration
	const columns = currentView?.kanbanView?.columns || [];

	// Second memo: Segregate filtered tasks by column (for Kanban view only)
	const allTasksArrangedPerColumn = useMemo(() => {
		if (currentBoardData && currentView && filteredAndSearchedTasks) {
			return columns
				.filter((column) => column.active)
				.map((column: ColumnData) =>
					columnSegregator(plugin.settings, currentView, column, filteredAndSearchedTasks, (updatedViewData: View) => {
						// plugin.settings.data.boardConfigs[board.index] = updatedBoardData;
						let updatedBoardData = { ...currentBoardData };
						if (updatedBoardData.views) {
							updatedBoardData.views[currentViewIndex] = updatedViewData;
						}

						// Using the plugin's debounced save function to update the board data with the new view configuration
						plugin.taskBoardFileManager.debouncedSaveBoard(updatedBoardData);
					})
				);
		}
		return [];
	}, [filteredAndSearchedTasks, currentBoardData, currentView]);

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
				) : columns?.length === 0 ? (
					<div className="emptyBoardMessage">
						Create columns on this view using the view config modal from top right corner button.
					</div>
				) : currentView?.kanbanView?.swimlanes?.enabled ? (
					<KanbanSwimlanesContainer
						plugin={plugin}
						currentBoardData={currentBoardData}
						currentView={currentView}
						currentViewIndex={currentViewIndex}
						tasksPerColumn={allTasksArrangedPerColumn}
					/>
				) : (
					columns
						.filter((column) => column.active)
						.map((column, index) => (
							<MemoizedColumn
								key={index}
								plugin={plugin}
								activeBoardData={currentBoardData}
								currentView={currentView}
								currentViewIndex={currentViewIndex}
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
	activeBoardData: Board;
	currentView: View;
	currentViewIndex: number;
	columnData: ColumnData;
	tasksForThisColumn: taskItem[];
	Component: typeof LazyColumn;
}>(({ Component, ...props }) => {
	return <Component {...props} />;
}, (prevProps, nextProps) => {
	return (
		prevProps.activeBoardData === nextProps.activeBoardData &&
		prevProps.currentView === nextProps.currentView &&
		prevProps.currentViewIndex === nextProps.currentViewIndex &&
		prevProps.columnData === nextProps.columnData &&
		prevProps.tasksForThisColumn === nextProps.tasksForThisColumn &&
		prevProps.Component === nextProps.Component
	);
});

export default memo(KanbanBoard);
