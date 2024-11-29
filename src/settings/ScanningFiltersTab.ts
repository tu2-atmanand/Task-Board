import { Setting, normalizePath } from "obsidian";

import { TaskBoardSettingTab } from "src/views/TaskBoardSettingTab";
import { t } from "src/utils/lang/helper";

export async function scanningFiltersTab(this: TaskBoardSettingTab) {
	// Helper to add filter rows
	const addFilterRow = (
		label: string,
		filterType: keyof typeof scanFilters,
		polarity: number,
		values: string[],
		placeholder: string
	) => {
		const row = contentEl.createDiv({
			cls: "TaskBoardSettingConstructUI-scan-filter-row",
		});

		// Label
		row.createEl("span", {
			text: label,
			cls: "TaskBoardSettingConstructUI-filter-label",
		});

		// Input for values
		const input = row.createEl("input", {
			type: "text",
			cls: "TaskBoardSettingConstructUI-filter-input",
		});
		input.value = values.join(", ");
		input.addEventListener("change", async () => {
			this.globalSettings!.scanFilters[filterType].values = input.value
				.split(",")
				.map((v) => normalizePath(v.trim()));
			await this.saveSettings();
		});
		input.placeholder = placeholder;

		// Dropdown for polarity
		const dropdown = row.createEl("select", {
			cls: "TaskBoardSettingConstructUI-filter-dropdown",
		});
		[t(76), t(77), t(78)].forEach((optionText, idx) => {
			const option = dropdown.createEl("option", {
				text: optionText,
			});
			option.value = (idx + 1).toString();
			if (idx + 1 === polarity) option.selected = true;
		});
		dropdown.addEventListener("change", async () => {
			this.globalSettings!.scanFilters[filterType].polarity = parseInt(
				dropdown.value,
				10
			);
			await this.saveSettings();
		});
	};

	// Files Row
	addFilterRow(
		t(140),
		"files",
		scanFilters.files.polarity,
		scanFilters.files.values,
		"Personal Tasks.md, New folder/New file.md"
	);

	// Folders Row
	addFilterRow(
		t(141),
		"folders",
		scanFilters.folders.polarity,
		scanFilters.folders.values,
		"New Folder 1, New Folder 2, Parent Folder/child folder/New folder"
	);

	// Tags Row
	addFilterRow(
		t(142),
		"tags",
		scanFilters.tags.polarity,
		scanFilters.tags.values,
		"#Bug, #docs/🔥bug, #feature"
	);
}
