// /src/components/Column.tsx

import React, { memo, useCallback, useMemo, useState } from 'react';

import { CSSProperties } from 'react';
import { ColumnProps } from '../interfaces/ColumnProps';
import TaskItem from './TaskItem';
import { t } from 'src/utils/lang/helper';
import { taskItem } from 'src/interfaces/TaskItemProps';

// Function to get all tags from a task (both line tags and frontmatter tags)
const getAllTaskTags = (task: taskItem): string[] => {
	const lineTags = task.tags || [];
	const frontmatterTags = task.frontmatterTags || [];
	return [...lineTags, ...frontmatterTags];
};

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
	const [isDragOver, setIsDragOver] = useState(false);
	if (plugin.settings.data.boardConfigs[activeBoardIndex].hideEmptyColumns && (tasksForThisColumn === undefined || tasksForThisColumn.length === 0)) {
		return null; // Don't render the column if it has no tasks and empty columns are hidden
	}
	// Local tasks state, initially set from external tasks
	const [localTasks, setLocalTasks] = useState(tasksForThisColumn);

	const columnWidth = plugin.settings.data.globalSettings.columnWidth || '273px';
	const activeBoardSettings = plugin.settings.data.boardConfigs[activeBoardIndex];

	// Extra code to provide special data-types for theme support.
	const tagColors = plugin.settings.data.globalSettings.tagColors;
	const tagColorMap = new Map(tagColors.map((t) => [t.name, t]));
	const tagData = tagColorMap.get(columnData?.coltag || '');
	// Detect external changes in tasksForThisColumn
	React.useEffect(() => {
		// Ensure we don't have duplicate tasks when updating from external source
		// by creating a unique list based on id-filePath combination
		const uniqueTasks = Array.from(
			new Map(tasksForThisColumn.map((task: taskItem) => 
				[`${task.id}-${task.filePath}`, task]
			)).values()
		);
		setLocalTasks(uniqueTasks);
	}, [tasksForThisColumn]);

	// Drag and drop handlers to reorder within the column
	const handleTaskDragStart = (e: React.DragEvent<HTMLDivElement>, dragIndex: number) => {
		e.dataTransfer.setData('text/plain', dragIndex.toString());
		e.dataTransfer.effectAllowed = 'move';
	};
	const handleTaskDrop = async (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
		e.preventDefault();
		setIsDragOver(false);
		const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
		
		if (isNaN(dragIndex) || dragIndex === dropIndex) return;
		
		// Make a deep copy to avoid mutations
		const updated = JSON.parse(JSON.stringify(localTasks));
		
		// Save the task that's being moved
		const movedTask = updated[dragIndex];
		
		// Remove task from original position
		updated.splice(dragIndex, 1);
		
		// Insert at new position
		updated.splice(dropIndex, 0, movedTask);
		
		// Update local state for immediate visual feedback
		setLocalTasks(updated);
				// Ensure uniqueness of tasks by checking ID and filePath combination
		// This prevents duplication issues
		const uniqueTasks = Array.from(
			new Map(updated.map((task: taskItem) => [`${task.id}-${task.filePath}`, task])).values()
		);
		
		// Persist the new order with the deduplicated task list
		const { updateTaskOrderInColumn } = await import('../utils/DragDropTaskManager');
		await updateTaskOrderInColumn(plugin, columnData, uniqueTasks);
	};
	// Handler for when a task is dropped onto this column
	const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(false);

		// Only allow drops on namedTag columns (we need a tag to assign)
		if (columnData.colType !== 'namedTag') return;

		try {
			// Get the data of the dragged task
			const taskData = e.dataTransfer.getData('application/json');
			if (taskData) {
				const { task, sourceColumnData } = JSON.parse(taskData);

				// Ensure we have valid data
				if (!task || !sourceColumnData) return;

				// If it is the same lane (coltag), DO NOT change tags, just reorder
				if (sourceColumnData.colType === 'namedTag' && sourceColumnData.coltag === columnData.coltag) {
					// Do nothing here, the reordering is already handled by handleTaskDrop
					return;
				}

				// If it is between different tagged columns, change tags normally
				import('../utils/DragDropTaskManager').then(async ({ updateTaskTagsForColumnMove, updateTaskAfterDragDrop }) => {
					const updatedTask = await updateTaskTagsForColumnMove(
						plugin,
						task,
						sourceColumnData,
						columnData
					);
					await updateTaskAfterDragDrop(plugin, updatedTask, task);
				});
			}
		} catch (error) {
			console.error('Error handling task drop:', error);
		}
	}, [columnData, plugin]);

	// Handle the dragover event to allow the drop
	const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		// Only allow drop if this column is of type "namedTag"
		if (columnData.colType === 'namedTag') {
			e.preventDefault();
			setIsDragOver(true);
		}
	}, [columnData]);

	// Handle the dragleave event to remove the visual effect
	const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		setIsDragOver(false);
	}, []);

	return (
		<div 
			className={`TaskBoardColumnsSection ${isDragOver ? 'dragover' : ''}`}
			style={{ '--column-width': columnWidth } as CustomCSSProperties} 
			data-column-type={columnData.colType} 
			data-column-tag-name={tagData?.name} 
			data-column-tag-color={tagData?.color}
			onDrop={handleDrop}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDragEnd={() => setIsDragOver(false)}
		>
			<div className="taskBoardColumnSecHeader">
				<div className="taskBoardColumnSecHeaderTitleSec">
					<div className="columnTitle">{columnData.name}</div>
				</div>
			</div>
			<div className={`tasksContainer${plugin.settings.data.globalSettings.showVerticalScroll ? '' : '-SH'}`}>
				{localTasks.length > 0 ? (
					localTasks.map((task, index) => {
						const allTaskTags = getAllTaskTags(task);
						
						const shouldRenderTask = parseInt(activeBoardSettings.filterPolarity || "0") === 1 &&
							allTaskTags.some((tag: string) => activeBoardSettings.filters?.includes(tag));

						if (shouldRenderTask || parseInt(activeBoardSettings.filterPolarity || "0") === 0) {
							return (
								<div
									key={index}
									className="taskItemFadeIn"
									draggable={true}
									onDragStart={e => handleTaskDragStart(e, index)}
									onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
									onDrop={e => handleTaskDrop(e, index)}
								>
									<TaskItem
										key={index}
										plugin={plugin}
										taskKey={index}
										task={task}
										columnIndex={columnIndex}
										activeBoardSettings={activeBoardSettings}
										columnData={columnData}
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
