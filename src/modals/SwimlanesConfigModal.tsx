// /src/modals/SwimlanesConfigModal.tsx

import { Modal, App, Setting } from 'obsidian';
import Sortable from 'sortablejs';

import { swimlaneConfigs } from '../interfaces/BoardConfigs.js';
import { HeaderUITypeOptions } from '../interfaces/Enums.js';
import { t } from '../utils/lang/helper.js';

interface SwimlanesConfigModalProps {
	swimlaneConfig: swimlaneConfigs;
	onSave: (config: swimlaneConfigs) => void;
	onCancel: () => void;
}

export class SwimlanesConfigModal extends Modal {
	swimlaneConfig: swimlaneConfigs;
	onSave: (config: swimlaneConfigs) => void;
	onCancel: () => void;

	private enabled: boolean;
	private property: string;
	private customValue: string;
	private sortCriteria: string;
	private hideEmptySwimlanes: boolean;
	private customSortOrder: { value: string; index: number }[];
	private maxHeight: string;
	private groupAllRest: boolean;
	private headerUIType: string;

	private sortableInstance: Sortable | null = null;
	private sortableListEl: HTMLElement | null = null;

	constructor(
		app: App,
		swimlaneConfig: swimlaneConfigs,
		onSave: (config: swimlaneConfigs) => void,
		onCancel: () => void
	) {
		super(app);
		this.swimlaneConfig = swimlaneConfig;
		this.onSave = onSave;
		this.onCancel = onCancel;

		this.enabled = swimlaneConfig.enabled;
		this.property = swimlaneConfig.property || 'tags';
		this.customValue = swimlaneConfig.customValue || '';
		this.sortCriteria = swimlaneConfig.sortCriteria || 'asc';
		this.hideEmptySwimlanes = swimlaneConfig.hideEmptySwimlanes ?? false;
		this.customSortOrder = swimlaneConfig.customSortOrder || [];
		this.maxHeight = swimlaneConfig.maxHeight || '300px';
		this.groupAllRest = swimlaneConfig.groupAllRest ?? true;
		this.headerUIType = swimlaneConfig.headerUIType || HeaderUITypeOptions.horizontal;

		this.modalEl.classList.add('swimlanes-config-modal');
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.setAttribute('data-type', 'task-board-view');

		this.renderContent(contentEl);
	}

	private renderContent(container: HTMLElement) {
		container.empty();

		const modalContent = container.createDiv({
			cls: 'swimlanesConfigContent',
		});

		this.renderHeader(modalContent);
		this.renderEnabledToggle(modalContent);

		if (this.enabled) {
			this.renderPropertySelection(modalContent);
			this.renderCustomValue(modalContent);
			this.renderMaxHeight(modalContent);
			this.renderSortCriteria(modalContent);
			this.renderHeaderUIType(modalContent);
		}

		this.renderButtons(modalContent);
	}

	private renderHeader(container: HTMLElement) {
		container.createEl('h2', {
			text: t('configure-kanban-swimlanes'),
		});
	}

	private renderEnabledToggle(container: HTMLElement) {
		new Setting(container)
			.setName(t('enable-swimlanes'))
			.setDesc(t('enable-swimlanes-info-1') + '\n' + t('enable-swimlanes-info-2'))
			.addToggle((toggle) =>
				toggle
					.setValue(this.enabled)
					.onChange(async (value) => {
						this.enabled = value;
						this.renderContent(container.parentElement!);
					}),)
	}

	private renderPropertySelection(container: HTMLElement) {
		const propertyOptions = [
			{ value: 'tags', label: t('tags') },
			{ value: 'priority', label: t('priority') },
			{ value: 'status', label: t('status') },
		];

		new Setting(container)
			.setName(t('task-property'))
			.setDesc(t('task-property-info'))
			.addDropdown((dropdown) => {
				propertyOptions.forEach((option) => {
					dropdown.addOption(option.value, option.label);
				});
				dropdown
					.setValue(this.property)
					.onChange(async (value) => {
						this.property =
							value;
						this.renderContent(container.parentElement!);
					})
			});
	}

