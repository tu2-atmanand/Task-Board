import { Modal } from "obsidian";
import TaskBoard from "../../../main.js";
import { DateTimePickerComponent } from "./DateTimePickerComponent.js";

export class DateTimePickerModal extends Modal {
	private plugin: TaskBoard;
	private dateTimeName?: string;
	private initialValue?: string;
	public dateTimePickerComponent!: DateTimePickerComponent;
	public onDateTimeSelected: ((dateTime: string) => void) | null = null;

	constructor(
		plugin: TaskBoard,
		dateTimeName?: string,
		initialValue?: string,
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.dateTimeName = dateTimeName;
		this.initialValue = initialValue;
		this.setTitle("Change " + this.dateTimeName + " Date-Time");
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.modalEl.setAttribute("modal-type", "task-board-date-time-picker");

		this.dateTimePickerComponent = new DateTimePickerComponent(
			this.contentEl,
			this.plugin,
			this.dateTimeName,
			this.initialValue,
		);

		this.dateTimePickerComponent.onload();

		this.dateTimePickerComponent.setOnApply((dateTime: string) => {
			if (this.onDateTimeSelected) {
				this.onDateTimeSelected(dateTime);
			}
			this.close();
		});

		this.dateTimePickerComponent.setOnCancel(() => {
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;

		if (this.dateTimePickerComponent) {
			this.dateTimePickerComponent.onunload();
		}

		contentEl.empty();
	}
}
