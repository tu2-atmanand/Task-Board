import { createElement, type ReactNode } from "react";
import { setIcon } from "obsidian";
import { t } from "../../../utils/lang/helper.js";
import {
	DEFAULT_TASK_CACHE_KEYS,
	PropertyTypeConfig,
} from "../../../interfaces/Enums.js";
import type {
	globalSettingsData,
	SupportedPropertiesConfig,
} from "../../../interfaces/GlobalSettings.js";
import type { taskItem } from "../../../interfaces/TaskItem.js";
import { getTaskPropertyValue } from "../../../utils/TaskItemUtils.js";
import type {
	TaskCardFooterComponentOptions,
	TaskCardFooterStyle,
} from "./index.js";
import { getHumanReadableDateString } from "../../../utils/DateTimeCalculations.js";

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
}

export function getTaskCardFooterProperties(
	task: taskItem,
	globalSetting: globalSettingsData,
	propertiesVisibleInUI: string[],
): TaskCardFooterPropertyValue[] {
	return (globalSetting.taskProperties ?? [])
		.map((property, index) => ({ property, index }))
		.filter(
			({ property }) =>
				!NON_FOOTER_PROPERTIES.has(property.key) &&
				propertiesVisibleInUI.includes(property.key),
		)
		.sort(
			(first, second) =>
				first.property.rank - second.property.rank ||
				first.index - second.index,
		)
		.flatMap(({ property }) => {
			const valueNtype = getTaskPropertyValue(
				task,
				property.key,
				globalSetting,
				true,
			);

			if (valueNtype.propertyValue === undefined) return [];

			if (
				valueNtype.propertyType === PropertyTypeConfig.date ||
				valueNtype.propertyType === PropertyTypeConfig.dateTime
			) {
				if (globalSetting.dateHumanReadable) {
					return [
						{
							property,
							value: getHumanReadableDateString(
								String(valueNtype.propertyValue),
							),
						},
					];
				}
			}
			return [
				{
					property,
					value: String(valueNtype.propertyValue),
				},
			];
		});
}

function getPropertyLabel(
	property: SupportedPropertiesConfig,
	style: Exclude<TaskCardFooterStyle, "icons">,
): string {
	return style === "emoji" ? property.emoji : property.name;
}

export function renderTaskCardFooter(
	options: TaskCardFooterComponentOptions,
	properties: TaskCardFooterPropertyValue[],
	style: TaskCardFooterStyle,
): ReactNode {
	const rootClass =
		style === "emoji"
			? "taskItemFooterPropertiesContainer_EmojiStyle"
			: style === "icons"
				? "taskItemFooterPropertiesContainer_IconStyle"
				: "taskItemFooterPropertiesContainer_BasesStyle";
	if (options.cardLoadingAnimation) {
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

			for (const { property, value } of properties) {
				const propertyContainer = container.createDiv({
					cls:
						style === "emoji"
							? "taskItemFooterPropertyContainer_EmojiStyle"
							: style === "icons"
								? "taskItemFooterPropertyContainer_IconStyle"
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
					label.createSpan({
						text: getPropertyLabel(property, style),
					});
				}

				const propertyValue = propertyContainer.createDiv({
					cls: "taskItemFooterPropertyContainerValue",
					text: value,
				});
				propertyValue.setAttribute("aria-label", value);
			}
		},
	});
}
