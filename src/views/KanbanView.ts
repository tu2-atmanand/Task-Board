// src/views/KanbanView.ts

import { App, ItemView, WorkspaceLeaf } from "obsidian";
import { ScanVaultIcon, TaskBoardIcon } from "src/types/Icons";
import { getBoardConfigs, store } from "src/shared.svelte";

import type { Board } from "src/interfaces/BoardConfigs";
import Root from "src/components/Root.svelte";
import type TaskBoard from "../../main";
import { VIEW_TYPE_TASKBOARD } from "src/types/GlobalVariables";
import { get } from "svelte/store";
import { mount } from "svelte";
import { onUnloadSave } from "src/utils/tasksCache";
import { openScanVaultModal } from "../services/OpenModals";
import { t } from "src/utils/lang/helper";

// import store, { boardConfigs } from "src/store";


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
		this.boardConfigs = getBoardConfigs();
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
		// store.view.set(this);
		store.view = this;

		this.addAction(ScanVaultIcon, t(5), () => {
			openScanVaultModal(this.app, this.plugin);
		});

		const rootMount = mount(Root, { target: this.viewContent });
	}

	async onClose() {
		// Clean up when view is closed
		this.plugin.leafIsActive = false;
		onUnloadSave();
	}
}
