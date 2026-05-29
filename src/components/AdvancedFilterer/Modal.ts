import { t } from "i18next";
import { Modal } from "obsidian";
import TaskBoard from "../../../main.js";
import { bugReporterManagerInsatance } from "../../managers/BugReporter.js";
import { AdvancedFilterComponent } from "./Component.js";
import { AdvancedFilter } from "../../interfaces/BoardConfigs.js";

export class AdvancedFilterModal extends Modal {
	private plugin: TaskBoard;
	private currentBoardID: string;
	public taskFilterComponent: AdvancedFilterComponent | null;
	private columnOrBoardName?: string;
	private existingFilters?: AdvancedFilter;
	public filterCloseCallback:
		| ((filterState?: AdvancedFilter) => void)
		| null = null;

	constructor(
		plugin: TaskBoard,
		forColumn: boolean,
		currentBoardID: string,
		columnOrBoardName?: string,
		existingFilters?: AdvancedFilter,
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.currentBoardID = currentBoardID;
		this.columnOrBoardName = columnOrBoardName;
		this.existingFilters = existingFilters;

		this.taskFilterComponent = null;

		if (forColumn) {
			this.setTitle(
				t("column-filters-for") + " - " + this.columnOrBoardName,
			);
		} else {
			this.setTitle(
				t("view-filters-for") + " - " + this.columnOrBoardName,
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
			this.existingFilters,
		);
		// Ensure the component is properly loaded
		this.taskFilterComponent.onload();
	}

	onClose() {
		const { contentEl } = this;

		let filtersState: AdvancedFilter | undefined = undefined;
		if (this.taskFilterComponent) {
			try {
				filtersState = this.taskFilterComponent.getFiltersState();
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
				this.filterCloseCallback(filtersState);
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
