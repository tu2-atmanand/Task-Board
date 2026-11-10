import React, { useEffect, useMemo, useRef, useState } from "react";
import {
	addDays,
	addMonths,
	addWeeks,
	format,
	isSameDay,
	isSameMonth,
	startOfMonth,
	startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Notice } from "obsidian";
import TaskBoard from "../../../../main.js";
import { taskItemEmpty } from "../../../interfaces/Mapping.js";
import type { taskItem, taskJsonMerged } from "../../../interfaces/TaskItem.js";
import { bugReporterManagerInsatance } from "../../../core/managers/BugReporter.js";
import { eventEmitter } from "../../../services/EventEmitter.js";
import { openAddNewTaskModal } from "../../modals/OpenModals.js";
import {
	formatDateStringAsPerSettings,
	robustDateParser,
} from "../../../utils/DateTimeCalculations.js";
import { sanitizeStartDate, sanitizeTime } from "../../../utils/task_line/TaskContentFormatter.js";
import { updateTaskInFile } from "../../../utils/task_line/TaskLineUtils.js";
import { isTaskNotePresentInTags, updateFrontmatterInMarkdownFile } from "../../../utils/task_note/TaskNoteUtils.js";

type CalendarMode = "day" | "week" | "month";

interface CalendarViewProps {
	plugin: TaskBoard;
	tasks: taskJsonMerged;
	dateFormat: string;
}

interface CalendarTask {
	task: taskItem;
	dateKey: string;
	startMinutes: number | null;
	endMinutes: number | null;
}

type CalendarInteractionKind = "select" | "move" | "resize";

interface CalendarInteraction {
	kind: CalendarInteractionKind;
	pointerId: number;
	startX: number;
	startY: number;
	dayIndex: number;
	anchorSlot: number;
	startSlot: number;
	endSlot: number;
	active: boolean;
	task?: taskItem;
}

interface CalendarInteractionPreview {
	dayIndex: number;
	startSlot: number;
	endSlot: number;
}

const HALF_HOUR_MINUTES = 30;
const INITIAL_ROW_HEIGHT = 48;
const MIN_ROW_HEIGHT = 24;
const MAX_ROW_HEIGHT = 120;
const TIME_SLOTS = 24 * 2;

const parseClockTime = (value: string): number | null => {
	const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
	if (!match) return null;

	let hours = Number(match[1]);
	const minutes = Number(match[2] ?? "0");
	const meridiem = match[3]?.toLowerCase();
	if (minutes > 59) return null;

	if (meridiem) {
		if (hours < 1 || hours > 12) return null;
		hours = (hours % 12) + (meridiem === "pm" ? 12 : 0);
	} else if (hours === 24 && minutes === 0) {
		return 24 * 60;
	} else if (hours > 23) {
		return null;
	}

	return hours * 60 + minutes;
};

const getTaskTimeRange = (value: string): { start: number; end: number } | null => {
	if (!value.trim()) return null;
	const range = value.split(/\s*[-–]\s*/);
	const start = parseClockTime(range[0] ?? "");
	if (start === null) return null;

	const parsedEnd = range.length > 1 ? parseClockTime(range[1] ?? "") : null;
	const end = parsedEnd !== null && parsedEnd > start ? parsedEnd : start + HALF_HOUR_MINUTES;
	return { start, end: Math.min(end, 24 * 60) };
};

const getTaskDisplayTitle = (task: taskItem): string =>
	task.title
		.replace(/^\s*[-*]\s*\[[^\]]\]\s*/, "")
		.trim();

