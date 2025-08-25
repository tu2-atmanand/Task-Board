// /src/components/Column.tsx

import React, { memo, useMemo } from 'react';

import { CSSProperties } from 'react';
import TaskItem from './TaskItem';
import { t } from 'src/utils/lang/helper';
import { getAllTaskTags } from 'src/utils/TaskItemUtils';
import TaskBoard from 'main';
import { Board, ColumnData } from 'src/interfaces/BoardConfigs';
import { taskItem } from 'src/interfaces/TaskItem';

type CustomCSSProperties = CSSProperties & {
	'--column-width': string;
};

export interface ColumnProps {
	key: number;
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
	// 		renderColumns(plugin, setTasks, activeBoardIndex, colType, columnData, allTasksExternal);
	// 	}
	// }, [colType, columnData, allTasksExternal]);

	const columnWidth = plugin.settings.data.globalSettings.columnWidth || '273px';
	// const activeBoardSettings = plugin.settings.data.boardConfigs[activeBoardIndex];

	// Extra code to provide special data-types for theme support.
	const tagColors = plugin.settings.data.globalSettings.tagColors;
	const tagColorMap = new Map(tagColors.map((t) => [t.name, t]));
	const tagData = tagColorMap.get(columnData?.coltag || '');

	return (
		<div className="TaskBoardColumnsSection" style={{ '--column-width': columnWidth } as CustomCSSProperties} data-column-type={columnData.colType} data-column-tag-name={tagData?.name} data-column-tag-color={tagData?.color}>
			<div className="taskBoardColumnSecHeader">
				<div className="taskBoardColumnSecHeaderTitleSec">
					{/* <button className="columnDragIcon" aria-label='More Column Options' ><RxDragHandleDots2 /></button> */}
					<div className="taskBoardColumnSecHeaderTitleSecColumnTitle">{columnData.name}</div>
				</div>
				<div className='taskBoardColumnSecHeaderTitleSecColumnCount'>{tasksForThisColumn.length}</div>
				{/* <RxDotsVertical /> */}
			</div>
			<div className={`tasksContainer${plugin.settings.data.globalSettings.showVerticalScroll ? '' : '-SH'}`}>
				{tasks.length > 0 ? (
					tasks.map((task, index = task.id) => {
						const allTaskTags = getAllTaskTags(task);
						const shouldRenderTask = parseInt(activeBoardData?.filterPolarity || "0") === 1 &&
							activeBoardData.filters.length > 0 &&
							allTaskTags.length > 0 &&
							allTaskTags.some((tag: string) => activeBoardData?.filters?.includes(tag));

						if (shouldRenderTask || parseInt(activeBoardData?.filterPolarity || "0") === 0) {
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
						}

						return null;
					})
				) : (
					<p>{t("no-tasks-available")}</p>
				)}
			</div>
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
