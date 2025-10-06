import { Component } from "obsidian";
import { t } from "@/translations/helper";
export class ScrollToDateButton extends Component {
	private containerEl: HTMLElement;
	private scrollToDateCallback: (date: Date) => void;

	constructor(
		containerEl: HTMLElement,
		scrollToDateCallback: (date: Date) => void
	) {
		super();
		this.containerEl = containerEl;
		this.scrollToDateCallback = scrollToDateCallback;
	}

	onload() {
		const todayButton = this.containerEl.createEl("button", {
			text: t("Today"),
			cls: "gantt-filter-today-button",
		});

		this.registerDomEvent(todayButton, "click", () => {
			this.scrollToDateCallback(new Date());
		});
	}
}
