// /src/components/Column.tsx

import React, { memo, useMemo } from 'react';

import { CSSProperties } from 'react';
import { ColumnProps } from '../interfaces/ColumnProps';
import TaskItem from './TaskItem';
import { t } from 'src/utils/lang/helper';

type CustomCSSProperties = CSSProperties & {
	'--column-width': string;
};

const Column: React.FC<ColumnProps> = ({
	plugin,
	columnIndex,
	activeBoardIndex,
	columnData,
	tasksForThisColumn,
}) => {
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
	const activeBoardSettings = plugin.settings.data.boardConfigs[activeBoardIndex];

	return (
		<div className="TaskBoardColumnsSection" style={{ '--column-width': columnWidth } as CustomCSSProperties}>
			<div className="taskBoardColumnSecHeader">
				<div className="taskBoardColumnSecHeaderTitleSec">
					{/* <button className="columnDragIcon" aria-label='More Column Options' ><RxDragHandleDots2 /></button> */}
					<div className="columnTitle">{columnData.name}</div>
				</div>
				{/* <RxDotsVertical /> */}
			</div>
			<div className={`tasksContainer${plugin.settings.data.globalSettings.showVerticalScroll ? '' : '-SH'}`}>
				{tasks.length > 0 ? (
					tasks.map((task, index = task.id) => {
						const shouldRenderTask = parseInt(activeBoardSettings.filterPolarity || "0") === 1 &&
							task.tags.some((tag: string) => activeBoardSettings.filters?.includes(tag));

						if (shouldRenderTask || parseInt(activeBoardSettings.filterPolarity || "0") === 0) {
							return (
								<div key={index} className="taskItemFadeIn">
									<TaskItem
										key={index}
										plugin={plugin}
										taskKey={index}
										task={task}
										columnIndex={columnIndex}
										activeBoardSettings={activeBoardSettings}
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
