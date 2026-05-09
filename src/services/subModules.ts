import { App } from "obsidian";
import TaskBoard from "../../main.js";
import { PluginDataJson } from "../interfaces/GlobalSettings.js";

export class TaskBoardSubmodule {
	app: App;
	plugin: TaskBoard;

	constructor(plugin: TaskBoard) {
		this.app = plugin.app;
		this.plugin = plugin;
	}

	get settings(): PluginDataJson {
		return this.plugin.settings;
	}
}
