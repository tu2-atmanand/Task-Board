import { Modal } from "obsidian";
import { DatePickerComponent } from "./DatePickerComponent";
import TaskBoard from "main";

export class DatePickerModal extends Modal {
	private plugin: TaskBoard;
	private dateName?: string;
	private initialDate?: string;
	private dateMark!: string;
	public datePickerComponent!: DatePickerComponent;
	public onDateSelected: ((date: string) => void) | null = null;

	constructor(
		plugin: TaskBoard,
		dateName?: string,
		initialDate?: string,
		dateMark: string = "📅",
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.dateName = dateName;
		this.initialDate = initialDate;
		this.dateMark = dateMark;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.datePickerComponent = new DatePickerComponent(
			this.contentEl,
			this.plugin,
			this.dateName,
			this.initialDate,
			this.dateMark,
		);

		this.datePickerComponent.onload();

		// Set up date change callback
		this.datePickerComponent.setOnDateChange((date: string) => {
			if (this.onDateSelected) {
				this.onDateSelected(date);
			}
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;

		if (this.datePickerComponent) {
			this.datePickerComponent.onunload();
		}

		contentEl.empty();
	}
}
