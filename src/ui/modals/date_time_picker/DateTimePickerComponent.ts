import { t } from "i18next";
import { App } from "obsidian";
import TaskBoard from "../../../../main.js";
import { DatePickerComponent } from "../date_picker/DatePickerComponent.js";
import {
	TimePickerModal,
	formatTimeForDisplay,
	is12HourTimeFormat,
	normalizeTimeValue,
} from "../time_picker/index.js";

export class DateTimePickerComponent {
	private hostEl: HTMLElement;
	private plugin: TaskBoard;
	private app: App;
	private dateTimeName: string | undefined;
	private datePickerComponent!: DatePickerComponent;
	private initialValue?: string;

	private selectedDate: string | null = null;
	private selectedTime: string | null = null;
	private use24HourFormat: boolean;
	private timeTriggerEl?: HTMLElement;
	private timeDisplayEl?: HTMLElement;

	private onApply?: (dateTime: string) => void;
	private onCancel?: () => void;

	constructor(
		hostEl: HTMLElement,
		plugin: TaskBoard,
		dateTimeName: string | undefined,
		initialValue?: string,
	) {
		this.hostEl = hostEl;
		this.plugin = plugin;
		this.app = plugin.app;
		this.dateTimeName = dateTimeName;
		this.initialValue = initialValue;
		this.use24HourFormat = !is12HourTimeFormat(
			plugin.settings.data.dateTimeFormat,
		);

		if (initialValue) {
			if (initialValue.includes("T")) {
				const parts = initialValue.split("T");
				this.selectedDate = parts[0] || null;
				this.selectedTime = normalizeTimeValue(parts[1]);
			} else if (initialValue.includes(":")) {
				this.selectedTime = normalizeTimeValue(initialValue);
			}
		}
	}

	onload(): void {
		this.render();
	}

	onunload(): void {
		this.hostEl.empty();
	}

	setOnApply(callback: (dateTime: string) => void): void {
		this.onApply = callback;
	}

	setOnCancel(callback: () => void): void {
		this.onCancel = callback;
	}

	private handleApply(): void {
		if (this.onApply) {
			if (this.selectedDate && this.selectedTime) {
				this.onApply(`${this.selectedDate}T${this.selectedTime}`);
			} else if (this.selectedTime) {
				this.onApply(this.selectedTime);
			} else if (this.selectedDate) {
				this.onApply(this.selectedDate);
			} else {
				this.onApply("");
			}
		}
	}

	private handleCancel(): void {
		if (this.onCancel) {
			this.onCancel();
		}
	}

	private render(): void {
		this.hostEl.empty();
		this.hostEl.addClass("date-time-picker-root-container");

		const container = this.hostEl.createDiv({
			cls: "date-time-picker-container",
		});

		const mainPanel = container.createDiv({
			cls: "date-time-picker-main-panel",
		});

		const leftPanel = mainPanel.createDiv({
			cls: "date-time-picker-left-panel",
		});

		const rightPanel = mainPanel.createDiv({
			cls: "date-time-picker-right-panel",
		});

		this.renderTimePicker(leftPanel);
		this.renderDatePicker(rightPanel);
		this.renderButtons(container);
	}

	private renderTimePicker(container: HTMLElement): void {
		const timePickerContainer = container.createDiv({
			cls: "time-picker-container",
		});

		timePickerContainer.createDiv({
			cls: "date-time-picker-section-title",
			text: t("select-time"),
		});

		const trigger = timePickerContainer.createDiv({
			cls: "time-picker-trigger",
		});
		trigger.setAttribute("role", "button");
		trigger.tabIndex = 0;
		this.timeTriggerEl = trigger;
		this.timeDisplayEl = trigger.createSpan({
			cls: "time-picker-trigger-value",
		});
		trigger.createSpan({ cls: "time-picker-trigger-icon", text: "🕒" });

		const openTimePicker = () => {
			const modal = new TimePickerModal(
				this.plugin,
				this.dateTimeName,
				this.selectedTime ?? undefined,
				this.use24HourFormat,
			);
			modal.onTimeSelected = (time: string) => {
				this.selectedTime = normalizeTimeValue(time);
				this.updateTimeDisplay();
			};
			modal.open();
		};

		trigger.addEventListener("click", openTimePicker);
		trigger.addEventListener("keydown", (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				openTimePicker();
			}
		});

		const quickTimeOptions = timePickerContainer.createDiv({
			cls: "quick-time-options",
		});

		const quickTimes = [
			{ label: t("morning"), time: "09:00" },
			{ label: t("noon"), time: "12:00" },
			{ label: t("afternoon"), time: "14:00" },
			{ label: t("evening"), time: "18:00" },
			{ label: t("night"), time: "21:00" },
		];

		quickTimes.forEach((option) => {
			const optionEl = quickTimeOptions.createDiv({
				cls: "time-picker-quick-option",
			});
			optionEl.createSpan({
				cls: "time-picker-quick-label",
				text: option.label,
			});
			optionEl.createSpan({
				cls: "time-picker-quick-value",
				text: formatTimeForDisplay(option.time, this.use24HourFormat),
			});
			optionEl.setAttribute("title", option.label);
			optionEl.addEventListener("click", () => {
				this.selectedTime = option.time;
				this.updateTimeDisplay();
			});
		});

		const clearTimeBtn = container.createDiv({
			cls: "quick-time-option clear-time",
		});
		clearTimeBtn.textContent = t("clear-time");
		clearTimeBtn.addEventListener("click", () => {
			this.selectedTime = null;
			this.updateTimeDisplay();
		});

		this.updateTimeDisplay();
	}

	private updateTimeDisplay(): void {
		if (!this.timeDisplayEl || !this.timeTriggerEl) return;
		const display = formatTimeForDisplay(
			this.selectedTime,
			this.use24HourFormat,
		);
		this.timeDisplayEl.textContent = display || t("select-time");
		this.timeTriggerEl.toggleClass("empty", !display);
	}

	private renderDatePicker(container: HTMLElement): void {
		const datePickerContainer = container.createDiv({
			cls: "date-picker-wrapper",
		});

		datePickerContainer.createDiv({
			cls: "date-time-picker-section-title",
			text: t("select-date"),
		});

		const pickerContainer = datePickerContainer.createDiv({
			cls: "date-picker-picker-container",
		});

		this.datePickerComponent = new DatePickerComponent(
			pickerContainer,
			this.plugin,
			this.dateTimeName,
			this.selectedDate || undefined,
			"📅",
		);

		this.datePickerComponent.onload();

		this.datePickerComponent.setOnDateChange((date: string) => {
			if (date) {
				this.selectedDate = date;
			} else {
				this.selectedDate = null;
			}
		});
	}

	private renderButtons(container: HTMLElement): void {
		const buttonsContainer = container.createDiv({
			cls: "date-time-picker-buttons",
		});

		const cancelBtn = buttonsContainer.createEl("button", {
			cls: "date-time-picker-btn cancel-btn",
			text: t("cancel") || "Cancel",
		});
		cancelBtn.addEventListener("click", () => this.handleCancel());

		const applyBtn = buttonsContainer.createEl("button", {
			cls: "date-time-picker-btn apply-btn",
			text: t("apply"),
		});
		applyBtn.addEventListener("click", () => this.handleApply());
	}
}
