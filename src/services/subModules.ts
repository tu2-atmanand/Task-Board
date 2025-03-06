import { App } from "obsidian";
import { PluginDataJson } from "src/interfaces/GlobalSettings";
import TaskBoard from "main";

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
