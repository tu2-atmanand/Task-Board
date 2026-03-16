import { Component, App } from "obsidian";
import TaskBoard from "main";
import { t } from "src/utils/lang/helper";
import { DatePickerComponent } from "../date_picker/DatePickerComponent";

export class DateTimePickerComponent {
	private hostEl: HTMLElement;
	private plugin: TaskBoard;
	private app: App;
	private dateTimeName: string | undefined;
	private datePickerComponent!: DatePickerComponent;
	private initialValue?: string;

	private selectedDate: string | null = null;
	private selectedTime: string | null = null;

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

		if (initialValue) {
			if (initialValue.includes("T")) {
				const parts = initialValue.split("T");
				this.selectedDate = parts[0];
				this.selectedTime = parts[1];
			} else if (initialValue.includes(":")) {
				this.selectedTime = initialValue;
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

		const timeInput = timePickerContainer.createEl("input", {
			cls: "time-input",
			type: "time",
		});

		if (this.selectedTime) {
			timeInput.value = this.selectedTime;
		}

		timeInput.addEventListener("input", () => {
			this.selectedTime = timeInput.value || null;
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
				cls: "quick-time-option",
			});
			optionEl.textContent = option.label;
			optionEl.addEventListener("click", () => {
				this.selectedTime = option.time;
				timeInput.value = option.time;
			});
		});

		const clearTimeBtn = quickTimeOptions.createDiv({
			cls: "quick-time-option clear-time",
		});
		clearTimeBtn.textContent = t("clear-time");
		clearTimeBtn.addEventListener("click", () => {
			this.selectedTime = null;
			timeInput.value = "";
		});
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
			"📅"
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
