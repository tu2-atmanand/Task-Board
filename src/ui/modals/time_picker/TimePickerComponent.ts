import { Component } from "obsidian";
import { t } from "i18next";
import TaskBoard from "../../../../main.js";

export type TimePickerPeriod = "AM" | "PM";

export interface TimePickerState {
	selectedTime: string | null;
}

const pad = (value: number): string => String(value).padStart(2, "0");

/** Detects date-fns/moment style 12-hour tokens (h/hh) in a date-time format. */
export const is12HourTimeFormat = (format: string): boolean =>
	/(^|[^\\])h/.test(format);

/** Accepts `HH:mm`, `H:mm`, `hh:mm AM` and returns a normalized `HH:mm` value. */
export const normalizeTimeValue = (value?: string | null): string | null => {
	if (!value) return null;
	const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([ap])\.?m\.?)?$/i);
	if (!match) return null;

	const minute = Number(match[2]);
	if (minute > 59) return null;

	let hour = Number(match[1]);
	const modifier = match[3]?.toLowerCase();
	if (modifier) {
		if (hour < 1 || hour > 12) return null;
		hour = (hour % 12) + (modifier === "p" ? 12 : 0);
	} else if (hour > 23) {
		return null;
	}

	return `${pad(hour)}:${pad(minute)}`;
};

/** Formats an internal `HH:mm` value for display in 12 or 24-hour mode. */
export const formatTimeForDisplay = (
	value: string | null,
	use24HourFormat: boolean,
): string => {
	const normalized = normalizeTimeValue(value);
	if (!normalized) return "";
	if (use24HourFormat) return normalized;

	const [hourRaw, minute] = normalized.split(":");
	const hour = Number(hourRaw);
	const period: TimePickerPeriod = hour >= 12 ? "PM" : "AM";
	const displayHour = hour % 12 || 12;
	return `${displayHour}:${minute} ${period}`;
};

