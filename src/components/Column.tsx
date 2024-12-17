// /src/components/Column.tsx

import { App, moment as _moment } from 'obsidian';
import React, { useEffect, useState } from 'react';
import { deleteTaskFromFile, deleteTaskFromJson, updateTaskInFile, updateTaskInJson } from 'src/utils/TaskItemUtils';
import { moveFromCompletedToPending, moveFromPendingToCompleted } from 'src/utils/TaskItemUtils';
import { taskItem, taskJsonMerged } from 'src/interfaces/TaskItemProps';

import { AddOrEditTaskModal } from "src/modal/AddOrEditTaskModal";
import { CSSProperties } from 'react';
import { ColumnProps } from '../interfaces/ColumnProps';
import { DeleteConfirmationModal } from '../modal/DeleteConfirmationModal';
import { EditButtonMode } from 'src/interfaces/GlobalSettings';
import TaskItem from './TaskItem';
import { markdownButtonHoverPreviewEvent } from 'src/services/MarkdownHoverPreview';
import { renderColumns } from 'src/utils/RenderColumns';
import { t } from 'src/utils/lang/helper';

type CustomCSSProperties = CSSProperties & {
	'--column-width': string;
};

interface ColumnPropsWithSetBoards extends ColumnProps {
	setBoards: React.Dispatch<React.SetStateAction<any[]>>;
}

const Column: React.FC<ColumnPropsWithSetBoards> = ({
	app,
	plugin,
	columnIndex,
	activeBoardIndex,
	colType,
	data,
	tasks: externalTasks,
	allTasks: allTasksExternal
}) => {
	// Local tasks state, initially set from external tasks
	const [tasks, setTasks] = useState<taskItem[]>(externalTasks);
	const [allTasks, setAllTasks] = useState<taskJsonMerged>(allTasksExternal);
	const globalSettings = plugin.settings.data.globalSettings;

	// Sync local tasks state with external tasks when they change
	useEffect(() => {
		setTasks(externalTasks);
	}, [externalTasks]);

	// Render tasks using the tasks passed from KanbanBoard
	useEffect(() => {
		if (allTasksExternal.Pending.length > 0 || allTasksExternal.Completed.length > 0) {
			renderColumns(plugin, setTasks, activeBoardIndex, colType, data, allTasksExternal);
		}
	}, [colType, data, allTasksExternal]);

	const handleCheckboxChange = (updatedTask: taskItem) => {
		// const moment = require("moment");

		const updatedTasks = tasks.filter(t => t.id !== updatedTask.id);
		setTasks(updatedTasks); // Update state to remove completed task

		// Check if the task is completed
		if (updatedTask.completed) {
			const taskWithCompleted = { ...updatedTask, completed: "" };
			// Move from Completed to Pending
			moveFromCompletedToPending(plugin, taskWithCompleted);
			updateTaskInFile(plugin, taskWithCompleted, taskWithCompleted);
		} else {
			const moment = _moment as unknown as typeof _moment.default;
			const taskWithCompleted = { ...updatedTask, completed: moment().format(globalSettings?.taskCompletionDateTimePattern), };
			// Move from Pending to Completed
			moveFromPendingToCompleted(plugin, taskWithCompleted);
			updateTaskInFile(plugin, taskWithCompleted, taskWithCompleted);
		}
		// NOTE : The eventEmitter.emit("REFRESH_COLUMN") is being sent from the moveFromPendingToCompleted and moveFromCompletedToPending functions, because if i add that here, then all the things are getting executed parallely instead of sequential.
	};

	const handleSubTasksChange = (updatedTask: taskItem) => {
		updateTaskInJson(plugin, updatedTask);
		updateTaskInFile(plugin, updatedTask, updatedTask);
	};

	const handleDeleteTask = (app: App, task: taskItem) => {
		const mssg = t(61);
		const deleteModal = new DeleteConfirmationModal(app, {
			app,
			mssg,
			onConfirm: () => {
				deleteTaskFromFile(plugin, task);
				deleteTaskFromJson(plugin, task);
				// Remove the task from state after deletion
				setTasks((prevTasks) => prevTasks.filter(t => t.id !== task.id));
			},
			onCancel: () => {
				// console.log('Task deletion canceled');
			}
		});
		deleteModal.open();
	};

	const handleEditTask = (task: taskItem) => {
		if (plugin.settings.data.globalSettings.editButtonAction === EditButtonMode.PopUp) {
			const editModal = new AddOrEditTaskModal(
				app,
				plugin,
				(updatedTask) => {
					updatedTask.filePath = task.filePath;
					// Update the task in the file and JSON
					updateTaskInFile(plugin, updatedTask, task);
					updateTaskInJson(plugin, updatedTask);
					// NOTE : The eventEmitter.emit("REFRESH_COLUMN") is being sent from the updateTaskInJson function, because if i add that here, then all the things are getting executed parallely instead of sequential.
				},
				task.filePath,
				task);
			editModal.open();
		} else if (plugin.settings.data.globalSettings.editButtonAction === EditButtonMode.NoteInTab) {
			const getFile = plugin.app.vault.getFileByPath(task.filePath);
			if (getFile) {
				plugin.app.workspace.getLeaf("tab").openFile(getFile)
			}
		} else if (plugin.settings.data.globalSettings.editButtonAction === EditButtonMode.NoteInSplit) {
			const getFile = plugin.app.vault.getFileByPath(task.filePath);
			if (getFile) {
				plugin.app.workspace.getLeaf("split").openFile(getFile)
			}
		} else if (plugin.settings.data.globalSettings.editButtonAction === EditButtonMode.NoteInWindow) {
			const getFile = plugin.app.vault.getFileByPath(task.filePath);
			if (getFile) {
				plugin.app.workspace.getLeaf("window").openFile(getFile)
			}
		} else {
			// markdownButtonHoverPreviewEvent(app, event, task.filePath);
		}
	};

	const columnWidth = plugin.settings.data.globalSettings.columnWidth || '273px';
	const activeBoardSettings = plugin.settings.data.boardConfigs[activeBoardIndex];

	return (
		<div className="TaskBoardColumnsSection" style={{ '--column-width': columnWidth } as CustomCSSProperties}>
			<div className="taskBoardColumnSecHeader">
				<div className="taskBoardColumnSecHeaderTitleSec">
					{/* <button className="columnDragIcon" aria-label='More Column Options' ><RxDragHandleDots2 /></button> */}
					<div className="columnTitle">{data.name}</div>
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
								<TaskItem
									key={index}
									app={app}
									plugin={plugin}
									taskKey={index}
									task={task}
									columnIndex={columnIndex}
									activeBoardSettings={activeBoardSettings}
									onEdit={(task) => handleEditTask(task)}
									onDelete={() => handleDeleteTask(app, task)}
									onCheckboxChange={() => handleCheckboxChange(task)}
									onSubTasksChange={(updatedTask) => handleSubTasksChange(updatedTask)}
								/>
							);
						}

						return null;
					})
				) : (
					<p>{t(7)}</p>
				)}
			</div>
		</div>
	);

};

export default Column;
