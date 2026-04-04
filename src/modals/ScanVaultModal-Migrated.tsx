// /src/modals/ScanVaultModal-Migrated.tsx

import { App, Component, Modal, Notice } from "obsidian";
import { jsonCacheData, taskItem } from "src/interfaces/TaskItem";
import { MarkdownUIRenderer } from "src/services/MarkdownUIRenderer";
import VaultScanner, { fileTypeAllowedForScanning } from "src/managers/VaultScanner";
import TaskBoard from "main";
import { t } from "src/utils/lang/helper";
import { getFormattedTaskContent } from "src/utils/taskLine/TaskContentFormatter";
import { newReleaseVersion, VIEW_TYPE_TASKBOARD } from "src/interfaces/Constants";
import { getCurrentLocalDateTimeString } from "src/utils/DateTimeCalculations";
import { scanFilterForFilesNFoldersNFrontmatter } from "src/utils/algorithms/ScanningFilterer";
import { eventEmitter } from "src/services/EventEmitter";

const ITEM_HEIGHT = 80;
const BUFFER_SIZE = 5;

export const findMaxIdCounterAndUpdateSettings = (plugin: TaskBoard) => {
	let maxId = 0;

	Object.values(plugin.vaultScanner.tasksCache.Pending).forEach((tasks) => {
		tasks.forEach((task) => {
			const taskIdNum = task.legacyId ? parseInt(task.legacyId as unknown as string, 10) : 0;
			if (!isNaN(taskIdNum) && taskIdNum > maxId) {
				maxId = taskIdNum;
			}
		});
	});

	Object.values(plugin.vaultScanner.tasksCache.Completed).forEach((tasks) => {
		tasks.forEach((task) => {
			const taskIdNum = task.legacyId ? parseInt(task.legacyId as unknown as string, 10) : 0;
			if (!isNaN(taskIdNum) && taskIdNum > maxId) {
				maxId = taskIdNum;
			}
		});
	});

	plugin.settings.data.globalSettings.uniqueIdCounter = maxId + 1;
	plugin.saveSettings();
}

interface TaskEntry {
	filePath: string;
	task: taskItem;
	taskIndex: number;
}

export class ScanVaultModal extends Modal {
	vaultScanner: VaultScanner;
	plugin: TaskBoard;

	private isRunning: boolean = false;
	private terminalOutput: string[] = [];
	private progress: number = 0;
	private scannedFilesCount: number = 0;
	private showCollectedTasks: boolean = false;
	private collectedTasks: jsonCacheData = {
		VaultName: '',
		Modified_at: '',
		Pending: {},
		Completed: {},
	};

	private componentRef: Component | null = null;
	private taskElements: Map<string, HTMLElement> = new Map();

	private scanButtonEl: HTMLElement | null = null;
	private progressBarEl: HTMLElement | null = null;
	private terminalEl: HTMLElement | null = null;
	private tasksContainerEl: HTMLElement | null = null;
	private toggleButtonEl: HTMLElement | null = null;

	private flatTasks: TaskEntry[] = [];
	private visibleStartIndex: number = 0;
	private visibleEndIndex: number = 0;
	private scrollTop: number = 0;

	constructor(app: App, plugin: TaskBoard) {
		super(app);
		this.plugin = plugin;
		this.vaultScanner = plugin.vaultScanner;
		this.componentRef = plugin.view;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.setAttribute('data-type', 'task-board-scan-vault-modal');
		contentEl.addClass('scanVaultModalHome');

		this.collectedTasks = {
			VaultName: this.app.vault.getName(),
			Modified_at: getCurrentLocalDateTimeString(),
			Pending: {},
			Completed: {},
		};

		this.renderContent(contentEl);
	}

