/**
 * Shared task-card component and its display-only image renderer.
 * The parent component selects the footer helper from the configured card style.
 */

import { Component, View } from "obsidian";
import TaskBoard from "../../../../main.js";
import { KanbanView } from "../../../interfaces/BoardConfigs.js";
import { viewTypeNames } from "../../../interfaces/Enums.js";
import { taskItem } from "../../../interfaces/TaskItem.js";
import TaskCardParent from "./TaskCardParent.js";
import createTaskCard from "./TaskCardImage.js";

export interface swimlaneDataProp {
	property: string;
	value: string;
}

export interface TaskCardProps {
	dataAttributeIndex: number;
	plugin: TaskBoard;
	task: taskItem;
	parentComponent: Component | View; // This is only require for the Markdown.render API to track its lifecycle
	activeBoardID: string;
	activeViewIndex: number;
	activeViewType: viewTypeNames;
	propertiesVisibleInUI: string[];
	// These are optional as this TaskItem can be shown either on Kanban view or Map view.
	kanbanViewData?: KanbanView;
	columnIndex?: number;
	swimlaneData?: swimlaneDataProp;
}

export interface TaskCardFooterComponentOptions {
	cardLoadingAnimation: boolean;
	propertiesVisibleInUI: string[];
}

export type TaskCardFooterStyle = "emoji" | "bases" | "icons";

export { TaskCardParent, createTaskCard };
export { renderBasesStyleFooter } from "./BasesStyle.js";
export { renderEmojiStyleFooter } from "./EmojiStyle.js";
export { renderIconStyleFooter } from "./IconStyle.js";