	private renderCustomValue(container: HTMLElement) {
		if (this.property !== 'custom') return;

		new Setting(container)
			.setName(t('custom-property-key'))
			.setDesc(t('custom-property-key-info'))
			.addText((text) => {
				text.setValue(this.customValue).onChange((value) => {
					this.customValue = value;
				});
			});
	}

	private renderMaxHeight(container: HTMLElement) {
		new Setting(container)
			.setName(t('max-swimlane-height'))
			.setDesc(t('max-swimlane-height-info'))
			.addText((text) => {
				text.setValue(this.maxHeight).onChange((value) => {
					this.maxHeight = value;
				});
			});
	}

	private renderSortCriteria(container: HTMLElement) {
		const sortOptions = [
			{ value: 'asc', label: t('ascending') },
			{ value: 'desc', label: t('descending') },
			{ value: 'custom', label: t('custom-sorting') },
		];

		new Setting(container)
			.setName(t('task-property'))
			.setDesc(t('task-property-info'))
			.addDropdown((dropdown) => {
				sortOptions.forEach((option) => {
					dropdown.addOption(option.value, option.label);
				});
				dropdown
					.setValue(this.sortCriteria)
					.onChange(async (value) => {
						this.sortCriteria =
							value;
						this.renderContent(container.parentElement!);
					})
			});

		if (this.sortCriteria === 'custom') {
			this.renderCustomSortSection(container);
		}
	}

	private renderCustomSortSection(container: HTMLElement) {
		const section = container.createDiv({
			cls: 'swimlanesConfigManualSortSection',
		});

		section.createEl('h3', {
			cls: 'swimlanesConfigManualSortHeading',
			text: t('custom-swimlanes'),
		});

		section.createDiv({
			cls: 'swimlanesConfigManualSortDescription',
			text: t('manual-sorting-mapping-info'),
		});

		const sortContainer = section.createDiv({
			cls: 'swimlaneConfigsManualSortContainer',
		});

		this.sortableListEl = sortContainer.createDiv({
			cls: 'swimlanesConfigSortRowsList',
		});

		this.renderSortRows();

		const addButton = sortContainer.createEl('button', {
			cls: 'swimlanesConfigAddSortRowBtn',
			text: t('add-row'),
		});
		addButton.addEventListener('click', () => this.handleAddSortRow());

		this.renderGroupAllRest(section);
		this.renderHideEmptySwimlanes(section);
	}

	private renderSortRows() {
		if (!this.sortableListEl) return;

		this.sortableListEl.empty();

		if (this.sortableInstance) {
			this.sortableInstance.destroy();
			this.sortableInstance = null;
		}

		this.customSortOrder.forEach((sortRow, rowIndex) => {
			const row = this.sortableListEl!.createDiv({
				cls: 'swimlanesConfigSortRow',
			});

			row.createSpan({
				cls: 'swimlanesConfigSortRowDragHandle',
				text: '⋮⋮',
			});

			row.createSpan({
				cls: 'swimlanesConfigSortRowIndex',
				text: String(sortRow.index),
			});

			const input = row.createEl('input', {
				attr: { type: 'text', placeholder: t('enter-property-value') },
				cls: 'swimlanesConfigSortRowInput',
			});
			input.value = sortRow.value;
			input.addEventListener('input', (e) => {
				this.customSortOrder[rowIndex].value = (e.target as HTMLInputElement).value;
			});

			const deleteBtn = row.createEl('button', {
				cls: 'swimlanesConfigSortRowDeleteBtn',
				text: '❌',
			});
			deleteBtn.addEventListener('click', () => this.handleRemoveSortRow(rowIndex));
		});

		if (this.sortCriteria === 'custom') {
			this.sortableInstance = Sortable.create(this.sortableListEl, {
				animation: 150,
				handle: '.swimlanesConfigSortRowDragHandle',
				ghostClass: 'swimlanesConfigSortRowGhost',
				chosenClass: 'swimlanesConfigSortRowChosen',
				dragClass: 'swimlanesConfigSortRowDrag',
				onEnd: (evt) => {
					if (evt.oldIndex === undefined || evt.newIndex === undefined) return;

					const newOrder = [...this.customSortOrder];
					const [movedItem] = newOrder.splice(evt.oldIndex, 1);
					newOrder.splice(evt.newIndex, 0, movedItem);

					const updatedOrder = newOrder.map((item, idx) => ({
						...item,
						index: idx + 1,
					}));

					this.customSortOrder = updatedOrder;
					this.renderSortRows();
				},
			});
		}
	}

