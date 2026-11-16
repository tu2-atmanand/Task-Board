// /src/components/MapView/TasksImporterPanel.tsx

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { Component } from 'obsidian';
import { t } from 'i18next';
import TaskBoard from '../../../../main.js';
import { Board, TaskBoardViewType } from '../../../interfaces/BoardConfigs.js';
import { viewTypeNames } from '../../../interfaces/Enums.js';
import { taskItem } from '../../../interfaces/TaskItem.js';
import { bugReporterManagerInsatance } from '../../../core/managers/BugReporter.js';
import { eventEmitter } from '../../../services/EventEmitter.js';
import { applyIdToTaskItem } from '../../../utils/TaskItemUtils.js';
import Parent from '../../components/task_card/Parent.js';
import { DEFAULT_TASK_CACHE_KEYS } from "../../../interfaces/Enums.js";


interface TasksImporterPanelProps {
	plugin: TaskBoard;
	allTasksArranged: taskItem[][];
	activeBoardSettings: Board;
	activeViewData: TaskBoardViewType;
	activeViewIndex: number;
	isVisible: boolean;
	onClose: () => void;
}

export const TasksImporterPanel: React.FC<TasksImporterPanelProps> = ({
	plugin,
	allTasksArranged,
	activeBoardSettings,
	activeViewData,
	activeViewIndex,
	isVisible,
	onClose
}) => {
	const [searchQuery, setSearchQuery] = useState('');
	const [importedTaskIds, setImportedTaskIds] = useState<Set<string>>(new Set());
	const tasksContentRef = useRef<HTMLDivElement>(null);

	const dummyComponent = new Component();

	// Lazy loading configs
	// Lazy loading configs
	const initialTaskCount = 20;
	const loadMoreCount = 10;
	const scrollThresholdPercent = 80;

	// State for managing visible tasks
	const [visibleTaskCount, setVisibleTaskCount] = useState(initialTaskCount);

	// Get all tasks without an ID (legacyId is empty)
	const tasksWithoutId = useMemo(() => {
		const flatTasks = allTasksArranged.flat();
		return flatTasks.filter(task => !task[DEFAULT_TASK_CACHE_KEYS.LegacyID] && !importedTaskIds.has(task[DEFAULT_TASK_CACHE_KEYS.ID]));
	}, [allTasksArranged, importedTaskIds]);

	// Filter tasks based on search query
	const filteredTasks = useMemo(() => {
		if (!searchQuery.trim()) {
			return tasksWithoutId;
		}
		const query = searchQuery.toLowerCase();
		return tasksWithoutId.filter(task =>
			task[DEFAULT_TASK_CACHE_KEYS.Title].toLowerCase().includes(query) ||
			task[DEFAULT_TASK_CACHE_KEYS.FilePath].toLowerCase().includes(query) ||
			(task[DEFAULT_TASK_CACHE_KEYS.Tags] ?? []).some(tag => tag.toLowerCase().includes(query))
		);
	}, [tasksWithoutId, searchQuery]);

	// Memoize visible tasks based on count
	const visibleTasks = useMemo(() => {
		if (!filteredTasks || filteredTasks.length < 1) return [];
		return filteredTasks.slice(0, visibleTaskCount);
	}, [filteredTasks, visibleTaskCount]);

	const handleImportTask = async (task: taskItem) => {
		try {
			const newId = await applyIdToTaskItem(plugin, task);
			if (newId !== undefined) {
				// Add to imported set
				setImportedTaskIds(prev => new Set(prev).add(task[DEFAULT_TASK_CACHE_KEYS.ID]));
				// Trigger re-scan to update the map view, adding delay for task-note
				window.setTimeout(() => {
					plugin.realTimeScanner.processAllUpdatedFiles(task[DEFAULT_TASK_CACHE_KEYS.FilePath]).then(() => {
						// Emit event to refresh the board and notify about the newly imported task
						eventEmitter.emit('TASK_IMPORTED_TO_MAP', newId);
						eventEmitter.emit('REFRESH_BOARD'); // TODO : Will this work with SOFT_REFRESH only.
					}).catch((error) => {
						bugReporterManagerInsatance.addToLogs(
							217,
							String(error),
							"TasksImporterPanel.ts/handleImportTask",
						);
					});

				}, 500);
			}
		} catch (error) {
			bugReporterManagerInsatance.addToLogs(
				128,
				String(error),
				"TasksImporterPanel.tsx/handleImportTask",
			);
		}
	};

	// Reset visible count when filtered tasks change (e.g., due to search)
	useEffect(() => {
		setVisibleTaskCount(initialTaskCount);
	}, [filteredTasks, initialTaskCount]);

	// Scroll event handler
	const handleScroll = useCallback(() => {
		const container = tasksContentRef.current;
		if (!container) return;

		const { scrollTop, scrollHeight, clientHeight } = container;
		const scrollPercentage = ((scrollTop + clientHeight) / scrollHeight) * 100;

		// Load more tasks when scroll threshold is reached and there are more tasks to load
		if (scrollPercentage >= scrollThresholdPercent && visibleTaskCount < filteredTasks.length) {
			setVisibleTaskCount((prevCount) => {
				const newCount = Math.min(prevCount + loadMoreCount, filteredTasks.length);
				return newCount;
			});
		}
	}, [scrollThresholdPercent, visibleTaskCount, filteredTasks.length, loadMoreCount]);

	// Attach scroll listener
	useEffect(() => {
		const container = tasksContentRef.current;
		if (!container) return;

		// Throttle scroll events for performance
		let throttleTimeout: number | null = null;
		const throttledScroll = () => {
			if (throttleTimeout) return;
			throttleTimeout = window.setTimeout(() => {
				handleScroll();
				throttleTimeout = null;
			}, 100);
		};

		container.addEventListener('scroll', throttledScroll);
		return () => {
			container.removeEventListener('scroll', throttledScroll);
			if (throttleTimeout) window.clearTimeout(throttleTimeout);
		};
	}, [handleScroll]);

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

		activeDocument.addEventListener('keydown', handleEscape);
		return () => {
			activeDocument.removeEventListener('keydown', handleEscape);
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

				<div className="tasksImporterPanelContent" ref={tasksContentRef}>
					{filteredTasks.length === 0 ? (
						<div className="tasksImporterPanelEmptyState">
							<p>
								{searchQuery
									? t('no-tasks-match-search')
									: t('all-tasks-have-ids')}
							</p>
						</div>
					) : (
						<>
							<div className="tasksImporterPanelTaskList">
								{visibleTasks.map((task, index) => (
									<div
										key={task[DEFAULT_TASK_CACHE_KEYS.ID]}
										className="tasksImporterPanelTaskItemWrapper"
										onClick={() => { void handleImportTask(task); }}
									>
										{/* TODO : Replace this with the cardImage */}
										<Parent
											key={task[DEFAULT_TASK_CACHE_KEYS.ID]}
											dataAttributeIndex={0} // TODO : No need of this data in this case.
											plugin={plugin}
											parentComponent={dummyComponent}
											task={task}
											activeViewIndex={activeViewIndex}
											activeViewType={viewTypeNames.map}
											activeBoardID={activeBoardSettings.id}
											propertiesVisibleInUI={activeViewData.propertiesVisibleInUI}
										/>
									</div>
								))}
							</div>
							{visibleTaskCount < filteredTasks.length && (
								<button
									className="tasksImporterPanelLoadMoreBtn"
									onClick={() => setVisibleTaskCount(prev => Math.min(prev + loadMoreCount, filteredTasks.length))}
								>
									<ChevronDown size={18} />
									{t('load-more')}
								</button>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
};