	private renderContent(container: HTMLElement) {
		container.empty();

		container.createEl('h2', { text: t('scan-tasks-from-the-vault') });

		if (localStorage.getItem('manadatoryScan') === 'true') {
			container.createDiv({
				cls: 'scanVaultModalHomeMandatoryScan',
				text: t('scan-vault-from-the-vault-upgrade-message-1') + ' ' + newReleaseVersion
			});
			container.createDiv({
				cls: 'scanVaultModalHomeMandatoryScan',
				text: t('scan-vault-from-the-vault-upgrade-message-2')
			});
			container.createEl('br');
			const msgDiv = container.createDiv({
				cls: 'scanVaultModalHomeMandatoryScan'
			});
			msgDiv.innerHTML = t('scan-vault-from-the-vault-upgrade-message-3') + ' : <a href="https://github.com/tu2-atmanand/Task-Board/releases/tag/' + newReleaseVersion + '">Task Board v' + newReleaseVersion + '</a>.';
		} else {
			container.createDiv({
				cls: 'setting-item-description',
				text: t('scan-tasks-from-the-vault-info-1')
			});
			container.createDiv({
				cls: 'setting-item-description',
				text: t('scan-tasks-from-the-vault-info-2')
			});
		}

		const secondSection = container.createDiv({
			cls: 'scanVaultModalHomeSecondSection'
		});

		const progressContainer = secondSection.createDiv({
			cls: 'scanVaultModalHomeSecondSectionProgressBarContainer'
		});

		this.progressBarEl = progressContainer.createEl('progress', {
			attr: { max: '100', value: '0' }
		});
		this.progressBarEl.style.width = '100%';
		this.progressBarEl.style.height = '35px';

		this.scanButtonEl = secondSection.createEl('button', {
			cls: 'scanVaultModalHomeSecondSectionButton',
			text: t('run')
		});
		this.scanButtonEl.addEventListener('click', () => this.runScan());

		this.scannedFilesCount = 0;
		this.terminalOutput = [];
		this.progress = 0;
		this.showCollectedTasks = false;
		this.updateProgressUI();

		const thirdSection = container.createDiv({
			cls: 'scanVaultModalHomeThirdSection'
		});

		this.terminalEl = thirdSection.createDiv({
			cls: 'scanVaultModalHomeTerminal scanVaultModalHomeTerminalSlideIn'
		});

		this.tasksContainerEl = thirdSection.createDiv({
			cls: 'scanVaultModalHomeTasksCollected slideOut'
		});

		this.toggleButtonEl = container.createEl('button', {
			cls: 'scanVaultModalHomeToggleButton',
			text: t('show-collected-tasks')
		});
		this.toggleButtonEl.addEventListener('click', () => this.toggleView());

		const notesSection = container.createDiv();
		notesSection.createEl('h4', { text: t('points-to-note') });
		notesSection.createEl('li', { cls: 'setting-item-description', text: t('scan-tasks-from-the-vault-description-1') });
		notesSection.createEl('li', { cls: 'setting-item-description', text: t('scan-tasks-from-the-vault-description-2') });
		notesSection.createEl('li', { cls: 'setting-item-description', text: t('scan-tasks-from-the-vault-description-3') });
	}

	private updateProgressUI() {
		if (this.progressBarEl) {
			this.progressBarEl.setAttribute('value', String(this.progress));
		}
		if (this.scanButtonEl) {
			this.scanButtonEl.textContent = this.isRunning ? this.progress.toFixed(0) : t('run');
			this.scanButtonEl.toggleAttribute('disabled', this.isRunning);
		}
	}

	private updateTerminalUI() {
		if (this.terminalEl) {
			this.terminalEl.innerHTML = '';
			this.terminalOutput.forEach(line => {
				this.terminalEl!.createDiv({ text: line });
			});
			this.terminalEl.scrollTop = this.terminalEl.scrollHeight;
		}
	}

	private async runScan() {
		this.isRunning = true;
		let totalScannedFilesCount = 0;

		this.vaultScanner.tasksCache.Pending = {};
		this.vaultScanner.tasksCache.Completed = {};
		this.vaultScanner.tasksCache.VaultName = this.app.vault.getName();
		this.vaultScanner.tasksCache.Modified_at = getCurrentLocalDateTimeString();

		this.terminalOutput = [];
		this.updateTerminalUI();

		const files = this.app.vault.getFiles();
		this.progress = 0;
		this.updateProgressUI();

		const globalSettings = this.plugin.settings.data.globalSettings;
		const scanFilters = globalSettings.scanFilters;

		for (let i = 0; i < files.length; i++) {
			const file = files[i];

			if (fileTypeAllowedForScanning(globalSettings, file)) {
				if (scanFilterForFilesNFoldersNFrontmatter(this.plugin, file, scanFilters)) {
					this.terminalOutput.push(`Scanning file: ${file.path}`);
					this.updateTerminalUI();
					await this.vaultScanner.extractTasksFromFile(file, scanFilters);
					totalScannedFilesCount++;
				}
			}

			this.progress = ((i + 1) / files.length) * 100;
			this.updateProgressUI();
		}

		this.collectedTasks = this.vaultScanner.tasksCache;
		this.scannedFilesCount = totalScannedFilesCount;
		this.isRunning = false;
		this.progress = 100;
		this.updateProgressUI();

		new Notice(t('vault-scanning-complete'));

		this.plugin.vaultScanner.tasksCache = this.vaultScanner.tasksCache;
		await this.vaultScanner.saveTasksToJsonCache();

		findMaxIdCounterAndUpdateSettings(this.plugin);

		if (localStorage.getItem('manadatoryScan') === 'true') {
			localStorage.setItem('manadatoryScan', 'false');
			this.app.workspace.getLeavesOfType(VIEW_TYPE_TASKBOARD).forEach((leaf) => {
				leaf.detach();
			});
			this.plugin.registerTaskBoardView();
		} else {
			eventEmitter.emit('REFRESH_BOARD');
		}
	}