	private handleAddSortRow() {
		const newIndex = this.customSortOrder.length + 1;
		this.customSortOrder = [
			...this.customSortOrder,
			{ value: '', index: newIndex },
		];
		this.renderSortRows();
	}

	private handleRemoveSortRow(rowIndex: number) {
		this.customSortOrder = this.customSortOrder
			.filter((_, idx) => idx !== rowIndex)
			.map((item, idx) => ({
				...item,
				index: idx + 1,
			}));
		this.renderSortRows();
	}

	private renderGroupAllRest(container: HTMLElement) {
		new Setting(container)
			.setName(t('aggregator-swimlane'))
			.setDesc(t('aggregator-swimlane-info'))
			.addToggle((toggle) =>
				toggle
					.setValue(this.groupAllRest)
					.onChange(async (value) => {
						this.groupAllRest = value;
					}),)
	}

	private renderHideEmptySwimlanes(container: HTMLElement) {
		new Setting(container)
			.setName(t('hide-empty-swimlanes'))
			.setDesc(t('hide-empty-swimlanes-info'))
			.addToggle((toggle) =>
				toggle
					.setValue(this.hideEmptySwimlanes)
					.onChange(async (value) => {
						this.hideEmptySwimlanes = value;
					}),)
	}

	private renderHeaderUIType(container: HTMLElement) {
		const uiTypeOptions = [
			{ value: HeaderUITypeOptions.horizontal, label: t('horizontal') },
			{ value: HeaderUITypeOptions.vertical, label: t('vertical') },
		];

		new Setting(container)
			.setName(t('ui-type-for-swimlanes-header'))
			.setDesc(t('ui-type-for-swimlanes-header-info'))
			.addDropdown((dropdown) => {
				uiTypeOptions.forEach((option) => {
					dropdown.addOption(option.value, option.label);
				});
				dropdown
					.setValue(this.headerUIType)
					.onChange(async (value) => {
						this.headerUIType =
							value;
					})
			});
	}

	private renderButtons(container: HTMLElement) {
		const buttonsContainer = container.createDiv({
			cls: 'swimlanesConfigButtonsContainer',
		});

		const cancelButton = buttonsContainer.createEl('button', {
			cls: 'swimlanesConfigBtn swimlanesConfigBtnCancel',
			text: t('cancel') || 'Cancel',
		});
		cancelButton.addEventListener('click', () => {
			this.onCancel();
			this.close();
		});

		const saveButton = buttonsContainer.createEl('button', {
			cls: 'swimlanesConfigBtn swimlanesConfigBtnSave',
			text: t('save') || 'Save',
		});
		saveButton.addEventListener('click', () => {
			const updatedConfig: swimlaneConfigs = {
				enabled: this.enabled,
				hideEmptySwimlanes: this.hideEmptySwimlanes,
				property: this.property,
				maxHeight: this.maxHeight,
				customValue: this.customValue || undefined,
				sortCriteria: this.sortCriteria,
				customSortOrder: this.sortCriteria === 'custom' ? this.customSortOrder : undefined,
				groupAllRest: this.groupAllRest,
				headerUIType: this.headerUIType,
				minimized: [],
			};
			this.onSave(updatedConfig);
			this.close();
		});
	}

	onClose() {
		if (this.sortableInstance) {
			this.sortableInstance.destroy();
			this.sortableInstance = null;
		}
		const { contentEl } = this;
		contentEl.empty();
	}
}
