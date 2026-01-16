// /src/components/MapView/TasksImporterPanel.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { taskItem } from 'src/interfaces/TaskItem';
import TaskItem from '../KanbanView/TaskItem';
import TaskBoard from 'main';
import { Board } from 'src/interfaces/BoardConfigs';
import { t } from 'src/utils/lang/helper';
import { eventEmitter } from 'src/services/EventEmitter';
import { applyIdToTaskItem } from 'src/utils/TaskItemUtils';

interface TasksImporterPanelProps {
	plugin: TaskBoard;
	allTasksArranged: taskItem[][];
	activeBoardSettings: Board;
	isVisible: boolean;
	onClose: () => void;
}

export const TasksImporterPanel: React.FC<TasksImporterPanelProps> = ({
	plugin,
	allTasksArranged,
	activeBoardSettings,
	isVisible,
	onClose
}) => {
	const [searchQuery, setSearchQuery] = useState('');
	const [importedTaskIds, setImportedTaskIds] = useState<Set<string>>(new Set());

	// Get all tasks without an ID (legacyId is empty)
	const tasksWithoutId = useMemo(() => {
		const flatTasks = allTasksArranged.flat();
		return flatTasks.filter(task => !task.legacyId && !importedTaskIds.has(task.id));
	}, [allTasksArranged, importedTaskIds]);

	// Filter tasks based on search query
	const filteredTasks = useMemo(() => {
		if (!searchQuery.trim()) {
			return tasksWithoutId;
		}
		const query = searchQuery.toLowerCase();
		return tasksWithoutId.filter(task =>
			task.title.toLowerCase().includes(query) ||
			task.filePath.toLowerCase().includes(query) ||
			task.tags.some(tag => tag.toLowerCase().includes(query))
		);
	}, [tasksWithoutId, searchQuery]);

	const handleImportTask = async (task: taskItem) => {
		try {
			const newId = await applyIdToTaskItem(plugin, task);
			if (newId !== undefined) {
				// Add to imported set
				setImportedTaskIds(prev => new Set(prev).add(task.id));
				// Trigger re-scan to update the map view, adding delay for task-note
				sleep(500).then(async () => {
					await plugin.realTimeScanner.processAllUpdatedFiles(task.filePath);

					// Emit event to refresh the board
					eventEmitter.emit('REFRESH_BOARD'); // TODO : Will this work with REFRESH_COLUMN only.
				})
			}
		} catch (error) {
			console.error('Error importing task:', error);
		}
	};

	// Reset imported tasks when panel is closed
	useEffect(() => {
		if (!isVisible) {
			setImportedTaskIds(new Set());
			setSearchQuery('');
		}
	}, [isVisible]);

	// Handle escape key to close panel
	useEffect(() => {
		if (!isVisible) return;

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose();
			}
		};

		document.addEventListener('keydown', handleEscape);
		return () => {
			document.removeEventListener('keydown', handleEscape);
		};
	}, [isVisible, onClose]);

	if (!isVisible) return null;

	return (
		<div className="tasksImporterPanelOverlay" onClick={onClose}>
			<div
				className={`tasksImporterPanel ${isVisible ? 'tasksImporterPanel--visible' : ''}`}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="tasksImporterPanelHeader">
					<h3 className="tasksImporterPanelTitle">{t('import-tasks-to-map')}</h3>
					<button
						className="tasksImporterPanelCloseBtn"
						onClick={onClose}
						aria-label={t('close')}
					>
						<X size={20} />
					</button>
				</div>

				<div className="tasksImporterPanelSearchContainer">
					<input
						type="text"
						className="tasksImporterPanelSearchInput"
						placeholder={t('search-tasks')}
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
					{searchQuery && (
						<button
							className="tasksImporterPanelSearchClear"
							onClick={() => setSearchQuery('')}
							aria-label={t('clear-search')}
						>
							<X size={14} />
						</button>
					)}
				</div>

				<div className="tasksImporterPanelContent">
					{filteredTasks.length === 0 ? (
						<div className="tasksImporterPanelEmptyState">
							<p>
								{searchQuery
									? t('no-tasks-match-search')
									: t('all-tasks-have-ids')}
							</p>
						</div>
					) : (
						<div className="tasksImporterPanelTaskList">
							{filteredTasks.map((task, index) => (
								<div
									key={task.id}
									className="tasksImporterPanelTaskItemWrapper"
									onClick={() => handleImportTask(task)}
								>
									<TaskItem
										key={task.id}
										plugin={plugin}
										task={task}
										activeBoardSettings={activeBoardSettings}
										dataAttributeIndex={0} // TODO : No need of this data in this case.
									/>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
