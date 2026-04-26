import { t } from "i18next";
import { Modal } from "obsidian";
import TaskBoard from "../../../main.js";
import { RootFilterState } from "../../interfaces/BoardConfigs.js";
import { bugReporterManagerInsatance } from "../../managers/BugReporter.js";
import { AdvancedFilterComponent } from "./Component.js";

export class AdvancedFilterModal extends Modal {
	private plugin: TaskBoard;
	private currentBoardID: string;
	public taskFilterComponent: AdvancedFilterComponent | null;
	private columnOrBoardName?: string;
	private initialFilterState?: RootFilterState;
	public filterCloseCallback:
		| ((filterState?: RootFilterState) => void)
		| null = null;

	constructor(
		plugin: TaskBoard,
		forColumn: boolean,
		currentBoardID: string,
		columnOrBoardName?: string,
		initialFilterState?: RootFilterState,
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.currentBoardID = currentBoardID;
		this.columnOrBoardName = columnOrBoardName;
		this.initialFilterState = initialFilterState;

		this.taskFilterComponent = null;

		if (forColumn) {
			this.setTitle(
				t("column-filters-for") + " " + this.columnOrBoardName,
			);
		} else {
			this.setTitle(
				t("board-filters-for") + " " + this.columnOrBoardName,
			);
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.taskFilterComponent = new AdvancedFilterComponent(
			this.contentEl,
			this.plugin,
			this.app,
			this.currentBoardID,
			this.initialFilterState,
		);
		// Ensure the component is properly loaded
		this.taskFilterComponent.onload();
	}

	onClose() {
		const { contentEl } = this;

		let filterState: RootFilterState | undefined = undefined;
		if (this.taskFilterComponent) {
			try {
				filterState = this.taskFilterComponent.getFilterState();
				this.taskFilterComponent.onunload();
			} catch (error) {
				bugReporterManagerInsatance.addToLogs(
					114,
					String(error),
					"AdvancedFilterModal.ts/onClose",
				);
			}
		}

		contentEl.empty();

		if (this.filterCloseCallback) {
			try {
				this.filterCloseCallback(filterState);
			} catch (error) {
				bugReporterManagerInsatance.addToLogs(
					115,
					String(error),
					"AdvancedFilterModal.ts/onClose",
				);
			}
		}
	}
}
