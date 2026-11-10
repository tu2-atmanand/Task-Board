import React, { useMemo, useState } from "react";
import { ArrowDownUp, ListTodo } from "lucide-react";
import { Component, View } from "obsidian";
import TaskBoard from "../../../../main.js";
import type { Board, TaskBoardViewType } from "../../../interfaces/BoardConfigs.js";
import { DEFAULT_DATE_FORMAT } from "../../../interfaces/Constants.js";
import { taskCardStyleNames, viewTypeNames } from "../../../interfaces/Enums.js";
import type { taskItem, taskJsonMerged } from "../../../interfaces/TaskItem.js";
import TaskItem from "../../../components/task_card/EmojiStyle.js";
import BasesStyle from "../../../components/task_card/BasesStyle.js";
import { robustDateParser } from "../../../utils/DateTimeCalculations.js";

interface ListViewProps {
	plugin: TaskBoard;
	parentComponent: Component | View;
	currentBoardData: Board;
	currentView: TaskBoardViewType;
	currentViewIndex: number;
	tasks: taskJsonMerged;
}

type TaskFilter = "all" | "open" | "completed";
type TaskSort = "default" | "due" | "priority" | "title";

const INITIAL_TASK_COUNT = 50;
const TASKS_PER_BATCH = 25;

const ListView: React.FC<ListViewProps> = ({
	plugin,
	parentComponent,
	currentBoardData,
	currentView,
	currentViewIndex,
	tasks,
}) => {
	const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
	const [taskSort, setTaskSort] = useState<TaskSort>("default");
	const [visibleTaskCount, setVisibleTaskCount] = useState(INITIAL_TASK_COUNT);
	const taskCardComponent = plugin.settings.data.taskCardStyle === taskCardStyleNames.EMOJI
		? TaskItem
		: BasesStyle;
	const dateFormat = plugin.settings.data.dateFormat || DEFAULT_DATE_FORMAT;

	const sortedTasks = useMemo(() => {
		const tasksToShow = taskFilter === "open"
			? tasks.Pending
			: taskFilter === "completed"
				? tasks.Completed
				: [...tasks.Pending, ...tasks.Completed];

		if (taskSort === "default") return tasksToShow;

		return tasksToShow
			.map((task, index) => ({ task, index }))
			.sort(({ task: first, index: firstIndex }, { task: second, index: secondIndex }) => {
				let comparison = 0;
				if (taskSort === "title") {
					comparison = first.title.localeCompare(second.title, undefined, { numeric: true, sensitivity: "base" });
				} else if (taskSort === "priority") {
					comparison = first.priority - second.priority;
				} else {
					const firstDate = first.due ? robustDateParser(first.due, dateFormat)?.getTime() : undefined;
					const secondDate = second.due ? robustDateParser(second.due, dateFormat)?.getTime() : undefined;
					if (firstDate === undefined && secondDate !== undefined) return 1;
					if (secondDate === undefined && firstDate !== undefined) return -1;
					comparison = (firstDate ?? 0) - (secondDate ?? 0);
				}
				return comparison || firstIndex - secondIndex;
			})
			.map(({ task }) => task);
	}, [dateFormat, taskFilter, taskSort, tasks]);

	const visibleTasks = sortedTasks.slice(0, visibleTaskCount);
	const filters: { value: TaskFilter; label: string; count: number }[] = [
		{ value: "all", label: "All tasks", count: tasks.Pending.length + tasks.Completed.length },
		{ value: "open", label: "Open", count: tasks.Pending.length },
		{ value: "completed", label: "Completed", count: tasks.Completed.length },
	];

	const handleFilterChange = (filter: TaskFilter) => {
		setTaskFilter(filter);
		setVisibleTaskCount(INITIAL_TASK_COUNT);
	};

	const handleSortChange = (sort: TaskSort) => {
		setTaskSort(sort);
		setVisibleTaskCount(INITIAL_TASK_COUNT);
	};

	const renderTask = (task: taskItem, index: number) => React.createElement(taskCardComponent, {
		key: task.id,
		dataAttributeIndex: index,
		plugin,
		task,
		parentComponent,
		activeBoardID: currentBoardData.id,
		activeViewIndex: currentViewIndex,
		activeViewType: viewTypeNames.list,
	});

	return (
		<div className="taskBoardListView">
			<header className="taskBoardListHeader">
				<div className="taskBoardListHeading">
					<ListTodo size={20} aria-hidden="true" />
					<div>
						<h2>{currentView.viewName || "Task list"}</h2>
						<span>{tasks.Pending.length} open · {tasks.Completed.length} completed</span>
					</div>
				</div>
				<div className="taskBoardListControls">
					<div className="taskBoardListFilters" role="group" aria-label="Filter tasks">
						{filters.map((filter) => (
							<button
								key={filter.value}
								type="button"
								className={taskFilter === filter.value ? "is-active" : ""}
								aria-pressed={taskFilter === filter.value}
								onClick={() => handleFilterChange(filter.value)}
							>
								{filter.label}<span>{filter.count}</span>
							</button>
						))}
					</div>
					<label className="taskBoardListSort">
						<ArrowDownUp size={15} aria-hidden="true" />
						<span className="sr-only">Sort tasks</span>
						<select
							value={taskSort}
							aria-label="Sort tasks"
							onChange={(event) => handleSortChange(event.target.value as TaskSort)}
						>
							<option value="default">Board order</option>
							<option value="due">Due date</option>
							<option value="priority">Priority</option>
							<option value="title">Title</option>
						</select>
					</label>
				</div>
			</header>

			<div className="taskBoardListContent">
				{visibleTasks.length > 0 ? (
					<section className="taskBoardListTasks" aria-label="Tasks">
						{visibleTasks.map(renderTask)}
					</section>
				) : (
					<div className="taskBoardListEmpty">
						<ListTodo size={28} aria-hidden="true" />
						<strong>{taskFilter === "completed" ? "No completed tasks" : "No tasks to show"}</strong>
						<span>{taskFilter === "open" ? "All caught up — there are no open tasks." : "Try another filter or add a task to this board."}</span>
					</div>
				)}
				{visibleTaskCount < sortedTasks.length && (
					<button
						type="button"
						className="taskBoardListLoadMore"
						onClick={() => setVisibleTaskCount((count) => Math.min(count + TASKS_PER_BATCH, sortedTasks.length))}
					>
						Show more tasks ({visibleTasks.length} of {sortedTasks.length})
					</button>
				)}
			</div>
		</div>
	);
};

export default ListView;
