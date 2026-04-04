import { Component, setIcon, App } from "obsidian";
import TaskBoard from "main";
import { t } from "src/utils/lang/helper";
import { DEFAULT_DATE_FORMAT } from "src/interfaces/Constants";
import {
	format,
	addDays,
	addWeeks,
	addMonths,
	addYears,
	startOfMonth,
	endOfMonth,
	startOfWeek,
	endOfWeek,
	isSameMonth,
	eachDayOfInterval,
	isToday as isTodayDateFns,
} from "date-fns";
import { robustDateParser } from "src/utils/DateTimeCalculations";

export interface DatePickerState {
	selectedDate: string | null;
	dateMark: string;
}

export class DatePickerComponent extends Component {
	private hostEl: HTMLElement;
	private plugin: TaskBoard;
	private app: App;
	private dateName: string | undefined = "";
	private state: DatePickerState;
	private onDateChange?: (date: string) => void;
	private currentViewDate: Date;

	constructor(
		hostEl: HTMLElement,
		plugin: TaskBoard,
		dateName: string | undefined,
		initialDate?: string,
		dateMark: string = "📅",
	) {
		super();
		this.hostEl = hostEl;
		this.plugin = plugin;
		this.app = plugin.app;
		this.dateName = dateName;
		this.state = {
			selectedDate: initialDate || null,
			dateMark: dateMark,
		};
		// Parse initial date or use current date
		this.currentViewDate = initialDate
			? robustDateParser(
					initialDate,
					plugin.settings.data.globalSettings.dateFormat ||
						DEFAULT_DATE_FORMAT,
				) || new Date()
			: new Date();
	}

	onload(): void {
		this.render();
	}

	onunload(): void {
		this.hostEl.empty();
	}

	setOnDateChange(callback: (date: string) => void): void {
		this.onDateChange = callback;
	}

	getSelectedDate(): string | null {
		return this.state.selectedDate;
	}

	setSelectedDate(date: string | null): void {
		this.state.selectedDate = date;
		this.updateSelectedDateDisplay();
		// Only pass the date string, let the caller handle formatting
		if (this.onDateChange) {
			if (date) this.onDateChange(date);
			else this.onDateChange("");
		}
	}

	private render(): void {
		this.hostEl.empty();
		this.hostEl.addClass("date-picker-root-container");

		const datePickerContainer = this.hostEl.createDiv({
			cls: "date-picker-container",
		});

		// const heading = datePickerContainer.createEl("h2", {
		// 	cls: "date-picker-heading",
		// 	text: "Change " + this.dateName + " Date",
		// });

		const mainPanel = datePickerContainer.createDiv({
			cls: "date-picker-main-panel",
		});

		// Create two-column layout
		const leftPanel = mainPanel.createDiv({
			cls: "date-picker-left-panel",
		});

		const rightPanel = mainPanel.createDiv({
			cls: "date-picker-right-panel",
		});

		this.renderQuickOptions(leftPanel);
		this.renderCalendar(rightPanel);
	}

	private renderQuickOptions(container: HTMLElement): void {
		const quickOptionsContainer = container.createDiv({
			cls: "quick-options-container",
		});

		// Add quick date options
		const quickOptions = [
			{ amount: 0, unit: "days", label: t("today") },
			{ amount: 1, unit: "days", label: t("tomorrow") },
			{ amount: 2, unit: "days", label: t("in-2-days") },
			{ amount: 3, unit: "days", label: t("in-3-days") },
			// { amount: 5, unit: "days", label: t("In 5 days") },
			{ amount: 1, unit: "weeks", label: t("in-1-week") },
			// { amount: 10, unit: "days", label: t("In 10 days") },
			{ amount: 2, unit: "weeks", label: t("in-2-weeks") },
			{ amount: 1, unit: "months", label: t("in-1-month") },
			{ amount: 2, unit: "months", label: t("in-2-months") },
			// { amount: 3, unit: "months", label: t("In 3 months") },
			{ amount: 6, unit: "months", label: t("in-6-months") },
			{ amount: 1, unit: "years", label: t("in-1-year") },
		];

		quickOptions.forEach((option) => {
			const optionEl = quickOptionsContainer.createDiv({
				cls: "quick-option-item",
			});

			optionEl.createSpan({
				text: option.label,
				cls: "quick-option-label",
			});

			let date = new Date();
			if (option.unit === "days") {
				date = addDays(date, option.amount);
			} else if (option.unit === "weeks") {
				date = addWeeks(date, option.amount);
			} else if (option.unit === "months") {
				date = addMonths(date, option.amount);
			} else if (option.unit === "years") {
				date = addYears(date, option.amount);
			}

			const usersDateFormat =
				this.plugin.settings.data.globalSettings.dateFormat ||
				DEFAULT_DATE_FORMAT;
			const formattedDate = format(date, usersDateFormat);

			optionEl.createSpan({
				text: formattedDate,
				cls: "quick-option-date",
			});

			this.registerDomEvent(optionEl, "click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.setSelectedDate(formattedDate);
			});

			// Highlight if this is the selected date
			if (this.state.selectedDate === formattedDate) {
				optionEl.addClass("selected");
			}
		});

