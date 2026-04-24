// src/components/KanbanBoard.tsx

import { t } from "i18next";
import React, { memo, useMemo, useState } from "react";
import TaskBoard from "../../../main.js";
import type { Board, ColumnData, KanbanView, TaskBoardViewType } from "../../interfaces/BoardConfigs.js";
import type { taskJsonMerged, taskItem } from "../../interfaces/TaskItem.js";
import { columnSegregator } from "../../utils/algorithms/ColumnSegregator.js";
import KanbanSwimlanesContainer from "./KanbanSwimlanesContainer.js";
import LazyColumn from "./LazyColumn.js";

interface KanbanBoardProps {
	plugin: TaskBoard;
	currentBoardData: Board;
	currentView: TaskBoardViewType;
	currentViewIndex: number;
	filteredAndSearchedTasks: taskJsonMerged;
	freshInstall: boolean;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ plugin, currentBoardData, currentView, currentViewIndex, filteredAndSearchedTasks, freshInstall }) => {
	if (!currentView?.kanbanView) {
		return (
			<div className="emptyBoardMessage">
				{t("Looks like the view data has been currupted. Please try duplicating this view or create a fresh new view.")}
			</div>
		)
	}

	const [loading, setLoading] = useState(true);

	const ColumnComponent = LazyColumn; // lazyLoadingEnabled ? LazyColumn : Column;
	const columns = currentView?.kanbanView?.columns || [];

	// Second memo: Segregate filtered tasks by column (for Kanban view only)
	const allTasksArrangedPerColumn = useMemo(() => {
		if (currentBoardData && currentView && filteredAndSearchedTasks) {
			const finalArrangedTasks = columns
				.filter((column) => column.active)
				.map((column: ColumnData) =>
					columnSegregator(plugin.settings, currentView, column, filteredAndSearchedTasks, (updatedViewData: TaskBoardViewType) => {
						// plugin.settings.data.boardConfigs[board.index] = updatedBoardData;
						let updatedBoardData = { ...currentBoardData };
						if (updatedBoardData.views) {
							updatedBoardData.views[currentViewIndex] = updatedViewData;
						}

						// Using the plugin's debounced save function to update the board data with the new view configuration
						plugin.taskBoardFileManager.debouncedSaveBoard(updatedBoardData);
					})
				);

			setLoading(false);
			return finalArrangedTasks;
		}
		return [];
	}, [filteredAndSearchedTasks, currentBoardData, currentView]);

	const renderColumns = (columns: ColumnData[], tasks: taskItem[][]) => {
		return columns.map((column, index) => (
			<MemoizedColumn
				key={`${column.id}-${index}`}
				plugin={plugin}
				activeBoardData={currentBoardData}
				kanbanViewData={currentView.kanbanView!}
				currentViewIndex={currentViewIndex}
				columnData={column}
				tasksForThisColumn={tasks[index] || []}
				Component={ColumnComponent}
			/>
		));
	};

	const renderLoadingOrEmpty = useMemo(() => {
		if (loading) {
			return (
				<div className="loadingContainer">
					<div className="spinner"></div>
					<p>{t("loading-tasks")}</p>
				</div>
			);
		}

		if (currentView.kanbanView!.columns?.length === 0) {
			return (
				<div className="emptyBoardMessage">
					{t("no-columns-message")}
				</div>
			);
		}

		return null;
	}, [loading]);

	const renderFreshInstallMessage = useMemo(() => {
		if (freshInstall) {
			return (
				<div className="loadingContainer">
					<h2 className="initializationMessage">
						{t("fresh-install-1")}
						<br />
						<br />
						{t("fresh-install-2")}
						<br />
						<br />
						{t("fresh-install-3")}
					</h2>
				</div>
			);
		}

		return null;
	}, [freshInstall]);

	const isSwimlanesEnabled = currentView.kanbanView!.swimlanes?.enabled === true;

	return (
		<div className="kanbanBoard">
			{renderLoadingOrEmpty || renderFreshInstallMessage || (
				<>
					{isSwimlanesEnabled ? (
						<KanbanSwimlanesContainer
							plugin={plugin}
							currentBoardData={currentBoardData}
							currentViewIndex={currentViewIndex}
							kanbanViewData={currentView!.kanbanView}
							tasksPerColumn={allTasksArrangedPerColumn}
						/>
					) : (
						<div className="columnsContainer">
							{renderColumns(
								currentView.kanbanView!.columns?.filter((column) => column.active) || [],
								allTasksArrangedPerColumn
							)}
						</div>
					)}
				</>
			)}
		</div>
	);
};

const MemoizedColumn = memo<{
	plugin: TaskBoard;
	activeBoardData: Board;
	currentViewIndex: number;
	kanbanViewData: KanbanView;
	columnData: ColumnData;
	tasksForThisColumn: taskItem[];
	Component: typeof LazyColumn;
}>(({ Component, ...props }) => {
	return <Component {...props} />;
}, (prevProps, nextProps) => {
	return (
		prevProps.activeBoardData === nextProps.activeBoardData &&
		prevProps.currentViewIndex === nextProps.currentViewIndex &&
		prevProps.kanbanViewData === nextProps.kanbanViewData &&
		prevProps.columnData === nextProps.columnData &&
		prevProps.tasksForThisColumn === nextProps.tasksForThisColumn &&
		prevProps.Component === nextProps.Component
	);
});

export default memo(KanbanBoard);
