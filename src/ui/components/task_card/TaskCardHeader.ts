import { setIcon } from "obsidian";
import {
	DEFAULT_TASK_CACHE_KEYS,
	TagColorType,
	colTypeNames,
	taskCardStyleNames,
	viewTypeNames,
} from "../../../interfaces/Enums.js";
import type { KanbanView } from "../../../interfaces/BoardConfigs.js";
import type { globalSettingsData } from "../../../interfaces/GlobalSettings.js";
import type { taskItem } from "../../../interfaces/TaskItem.js";
import { compareTwoTags } from "../../../core/algorithms/ScanningFilterer.js";
import { updateRGBAOpacity } from "../../../utils/UIHelpers.js";

export type TaskCardHeaderStyle = "bases" | "emoji" | "icons";

export interface TaskCardHeaderOptions {
	task: taskItem;
	globalSettings: globalSettingsData;
	propertiesVisibleInUI: string[];
	activeViewType: viewTypeNames;
	kanbanViewData?: KanbanView;
	columnData?: KanbanView["columns"][number];
}

export function renderTaskCardHeader(
	header: HTMLElement,
	options: TaskCardHeaderOptions,
	style: TaskCardHeaderStyle,
): void {
	const { task, globalSettings, propertiesVisibleInUI } = options;
	const headerBottom = createDiv({ cls: "taskItemHeaderBottom" });
	const headerLeft = createDiv({ cls: "taskItemHeaderLeft" });
	const headerRight = createDiv({ cls: "taskItemHeaderRight" });
	const lineTags = task[DEFAULT_TASK_CACHE_KEYS.Tags] ?? [];
	const frontmatterTags = task[DEFAULT_TASK_CACHE_KEYS.FrontMatterTags] ?? [];
	const idProperty = globalSettings.taskProperties.find(
		(property) => property.key === DEFAULT_TASK_CACHE_KEYS.ID,
	);
	const tagsProperty = globalSettings.taskProperties.find(
		(property) => property.key === DEFAULT_TASK_CACHE_KEYS.Tags,
	);

	header.replaceChildren();

	if (
		propertiesVisibleInUI.includes(
			DEFAULT_TASK_CACHE_KEYS.FilePathInHeader,
		) &&
		task[DEFAULT_TASK_CACHE_KEYS.FilePath]
	) {
		const topFilename = createDiv({
			cls: "taskitemHeaderTopFilename",
		});
		topFilename.setAttribute(
			"aria-label",
			task[DEFAULT_TASK_CACHE_KEYS.FilePath],
		);
		const filename = createDiv({
			cls: "taskitemHeaderTopFilenameValue",
		});
		filename.textContent =
			task[DEFAULT_TASK_CACHE_KEYS.FilePath].split("/").pop() ?? "";
		topFilename.appendChild(filename);
		header.appendChild(topFilename);
	}

	if (
		propertiesVisibleInUI.includes(DEFAULT_TASK_CACHE_KEYS.Tags) &&
		(lineTags.length > 0 || frontmatterTags.length > 0)
	) {
		const tagsContainer = createDiv({ cls: "taskItemTags" });
		const isTagBg = globalSettings.tagColorsType === TagColorType.TagBg;
		const isCardBg = globalSettings.tagColorsType === TagColorType.CardBg;

		lineTags.forEach((tag) => {
			const { activeViewType, kanbanViewData, columnData } = options;
			if (
				activeViewType === viewTypeNames.kanban &&
				kanbanViewData &&
				!kanbanViewData.showColumnTags &&
				columnData?.colType === colTypeNames.namedTag &&
				columnData.coltag &&
				compareTwoTags(columnData.coltag, tag)
			) {
				return;
			}

			const customTagColor = isCardBg
				? undefined
				: globalSettings.tagColors.find((item) =>
						compareTwoTags(item.name, tag),
					);
			const tagElement = createDiv({ cls: "taskItemTag" });
			if (style === taskCardStyleNames.ICONS)
				tagElement.addClass("taskItemTagIconStyle");
			const tagColor = customTagColor?.color;
			if (isTagBg && tagColor) {
				tagElement.addClass("tb_color_white");
				tagElement.style.color = "white";
			} else if (tagColor) {
				tagElement.style.color = tagColor;
			}
			if (isTagBg) {
				tagElement.style.backgroundColor = tagColor ?? "";
			} else if (customTagColor) {
				tagElement.style.backgroundColor = updateRGBAOpacity(
					customTagColor.color,
					0.1,
				);
				tagElement.style.borderColor = updateRGBAOpacity(
					customTagColor.color,
					0.5,
				);
			}

			// if (style === "icons" && tagsProperty?.icon) {
			// 	const iconElement = createSpan();
			// 	setIcon(iconElement, tagsProperty.icon);
			// 	tagElement.appendChild(iconElement);
			// }
			tagElement.appendText(tag);
			tagsContainer.appendChild(tagElement);
		});

		frontmatterTags.forEach((tag) => {
			const tagElement = createDiv({
				cls: "taskItemTagFrontmatter",
				attr: {
					"aria-label": "Tag from note's frontmatter (read-only)",
				},
			});
			tagElement.textContent = tag;
			tagsContainer.appendChild(tagElement);
		});

		headerLeft.appendChild(tagsContainer);
	}

	if (
		propertiesVisibleInUI.includes(DEFAULT_TASK_CACHE_KEYS.ID) &&
		task[DEFAULT_TASK_CACHE_KEYS.LegacyID]
	) {
		const idContainer = createDiv();
		const label = createDiv();
		if (style === "icons" && idProperty?.icon) {
			idContainer.addClass("taskItemPropertyID_iconStyle");
			label.addClass("taskItemPropertyIDLabel_iconStyle");
			setIcon(label, idProperty.icon);
		} else if (style === "emoji") {
			idContainer.addClass("taskItemPropertyID_emojiStyle");
			label.addClass("taskItemPropertyIDLabel_emojiStyle");
			label.textContent = idProperty?.emoji ?? "";
		} else {
			idContainer.addClass("taskItemPropertyID");
			label.addClass("taskItemPropertyIDLabel");
			label.textContent = idProperty?.name ?? "ID";
		}
		const value = createDiv({
			cls: "taskItemPropertyIDValue",
		});
		value.textContent = String(task[DEFAULT_TASK_CACHE_KEYS.LegacyID]);
		idContainer.append(label, value);
		headerRight.appendChild(idContainer);
	}

	headerBottom.append(headerLeft, headerRight);
	header.appendChild(headerBottom);
}