	private toggleView() {
		this.showCollectedTasks = !this.showCollectedTasks;

		if (this.toggleButtonEl) {
			this.toggleButtonEl.textContent = this.showCollectedTasks 
				? t('hide-collected-tasks') 
				: t('show-collected-tasks');
		}

		if (this.terminalEl) {
			this.terminalEl.classList.toggle('scanVaultModalHomeTerminalSlideOut', !this.showCollectedTasks);
			this.terminalEl.classList.toggle('scanVaultModalHomeTerminalSlideIn', this.showCollectedTasks);
		}

		if (this.tasksContainerEl) {
			this.tasksContainerEl.classList.toggle('slideIn', this.showCollectedTasks);
			this.tasksContainerEl.classList.toggle('slideOut', !this.showCollectedTasks);
		}

		if (this.showCollectedTasks) {
			this.prepareVirtualScroll();
		}
	}

	private prepareVirtualScroll() {
		this.flatTasks = [];
		Object.keys(this.collectedTasks.Pending).forEach(filePath => {
			const tasks = this.collectedTasks.Pending[filePath];
			tasks.forEach((task, taskIndex) => {
				this.flatTasks.push({
					filePath,
					task,
					taskIndex
				});
			});
		});

		if (this.tasksContainerEl) {
			this.tasksContainerEl.innerHTML = '';

			const virtualScrollContainer = this.tasksContainerEl.createDiv({
				cls: 'virtualScrollContainer'
			});

			const totalHeight = this.flatTasks.length * ITEM_HEIGHT;
			virtualScrollContainer.style.height = `${totalHeight}px`;
			virtualScrollContainer.style.position = 'relative';

			const viewport = virtualScrollContainer.createDiv({
				cls: 'virtualScrollViewport'
			});
			viewport.style.height = '400px';
			viewport.style.overflowY = 'auto';
			viewport.style.position = 'relative';

			const content = viewport.createDiv({
				cls: 'virtualScrollContent'
			});

			this.renderVisibleItems(viewport, content);

			viewport.addEventListener('scroll', () => {
				this.scrollTop = viewport.scrollTop;
				this.renderVisibleItems(viewport, content);
			});
		}
	}

	private renderVisibleItems(viewport: HTMLElement, content: HTMLElement) {
		const viewportHeight = viewport.clientHeight;
		const startIndex = Math.max(0, Math.floor(this.scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
		const endIndex = Math.min(
			this.flatTasks.length,
			Math.ceil((this.scrollTop + viewportHeight) / ITEM_HEIGHT) + BUFFER_SIZE
		);

		this.visibleStartIndex = startIndex;
		this.visibleEndIndex = endIndex;

		content.innerHTML = '';

		for (let i = startIndex; i < endIndex; i++) {
			const taskEntry = this.flatTasks[i];
			const itemEl = content.createDiv({
				cls: 'virtualScrollItem'
			});
			itemEl.style.position = 'absolute';
			itemEl.style.top = `${i * ITEM_HEIGHT}px`;
			itemEl.style.height = `${ITEM_HEIGHT}px`;
			itemEl.style.width = '100%';

			itemEl.createEl('h3', { text: taskEntry.filePath });

			const taskDescEl = itemEl.createDiv({
				cls: 'taskDesc',
				attr: { id: `task-${i}` }
			});

			const task = taskEntry.task;
			const newTaskContent: taskItem = {
				...task,
				title: task.title,
				body: task.body,
				due: task.due,
				tags: task.tags,
				time: task.time,
				priority: task.priority,
			};

			getFormattedTaskContent(newTaskContent).then((formatedContent) => {
				if (formatedContent !== '') {
					taskDescEl.empty();
					MarkdownUIRenderer.renderTaskDisc(
						this.app,
						formatedContent,
						taskDescEl,
						task.filePath,
						this.componentRef
					);
				}
			});
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
