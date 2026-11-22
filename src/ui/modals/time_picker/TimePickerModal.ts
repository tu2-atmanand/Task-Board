import { Modal } from "obsidian";
import TaskBoard from "../../../../main.js";
import { TimePickerComponent } from "./TimePickerComponent.js";

export class TimePickerModal extends Modal {
	private plugin: TaskBoard;
	private timeName?: string;
	private initialTime?: string;
	private use24HourFormat: boolean;
	public timePickerComponent!: TimePickerComponent;
	public onTimeSelected: ((time: string) => void) | null = null;

	constructor(
		plugin: TaskBoard,
		timeName?: string,
		initialTime?: string,
		use24HourFormat: boolean = true,
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.timeName = timeName;
		this.initialTime = initialTime;
		this.use24HourFormat = use24HourFormat;
		this.setTitle("Change " + this.timeName + " Time");
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.setAttribute("modal-type", "task-board-time-picker");

		this.timePickerComponent = new TimePickerComponent(
			this.contentEl,
			this.plugin,
			this.timeName,
			this.initialTime,
			this.use24HourFormat,
		);
		this.timePickerComponent.onload();

		this.timePickerComponent.setOnApply((time: string) => {
			if (this.onTimeSelected) {
				this.onTimeSelected(time);
			}
			this.close();
		});

		this.timePickerComponent.setOnCancel(() => {
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;

		if (this.timePickerComponent) {
			this.timePickerComponent.onunload();
		}

		contentEl.empty();
	}
}