const formatClockTime = (minutes: number): string =>
	`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

const CalendarView: React.FC<CalendarViewProps> = ({ plugin, tasks, dateFormat }) => {
	const [mode, setMode] = useState<CalendarMode>("week");
	const [activeDate, setActiveDate] = useState(() => new Date());
	const [rowHeight, setRowHeight] = useState(INITIAL_ROW_HEIGHT);
	const scrollRef = useRef<HTMLDivElement>(null);
	const dayColumnsRef = useRef<HTMLDivElement>(null);
	const interactionRef = useRef<CalendarInteraction | null>(null);
	const [interactionPreview, setInteractionPreview] = useState<CalendarInteractionPreview | null>(null);

	const calendarTasks = useMemo(() => {
		const allTasks = [...tasks.Pending, ...tasks.Completed];
		return allTasks.reduce<CalendarTask[]>((scheduledTasks, task) => {
			const dateValue = task.startDate || task.scheduledDate || task.due;
			const parsedDate = dateValue ? robustDateParser(dateValue, dateFormat) : null;
			if (!parsedDate) return scheduledTasks;

			const timeRange = getTaskTimeRange(task.time || "");
			scheduledTasks.push({
				task,
				dateKey: format(parsedDate, "yyyy-MM-dd"),
				startMinutes: timeRange?.start ?? null,
				endMinutes: timeRange?.end ?? null,
			});
			return scheduledTasks;
		}, []);
	}, [tasks, dateFormat]);

	const tasksByDate = useMemo(() => {
		const grouped = new Map<string, CalendarTask[]>();
		calendarTasks.forEach((calendarTask) => {
			const dayTasks = grouped.get(calendarTask.dateKey) ?? [];
			dayTasks.push(calendarTask);
			grouped.set(calendarTask.dateKey, dayTasks);
		});
		return grouped;
	}, [calendarTasks]);

	const navigate = (direction: -1 | 1) => {
		setActiveDate((date) => {
			if (mode === "day") return addDays(date, direction);
			if (mode === "week") return addWeeks(date, direction);
			return addMonths(date, direction);
		});
	};

	const headerDate = mode === "day"
		? format(activeDate, "EEEE, MMMM d, yyyy")
		: mode === "week"
			? `${format(startOfWeek(activeDate, { weekStartsOn: 0 }), "MMM d")} – ${format(addDays(startOfWeek(activeDate, { weekStartsOn: 0 }), 6), "MMM d, yyyy")}`
			: format(activeDate, "MMMM yyyy");

	const handleCalendarWheel = (event: React.WheelEvent<HTMLDivElement>) => {
		if (!event.ctrlKey || mode === "month") return;
		event.preventDefault();
		setRowHeight((height) => Math.min(
			MAX_ROW_HEIGHT,
			Math.max(MIN_ROW_HEIGHT, height + (event.deltaY < 0 ? 4 : -4)),
		));
	};

	const visibleDays = mode === "day"
		? [activeDate]
		: Array.from({ length: 7 }, (_, index) =>
			addDays(startOfWeek(activeDate, { weekStartsOn: 0 }), index),
		);

	const monthDays = Array.from({ length: 42 }, (_, index) =>
		addDays(startOfWeek(startOfMonth(activeDate), { weekStartsOn: 0 }), index),
	);

	const getGridPosition = (clientX: number, clientY: number) => {
		const grid = dayColumnsRef.current;
		if (!grid) return null;
		const bounds = grid.getBoundingClientRect();
		if (clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) {
			return null;
		}

		const dayIndex = Math.min(
			visibleDays.length - 1,
			Math.floor(((clientX - bounds.left) / bounds.width) * visibleDays.length),
		);
		const startSlot = Math.min(
			TIME_SLOTS - 1,
			Math.max(0, Math.floor((clientY - bounds.top) / rowHeight)),
		);
		return { dayIndex, startSlot };
	};

	const startInteraction = (
		event: React.PointerEvent,
		interaction: Omit<CalendarInteraction, "pointerId" | "startX" | "startY" | "anchorSlot" | "active">,
	) => {
		if (event.button !== 0 || mode === "month") return;
		event.preventDefault();
		event.stopPropagation();
		interactionRef.current = {
			...interaction,
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			anchorSlot: interaction.startSlot,
			active: interaction.kind === "select",
		};
		if (interaction.kind === "select") {
			setInteractionPreview({
				dayIndex: interaction.dayIndex,
				startSlot: interaction.startSlot,
				endSlot: interaction.startSlot + 1,
			});
		}
	};

	const persistCalendarTaskTime = async (
		task: taskItem,
		day: Date,
		startMinutes: number,
		endMinutes: number,
	) => {
		const dateValue = formatDateStringAsPerSettings(format(day, "yyyy-MM-dd"), dateFormat);
		const timeValue = `${formatClockTime(startMinutes)} - ${formatClockTime(endMinutes)}`;
		const updatedTask = { ...task, startDate: dateValue, time: timeValue };

		eventEmitter.emit("UPDATE_TASK", { taskID: task.id, state: true });
		if (isTaskNotePresentInTags(plugin.settings.data.taskNoteIdentifierTag, task.tags)) {
			await updateFrontmatterInMarkdownFile(plugin, updatedTask);
			try {
				await plugin.realTimeScanner.processAllUpdatedFiles(task.filePath, task.id);
			} catch (error) {
				bugReporterManagerInsatance.addToLogs(
					217,
					String(error),
					"CalendarView.tsx/persistCalendarTaskTime",
				);
				new Notice("The calendar change was saved, but the task could not be rescanned.");
			}
			return;
		}

		updatedTask.title = sanitizeStartDate(plugin.settings.data, updatedTask.title, dateValue);
		updatedTask.title = sanitizeTime(plugin.settings.data, updatedTask.title, timeValue);
		await updateTaskInFile(plugin, updatedTask, task);
		try {
			await plugin.realTimeScanner.processAllUpdatedFiles(task.filePath, task.id);
		} catch (error) {
			bugReporterManagerInsatance.addToLogs(
				217,
				String(error),
				"CalendarView.tsx/persistCalendarTaskTime",
			);
			new Notice("The calendar change was saved, but the task could not be rescanned.");
		}
	};

	useEffect(() => {
		const handlePointerMove = (event: PointerEvent) => {
			const interaction = interactionRef.current;
			if (!interaction || interaction.pointerId !== event.pointerId) return;
			const position = getGridPosition(event.clientX, event.clientY);

			if (interaction.kind === "resize") {
				if (!position) return;
				interaction.active ||= Math.abs(event.clientY - interaction.startY) > 3;
				const endSlot = Math.max(interaction.startSlot + 1, position.startSlot + 1);
				interaction.endSlot = Math.min(TIME_SLOTS, endSlot);
				setInteractionPreview({
					dayIndex: interaction.dayIndex,
					startSlot: interaction.startSlot,
					endSlot: interaction.endSlot,
				});
				return;
			}

			if (interaction.kind === "move") {
				interaction.active ||= Math.hypot(
					event.clientX - interaction.startX,
					event.clientY - interaction.startY,
				) > 5;
				if (!interaction.active || !position) return;
				interaction.dayIndex = position.dayIndex;
				interaction.startSlot = position.startSlot;
				interaction.endSlot = position.startSlot + 1;
				setInteractionPreview({
					dayIndex: interaction.dayIndex,
					startSlot: interaction.startSlot,
					endSlot: interaction.endSlot,
				});
				return;
			}

			if (!position) return;
			interaction.active ||= Math.hypot(
				event.clientX - interaction.startX,
				event.clientY - interaction.startY,
			) > 3;
			interaction.dayIndex = position.dayIndex;
			interaction.startSlot = Math.min(interaction.anchorSlot, position.startSlot);
			interaction.endSlot = Math.min(
				TIME_SLOTS,
				Math.max(interaction.anchorSlot, position.startSlot) + 1,
			);
			setInteractionPreview({
				dayIndex: interaction.dayIndex,
				startSlot: interaction.startSlot,
				endSlot: interaction.endSlot,
			});
		};

		const handlePointerUp = (event: PointerEvent) => {
			const interaction = interactionRef.current;
			if (!interaction || interaction.pointerId !== event.pointerId) return;
			const position = getGridPosition(event.clientX, event.clientY);
			interactionRef.current = null;
			setInteractionPreview(null);

			if (interaction.kind === "select") {
				if (!interaction.active || !position) return;
				const selectedDay = visibleDays[interaction.dayIndex];
				const startMinutes = interaction.startSlot * HALF_HOUR_MINUTES;
				const endMinutes = Math.max(interaction.startSlot + 1, interaction.endSlot) * HALF_HOUR_MINUTES;
				const initialTask: taskItem = {
					...taskItemEmpty,
					body: [],
					tags: [],
					frontmatterTags: [],
					startDate: formatDateStringAsPerSettings(format(selectedDay, "yyyy-MM-dd"), dateFormat),
					time: `${formatClockTime(startMinutes)} - ${formatClockTime(endMinutes)}`,
				};
				openAddNewTaskModal(plugin, undefined, initialTask);
				return;
			}

			if (!interaction.task || !position || !interaction.active) return;
			const selectedDay = visibleDays[interaction.kind === "resize" ? interaction.dayIndex : position.dayIndex];
			const startSlot = interaction.kind === "resize"
				? interaction.startSlot
				: position.startSlot;
			const endSlot = interaction.kind === "resize"
				? interaction.endSlot
				: startSlot + 1;
			void persistCalendarTaskTime(
				interaction.task,
				selectedDay,
				startSlot * HALF_HOUR_MINUTES,
				Math.min(TIME_SLOTS, endSlot) * HALF_HOUR_MINUTES,
			).catch((error: unknown) => {
				bugReporterManagerInsatance.addToLogs(
					217,
					String(error),
					"CalendarView.tsx/handlePointerUp",
				);
				new Notice("Unable to save the calendar task change.");
			});
		};

		const handlePointerCancel = (event: PointerEvent) => {
			if (interactionRef.current?.pointerId !== event.pointerId) return;
			interactionRef.current = null;
			setInteractionPreview(null);
		};

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", handlePointerUp);
		window.addEventListener("pointercancel", handlePointerCancel);
		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
			window.removeEventListener("pointercancel", handlePointerCancel);
		};
	}, [visibleDays, rowHeight, mode, plugin, dateFormat]);

	return (
		<div className="taskBoardCalendar">
			<header className="taskBoardCalendarHeader">
				<div className="taskBoardCalendarHeading">
					<CalendarDays size={20} aria-hidden="true" />
					<div>
						<h2>{headerDate}</h2>
						<span>{mode[0].toUpperCase() + mode.slice(1)} view</span>
					</div>
				</div>
				<div className="taskBoardCalendarControls">
					<button
						type="button"
						className="taskBoardCalendarIconButton"
						onClick={() => navigate(-1)}
						aria-label={`Previous ${mode}`}
						title={`Previous ${mode}`}
					>
						<ChevronLeft size={18} />
					</button>
					<button
						type="button"
						className="taskBoardCalendarTodayButton"
						onClick={() => setActiveDate(new Date())}
					>
						Today
					</button>
					<button
						type="button"
						className="taskBoardCalendarIconButton"
						onClick={() => navigate(1)}
						aria-label={`Next ${mode}`}
						title={`Next ${mode}`}
					>
						<ChevronRight size={18} />
					</button>
					<div className="taskBoardCalendarModeSwitch" role="group" aria-label="Calendar view mode">
						{(["day", "week", "month"] as const).map((calendarMode) => (
							<button
								key={calendarMode}
								type="button"
								className={mode === calendarMode ? "is-active" : ""}
								onClick={() => setMode(calendarMode)}
								aria-pressed={mode === calendarMode}
							>
								{calendarMode[0].toUpperCase() + calendarMode.slice(1)}
							</button>
						))}
					</div>
				</div>
			</header>

			{mode === "month" ? (
				<div className="taskBoardCalendarMonth" role="grid" aria-label={headerDate}>
					<div className="taskBoardCalendarWeekdays" role="row">
						{Array.from({ length: 7 }, (_, index) => (
							<div key={index} role="columnheader">
								{format(addDays(startOfWeek(activeDate, { weekStartsOn: 0 }), index), "EEE")}
							</div>
						))}
					</div>
					<div className="taskBoardCalendarMonthGrid">
						{monthDays.map((day) => {
							const dayTasks = tasksByDate.get(format(day, "yyyy-MM-dd")) ?? [];
							return (
								<div
									key={format(day, "yyyy-MM-dd")}
									className={`taskBoardCalendarMonthDay${isSameMonth(day, activeDate) ? "" : " is-outside-month"}${isSameDay(day, new Date()) ? " is-today" : ""}`}
									role="gridcell"
									aria-label={format(day, "EEEE, MMMM d, yyyy")}
								>
									<div className="taskBoardCalendarMonthDayNumber">{format(day, "d")}</div>
									<div className="taskBoardCalendarMonthTasks">
										{dayTasks.slice(0, 3).map((calendarTask, index) => (
											<div
												key={`${calendarTask.task.id}-${index}`}
												className="taskBoardCalendarMonthTask"
												title={calendarTask.task.title}
											>
												{getTaskDisplayTitle(calendarTask.task)}
											</div>
										))}
										{dayTasks.length > 3 && (
											<div className="taskBoardCalendarMoreTasks">+{dayTasks.length - 3} more</div>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			) : (
				<div
					className="taskBoardCalendarTimeScroll"
					ref={scrollRef}
					onWheel={handleCalendarWheel}
					title="Hold Ctrl and scroll to zoom the time grid"
				>
					<div className="taskBoardCalendarTimeView" style={{ minWidth: mode === "week" ? 7 * 170 + 56 : 420 }}>
						<div
							className="taskBoardCalendarDayHeaders"
							style={{ gridTemplateColumns: `56px repeat(${visibleDays.length}, minmax(0, 1fr))` }}
						>
							<div className="taskBoardCalendarTimeGutter" />
							{visibleDays.map((day) => (
								<div
									key={format(day, "yyyy-MM-dd")}
									className={`taskBoardCalendarDayHeader${isSameDay(day, new Date()) ? " is-today" : ""}`}
								>
									<span>{format(day, "EEE")}</span>
									<strong>{format(day, "d")}</strong>
								</div>
							))}
						</div>
						<div
							className="taskBoardCalendarAllDayRow"
							style={{ gridTemplateColumns: `56px repeat(${visibleDays.length}, minmax(0, 1fr))` }}
						>
							<div className="taskBoardCalendarAllDayLabel">All day</div>
							{visibleDays.map((day) => {
								const dateTasks = tasksByDate.get(format(day, "yyyy-MM-dd")) ?? [];
								const allDayTasks = dateTasks.filter((calendarTask) => calendarTask.startMinutes === null);
								return (
									<div className="taskBoardCalendarAllDayCell" key={format(day, "yyyy-MM-dd")}>
										{allDayTasks.map((calendarTask, index) => (
											<div
												key={`${calendarTask.task.id}-${index}`}
												className="taskBoardCalendarAllDayTask"
												title={calendarTask.task.title}
												onPointerDown={(event) => startInteraction(event, {
													kind: "move",
													dayIndex: visibleDays.findIndex((visibleDay) =>
														format(visibleDay, "yyyy-MM-dd") === calendarTask.dateKey,
													),
													startSlot: 0,
													endSlot: 1,
													task: calendarTask.task,
												})}
											>
												{getTaskDisplayTitle(calendarTask.task)}
											</div>
										))}
									</div>
								);
							})}
						</div>
						<div className="taskBoardCalendarTimeGrid">
							<div className="taskBoardCalendarTimeLabels">
								{Array.from({ length: TIME_SLOTS }, (_, slot) => (
									<div
										key={slot}
										className="taskBoardCalendarTimeLabel"
										style={{ height: rowHeight }}
									>
										{slot % 2 === 0 ? `${String(slot / 2).padStart(2, "0")}:00` : ""}
									</div>
								))}
							</div>
							<div
								className="taskBoardCalendarDayColumns"
								ref={dayColumnsRef}
								style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(0, 1fr))` }}
								onPointerDown={(event) => {
									if ((event.target as HTMLElement).closest(".taskBoardCalendarTimedTask")) return;
									const position = getGridPosition(event.clientX, event.clientY);
									if (!position) return;
									startInteraction(event, {
										kind: "select",
										dayIndex: position.dayIndex,
										startSlot: position.startSlot,
										endSlot: position.startSlot + 1,
									});
								}}
							>
								{visibleDays.map((day) => {
									const dateTasks = tasksByDate.get(format(day, "yyyy-MM-dd")) ?? [];
									const timedTasks = dateTasks.filter(
										(calendarTask) => calendarTask.startMinutes !== null,
									);
									return (
										<div className="taskBoardCalendarDayColumn" key={format(day, "yyyy-MM-dd")}>
											<div
												className="taskBoardCalendarHourLines"
												style={{
													height: rowHeight * TIME_SLOTS,
													backgroundSize: `100% ${rowHeight}px`,
												}}
											/>
											{timedTasks.map((calendarTask, index) => {
												const start = calendarTask.startMinutes ?? 0;
												const end = calendarTask.endMinutes ?? start + HALF_HOUR_MINUTES;
												return (
													<div
														key={`${calendarTask.task.id}-${index}`}
														className="taskBoardCalendarTimedTask"
														style={{
															top: (start / HALF_HOUR_MINUTES) * rowHeight,
															height: Math.max(rowHeight, ((end - start) / HALF_HOUR_MINUTES) * rowHeight),
														}}
														title={`${calendarTask.task.title}${calendarTask.task.time ? ` · ${calendarTask.task.time}` : ""}`}
													>
														<strong>{getTaskDisplayTitle(calendarTask.task)}</strong>
														<span>{calendarTask.task.time}</span>
														<span
															className="taskBoardCalendarResizeHandle"
															role="presentation"
															onPointerDown={(event) => {
																const dayIndex = visibleDays.findIndex(
																	(visibleDay) => format(visibleDay, "yyyy-MM-dd") === format(day, "yyyy-MM-dd"),
																);
																startInteraction(event, {
																	kind: "resize",
																	dayIndex,
																	startSlot: Math.floor(start / HALF_HOUR_MINUTES),
																	endSlot: Math.ceil(end / HALF_HOUR_MINUTES),
																	task: calendarTask.task,
																});
															}}
														/>
													</div>
												);
											})}
											{interactionPreview && interactionPreview.dayIndex === visibleDays.findIndex(
												(visibleDay) => format(visibleDay, "yyyy-MM-dd") === format(day, "yyyy-MM-dd"),
											) && (
												<div
													className="taskBoardCalendarInteractionPreview"
													style={{
														top: interactionPreview.startSlot * rowHeight,
														height: Math.max(1, interactionPreview.endSlot - interactionPreview.startSlot) * rowHeight,
													}}
												/>
											)}
										</div>
									);
								})}
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default CalendarView;