const getCurrentTimeValue = (): string => {
	const now = new Date();
	return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

const addMinutesToTime = (time: string, minutes: number): string => {
	const [hour, minute] = time.split(":").map(Number);
	const totalMinutes = (hour * 60 + minute + minutes + 24 * 60) % (24 * 60);
	return `${pad(Math.floor(totalMinutes / 60))}:${pad(totalMinutes % 60)}`;
};

export class TimePickerComponent extends Component {
	private hostEl: HTMLElement;
	private plugin: TaskBoard;
	private timeName?: string;
	private use24HourFormat: boolean;
	private state: TimePickerState;
	private baseTime: string;
	private period: TimePickerPeriod;
	private onApply?: (time: string) => void;
	private onCancel?: () => void;

	private previewEl!: HTMLElement;
	private previewPeriodEl?: HTMLElement;
	private periodButtons: HTMLElement[] = [];
	private hourButtons: HTMLElement[] = [];
	private minuteButtons: HTMLElement[] = [];
	private quickTimeOptions: Array<{ el: HTMLElement; time: string }> = [];

	constructor(
		hostEl: HTMLElement,
		plugin: TaskBoard,
		timeName: string | undefined,
		initialTime?: string,
		use24HourFormat: boolean = true,
	) {
		super();
		this.hostEl = hostEl;
		this.plugin = plugin;
		this.timeName = timeName;
		this.use24HourFormat = use24HourFormat;
		this.baseTime = getCurrentTimeValue();

		const normalized = normalizeTimeValue(initialTime);
		this.state = { selectedTime: normalized };
		const initialHour = normalized
			? Number(normalized.split(":")[0])
			: Number(this.baseTime.split(":")[0]);
		this.period = initialHour >= 12 ? "PM" : "AM";
	}

	onload(): void {
		this.render();
	}

	onunload(): void {
		this.hostEl.empty();
	}

	setOnApply(callback: (time: string) => void): void {
		this.onApply = callback;
	}

	setOnCancel(callback: () => void): void {
		this.onCancel = callback;
	}

	getSelectedTime(): string | null {
		return this.state.selectedTime;
	}

	private render(): void {
		this.hostEl.empty();
		this.hostEl.addClass("time-picker-root-container");

		const dialog = this.hostEl.createDiv({ cls: "time-picker-dialog" });
		this.renderPreview(dialog);

		const body = dialog.createDiv({ cls: "time-picker-body" });
		const quickPanel = body.createDiv({ cls: "time-picker-quick-panel" });
		const clockPanel = body.createDiv({ cls: "time-picker-clock-panel" });

		this.renderQuickOptions(quickPanel);
		this.renderClock(clockPanel);
		this.renderFooter(dialog);
		this.updateSelectionUI();
	}

	private renderPreview(container: HTMLElement): void {
		const preview = container.createDiv({ cls: "time-picker-preview" });
		const main = preview.createDiv({ cls: "time-picker-preview-main" });

		this.previewEl = main.createDiv({ cls: "time-picker-preview-time" });
		main.createDiv({
			cls: "time-picker-preview-caption",
			text: this.timeName ? `${this.timeName} · ${t("select-time")}` : t("select-time"),
		});

		if (!this.use24HourFormat) {
			this.previewPeriodEl = preview.createDiv({
				cls: "time-picker-preview-period",
			});
		}
	}

	private renderQuickOptions(container: HTMLElement): void {
		container.createDiv({
			cls: "time-picker-section-title",
			text: t("quick-times"),
		});

		const quickTimes = container.createDiv({
			cls: "time-picker-quick-list",
		});

		const periods = [
			{ label: t("morning"), time: "09:00" },
			{ label: t("noon"), time: "12:00" },
			{ label: t("afternoon"), time: "14:00" },
			{ label: t("evening"), time: "18:00" },
			{ label: t("night"), time: "21:00" },
		];

		periods.forEach((option) => {
			const optionEl = quickTimes.createDiv({ cls: "time-picker-quick-option" });
			optionEl.createSpan({ cls: "time-picker-quick-label", text: option.label });
			optionEl.createSpan({
				cls: "time-picker-quick-value",
				text: formatTimeForDisplay(option.time, this.use24HourFormat),
			});
			this.registerDomEvent(optionEl, "click", () =>
				this.setSelectedTime(option.time),
			);
			this.quickTimeOptions.push({ el: optionEl, time: option.time });
		});

		container.createDiv({
			cls: "time-picker-section-title time-picker-section-spaced",
			text: t("quick-add"),
		});

		const addGrid = container.createDiv({ cls: "time-picker-add-grid" });
		const increments = [
			{ label: t("add-5-minutes"), minutes: 5 },
			{ label: t("add-10-minutes"), minutes: 10 },
			{ label: t("add-30-minutes"), minutes: 30 },
			{ label: t("add-1-hour"), minutes: 60 },
		];

		increments.forEach((increment) => {
			const button = addGrid.createEl("button", {
				cls: "time-picker-add-btn",
				text: increment.label,
			});
			button.setAttribute("type", "button");
			this.registerDomEvent(button, "click", () =>
				this.addMinutes(increment.minutes),
			);
		});

		const utilityRow = container.createDiv({ cls: "time-picker-utility-row" });
		const nowBtn = utilityRow.createEl("button", {
			cls: "time-picker-utility-btn",
			text: t("time-now"),
		});
		nowBtn.setAttribute("type", "button");
		this.registerDomEvent(nowBtn, "click", () =>
			this.setSelectedTime(getCurrentTimeValue()),
		);

		const clearBtn = utilityRow.createEl("button", {
			cls: "time-picker-utility-btn clear",
			text: t("clear-time"),
		});
		clearBtn.setAttribute("type", "button");
		this.registerDomEvent(clearBtn, "click", () => this.setSelectedTime(null));
	}

	private renderClock(container: HTMLElement): void {
		container.createDiv({
			cls: "time-picker-section-title",
			text: t("select-time"),
		});

		if (!this.use24HourFormat) {
			const toggle = container.createDiv({ cls: "time-picker-period-toggle" });
			(["AM", "PM"] as TimePickerPeriod[]).forEach((period) => {
				const button = toggle.createEl("button", {
					cls: "time-picker-period-btn",
					text: period,
				});
				button.setAttribute("type", "button");
				this.registerDomEvent(button, "click", () => this.setPeriod(period));
				this.periodButtons.push(button);
			});
		}

		const hourSection = container.createDiv({ cls: "time-picker-grid-section" });
		hourSection.createDiv({ cls: "time-picker-grid-label", text: t("hours") });
		const hourGrid = hourSection.createDiv({
			cls: "time-picker-grid time-picker-hour-grid",
		});

		const hours = this.use24HourFormat
			? Array.from({ length: 24 }, (_, index) => index)
			: Array.from({ length: 12 }, (_, index) => index + 1);

		hours.forEach((hour) => {
			const button = hourGrid.createEl("button", {
				cls: "time-picker-cell",
				text: this.use24HourFormat ? pad(hour) : String(hour),
			});
			button.setAttribute("type", "button");
			button.dataset.hour = String(hour);
			this.registerDomEvent(button, "click", () => this.selectHour(hour));
			this.hourButtons.push(button);
		});

		const minuteSection = container.createDiv({ cls: "time-picker-grid-section" });
		minuteSection.createDiv({ cls: "time-picker-grid-label", text: t("minutes") });
		const minuteGrid = minuteSection.createDiv({
			cls: "time-picker-grid time-picker-minute-grid",
		});

		Array.from({ length: 60 }, (_, index) => index).forEach((minute) => {
			const button = minuteGrid.createEl("button", {
				cls: "time-picker-cell",
				text: pad(minute),
			});
			button.setAttribute("type", "button");
			button.dataset.minute = String(minute);
			this.registerDomEvent(button, "click", () => this.selectMinute(minute));
			this.minuteButtons.push(button);
		});
	}

	private renderFooter(container: HTMLElement): void {
		const footer = container.createDiv({ cls: "time-picker-footer" });

		const cancelBtn = footer.createEl("button", {
			cls: "time-picker-btn cancel",
			text: t("cancel") || "Cancel",
		});
		cancelBtn.setAttribute("type", "button");
		this.registerDomEvent(cancelBtn, "click", () => this.handleCancel());

		const applyBtn = footer.createEl("button", {
			cls: "time-picker-btn apply",
			text: t("apply"),
		});
		applyBtn.setAttribute("type", "button");
		this.registerDomEvent(applyBtn, "click", () => this.handleApply());
	}

	private setSelectedTime(value: string | null): void {
		const normalized = normalizeTimeValue(value);
		this.state.selectedTime = normalized;
		if (normalized) {
			const hour = Number(normalized.split(":")[0]);
			this.period = hour >= 12 ? "PM" : "AM";
		}
		this.updateSelectionUI();
	}

	private setPeriod(period: TimePickerPeriod): void {
		if (this.period === period) return;
		this.period = period;

		if (this.state.selectedTime) {
			const [hourRaw, minute] = this.state.selectedTime.split(":");
			const hour24 = (Number(hourRaw) % 12) + (period === "PM" ? 12 : 0);
			this.state.selectedTime = `${pad(hour24)}:${minute}`;
		}
		this.updateSelectionUI();
	}

	private selectHour(hour: number): void {
		const minute = this.state.selectedTime
			? Number(this.state.selectedTime.split(":")[1])
			: Number(this.baseTime.split(":")[1]);
		const hour24 = this.use24HourFormat
			? hour
			: (hour % 12) + (this.period === "PM" ? 12 : 0);
		this.setSelectedTime(`${pad(hour24)}:${pad(minute)}`);
	}

	private selectMinute(minute: number): void {
		const hour = this.state.selectedTime
			? Number(this.state.selectedTime.split(":")[0])
			: Number(this.baseTime.split(":")[0]);
		this.setSelectedTime(`${pad(hour)}:${pad(minute)}`);
	}

	private addMinutes(minutes: number): void {
		const base = this.state.selectedTime || this.baseTime;
		this.setSelectedTime(addMinutesToTime(base, minutes));
	}

	private updateSelectionUI(): void {
		if (!this.previewEl) return;

		const selected = this.state.selectedTime;
		this.previewEl.textContent =
			formatTimeForDisplay(selected, this.use24HourFormat) || "--:--";

		if (this.previewPeriodEl) {
			this.previewPeriodEl.textContent = selected ? this.period : "—";
		}

		this.periodButtons.forEach((button) => {
			button.toggleClass("active", button.textContent === this.period);
		});

		const baseHour = Number((selected || this.baseTime).split(":")[0]);
		const displayedHour = this.use24HourFormat ? baseHour : baseHour % 12 || 12;
		const displayedMinute = Number((selected || this.baseTime).split(":")[1]);

		this.hourButtons.forEach((button) => {
			button.toggleClass("selected", Number(button.dataset.hour) === displayedHour);
		});
		this.minuteButtons.forEach((button) => {
			button.toggleClass("selected", Number(button.dataset.minute) === displayedMinute);
		});
		this.quickTimeOptions.forEach((option) => {
			option.el.toggleClass("selected", option.time === selected);
		});
	}

	private handleApply(): void {
		this.onApply?.(this.state.selectedTime ?? "");
	}

	private handleCancel(): void {
		this.onCancel?.();
	}
}