		// Add clear option
		const clearOption = container.createDiv({
			cls: "quick-option-item clear-option",
		});

		clearOption.createSpan({
			text: t("clear-date"),
			cls: "quick-option-label",
		});

		this.registerDomEvent(clearOption, "click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.setSelectedDate(null);
		});
	}

	private renderCalendar(container: HTMLElement): void {
		const calendarContainer = container.createDiv({
			cls: "calendar-container",
		});

		this.renderCalendarHeader(calendarContainer, this.currentViewDate);
		this.renderCalendarGrid(calendarContainer, this.currentViewDate);
	}

	private renderCalendarHeader(
		container: HTMLElement,
		currentDate: Date,
	): void {
		const header = container.createDiv({
			cls: "calendar-header",
		});

		// Previous month button
		const prevBtn = header.createDiv({
			cls: "calendar-nav-btn",
		});
		setIcon(prevBtn, "chevron-left");
		this.registerDomEvent(prevBtn, "click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.navigateMonth(-1);
		});

		// Month/Year display
		const monthYear = header.createDiv({
			cls: "calendar-month-year",
			text: format(currentDate, "MMMM yyyy"),
		});

		// Next month button
		const nextBtn = header.createDiv({
			cls: "calendar-nav-btn",
		});
		setIcon(nextBtn, "chevron-right");
		this.registerDomEvent(nextBtn, "click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.navigateMonth(1);
		});
	}

	private renderCalendarGrid(
		container: HTMLElement,
		currentDate: Date,
	): void {
		const grid = container.createDiv({
			cls: "calendar-grid",
		});

		// Day headers
		const dayHeaders = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
		dayHeaders.forEach((day) => {
			grid.createDiv({
				cls: "calendar-day-header",
				text: day,
			});
		});

		// Get first day of month and number of days
		const firstDay = startOfMonth(currentDate);
		const lastDay = endOfMonth(currentDate);
		const startDate = startOfWeek(firstDay);
		const endDate = endOfWeek(lastDay);

		// Generate calendar days
		const days = eachDayOfInterval({ start: startDate, end: endDate });
		days.forEach((day) => {
			const dayEl = grid.createDiv({
				cls: "calendar-day",
				text: format(day, "d"),
			});

			const usersDateFormat =
				this.plugin.settings.data.globalSettings.dateFormat ||
				DEFAULT_DATE_FORMAT;
			const dateStr = format(day, usersDateFormat);

			// Store the full date string for easy comparison later
			dayEl.setAttribute("data-date", dateStr);

			// Add classes for styling
			if (!isSameMonth(day, firstDay)) {
				dayEl.addClass("other-month");
			}

			if (isTodayDateFns(day)) {
				dayEl.addClass("today");
			}

			if (this.state.selectedDate === dateStr) {
				dayEl.addClass("selected");
			}

			// Add click handler
			this.registerDomEvent(dayEl, "click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.setSelectedDate(dateStr);
			});
		});
	}

	private navigateMonth(direction: number): void {
		this.currentViewDate = addMonths(this.currentViewDate, direction);
		this.render();
	}

	private updateSelectedDateDisplay(): void {
		// Update the visual state of selected items
		this.hostEl.querySelectorAll(".selected").forEach((el) => {
			el.removeClass("selected");
		});

		if (this.state.selectedDate) {
			// Highlight selected quick option
			this.hostEl.querySelectorAll(".quick-option-item").forEach((el) => {
				const dateSpan = el.querySelector(".quick-option-date");
				if (
					dateSpan &&
					dateSpan.textContent === this.state.selectedDate
				) {
					el.addClass("selected");
				}
			});

			// Highlight selected calendar day
			this.hostEl.querySelectorAll(".calendar-day").forEach((el) => {
				const storedDate = (el as HTMLElement).getAttribute(
					"data-date",
				);
				if (storedDate && this.state.selectedDate === storedDate) {
					el.addClass("selected");
				}
			});
		}
	}
}
