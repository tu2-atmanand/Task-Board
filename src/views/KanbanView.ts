// src/views/KanbanView.ts

import { App, ItemView, WorkspaceLeaf } from "obsidian";
import { ScanVaultIcon, TaskBoardIcon } from "src/types/Icons";

import type { Board } from "src/interfaces/BoardConfigs";
import Root from "src/components/Root.svelte";
import type TaskBoard from "../../main";
import { VIEW_TYPE_TASKBOARD } from "src/types/GlobalVariables";
import { boardConfigs } from "src/store";
import { get } from "svelte/store";
import { mount } from "svelte";
import { onUnloadSave } from "src/utils/tasksCache";
import { openScanVaultModal } from "../services/OpenModals";
import { t } from "src/utils/lang/helper";

export class KanbanView extends ItemView {
	plugin: TaskBoard;
	private svelteRoot: Root | null;
	private viewContent: Element;
	private boardConfigs: Board[];

	constructor(plugin: TaskBoard, leaf: WorkspaceLeaf) {
		super(leaf);
		this.app = plugin.app;
		this.plugin = plugin;
		this.svelteRoot = null;
		this.icon = TaskBoardIcon;
		this.viewContent = this.containerEl.children[1];
		this.boardConfigs = get(boardConfigs);
	}

	getViewType() {
		return VIEW_TYPE_TASKBOARD;
	}

	getDisplayText() {
		return t(130);
	}

	getSettings() {
		return this.plugin.settings;
	}

	async onOpen() {
		this.addAction(ScanVaultIcon, t(5), () => {
			openScanVaultModal(this.app, this.plugin);
		});

		// this.svelteRoot = new Root({
		// 	target: this.viewContent,
		// });

		const rootMount = mount(Root, { target: this.viewContent });
	}

	async onClose() {
		// Clean up when view is closed
		this.plugin.leafIsActive = false;
		onUnloadSave(this.plugin);
	}
}
