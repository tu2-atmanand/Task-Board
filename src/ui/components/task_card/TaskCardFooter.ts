import { createElement, type ReactNode } from "react";
import { setIcon } from "obsidian";
import { t } from "../../../utils/lang/helper.js";
import { DEFAULT_TASK_CACHE_KEYS } from "../../../interfaces/Enums.js";
import type {
	globalSettingsData,
	SupportedPropertiesConfig,
} from "../../../interfaces/GlobalSettings.js";
import type { taskItem } from "../../../interfaces/TaskItem.js";
import { priorityNames } from "../../../interfaces/Mapping.js";
import { getStatusNameFromStatusSymbol } from "../../../utils/TaskItemUtils.js";
import type { TaskCardFooterComponent, TaskCardFooterStyle } from "./index.js";

const NON_FOOTER_PROPERTIES = new Set<string>([
	DEFAULT_TASK_CACHE_KEYS.ID,
	DEFAULT_TASK_CACHE_KEYS.LegacyID,
	DEFAULT_TASK_CACHE_KEYS.Title,
	DEFAULT_TASK_CACHE_KEYS.Body,
	DEFAULT_TASK_CACHE_KEYS.SubTasks,
	DEFAULT_TASK_CACHE_KEYS.Description,
	DEFAULT_TASK_CACHE_KEYS.Tags,
	DEFAULT_TASK_CACHE_KEYS.Dependencies,
	DEFAULT_TASK_CACHE_KEYS.TaskLocation,
	DEFAULT_TASK_CACHE_KEYS.FrontMatterTags,
	DEFAULT_TASK_CACHE_KEYS.Checkbox,
]);

export interface TaskCardFooterPropertyValue {
	property: SupportedPropertiesConfig;
	value: string;
	ariaLabel?: string;
}

function getTaskPropertyValue(
	task: taskItem,
	propertyKey: string,
	globalSetting: globalSettingsData,
): string | undefined {
	if (propertyKey === String(DEFAULT_TASK_CACHE_KEYS.Status)) {
		const status = task[DEFAULT_TASK_CACHE_KEYS.Status];
		return status
			? getStatusNameFromStatusSymbol(
					status,
					globalSetting.customStatuses ?? [],
				)
			: undefined;
	}

	if (propertyKey === String(DEFAULT_TASK_CACHE_KEYS.Priority)) {
		const priority = task[DEFAULT_TASK_CACHE_KEYS.Priority];
		return priority === undefined || priority <= 0
			? undefined
			: (priorityNames[priority] ?? String(priority));
	}

	const value = task[propertyKey];
	if (value === undefined || value === null || value === "") return undefined;
	if (
		propertyKey === String(DEFAULT_TASK_CACHE_KEYS.FilePath) &&
		typeof value === "string"
	) {
		return value.split("/").pop() || value;
	}
	if (Array.isArray(value))
		return value.length > 0 ? value.join(", ") : undefined;
	if (typeof value === "boolean" || typeof value === "number")
		return String(value);
	if (typeof value === "string") return value;
	return undefined;
}

export function getTaskCardFooterProperties(
	task: taskItem,
	globalSetting: globalSettingsData,
): TaskCardFooterPropertyValue[] {
	return (globalSetting.taskProperties ?? [])
		.map((property, index) => ({ property, index }))
		.filter(({ property }) => !NON_FOOTER_PROPERTIES.has(property.key))
		.sort(
			(first, second) =>
				first.property.rank - second.property.rank ||
				first.index - second.index,
		)
		.flatMap(({ property }) => {
			const value = getTaskPropertyValue(
				task,
				property.key,
				globalSetting,
			);
			return value === undefined
				? []
				: [
						{
							property,
							value,
							ariaLabel:
								property.key ===
								String(DEFAULT_TASK_CACHE_KEYS.FilePath)
									? task[DEFAULT_TASK_CACHE_KEYS.FilePath]
									: undefined,
						},
					];
		});
}

export function renderTaskCardFooter(
	component: TaskCardFooterComponent,
	properties: TaskCardFooterPropertyValue[],
	style: TaskCardFooterStyle,
): ReactNode {
	const rootClass =
		style === "emoji"
			? "taskItemFooterPropertiesContainer_EmojiStyle"
			: style === "icons"
				? "taskItemFooterPropertiesContainer_IconStyle"
				: "taskItemFooterPropertiesContainer_BasesStyle";
	if (component.cardLoadingAnimation) {
		return createElement(
			"div",
			{ className: "taskItemFooterRefreshingMssg" },
			style === "emoji" ? "Refreshing..." : t("refreshing"),
		);
	}

	return createElement("div", {
		className: rootClass,
		ref: (container: HTMLDivElement | null): void => {
			if (!container) return;
			container.empty();

			for (const { property, value, ariaLabel } of properties) {
				const propertyContainer = container.createDiv({
					cls:
						style === "emoji"
							? "taskItemFooterPropertyContainerEmoji"
							: style === "icons"
								? "taskItemFooterPropertyContainer taskItemFooterPropertyContainerIcon"
								: "taskItemFooterPropertyContainer",
				});
				if (style === "icons" && property.color) {
					propertyContainer.style.borderColor = property.color;
				}
				const label = propertyContainer.createDiv({
					cls:
						style === "emoji"
							? "taskItemFooterPropertyContainerEmojiLabel"
							: "taskItemFooterPropertyContainerLabel",
				});

				if (style === "icons") {
					if (property.icon) {
						const iconContainer = label.createSpan({
							cls: "taskBoard_taskCard_iconStyle_icon",
						});
						if (property.color) {
							iconContainer.style.color = property.color;
						}
						setIcon(iconContainer, property.icon);
					}
				} else {
					label.createSpan({ text: propertyLabel(property, style) });
				}

				const propertyValue = propertyContainer.createDiv({
					cls: "taskItemFooterPropertyContainerValue",
					text: value,
				});
				if (ariaLabel)
					propertyValue.setAttribute("aria-label", ariaLabel);
			}
		},
	});
}

function propertyLabel(
	property: SupportedPropertiesConfig,
	style: Exclude<TaskCardFooterStyle, "icons">,
): string {
	return style === "emoji" ? property.emoji : property.name;
}
