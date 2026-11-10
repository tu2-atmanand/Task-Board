/**
 * This folder consists of variations of the TaskCard designs.
 *
 * 1. TaskItem - This shows the properties in the Tasks plugin emoji format, with all the properties arranged as pills.
 * 2. BasesStyle - This provides more of a Bases cards kind of view, where the properties are shown as key-value pair in a list format inside the footer of the Task Card.
 * 3. TaskCardImage - A function which basically returns an HTML DOM element with the emoji format UI. This DOM element dont have any interactive elements inside it. Its an simple element only for rendering/viewing purposes.
 */

import { Component, View } from "obsidian";
import TaskBoard from "../../../../main.js";
import { KanbanView } from "../../../interfaces/BoardConfigs.js";
import { viewTypeNames } from "../../../interfaces/Enums.js";
import { taskItem } from "../../../interfaces/TaskItem.js";
import BasesStyle from "./BasesStyle.js";
import EmojiStyle from "./EmojiStyle.js";
import IconStyle from "./IconStyle.js";
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
	// These are optional as this TaskItem can be shown either on Kanban view or Map view.
	kanbanViewData?: KanbanView;
	columnIndex?: number;
	swimlaneData?: swimlaneDataProp;
}

export { EmojiStyle, BasesStyle, IconStyle, createTaskCard };
