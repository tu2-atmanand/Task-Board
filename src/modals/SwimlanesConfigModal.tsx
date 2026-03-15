// /src/modals/SwimlanesConfigModal.tsx

import { Modal, App, Setting } from 'obsidian';
import { t } from 'src/utils/lang/helper';
import Sortable from 'sortablejs';
import { swimlaneConfigs } from 'src/interfaces/BoardConfigs';
import { HeaderUITypeOptions } from 'src/interfaces/Enums';

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

		// const item = container.createDiv({
		// 	cls: 'swimlanesConfigItem',
		// });

		// const label = item.createDiv({
		// 	cls: 'swimlanesConfigLabel',
		// });
		// label.createEl('label', { text: t('enable-swimlanes') });
		// label.createDiv({
		// 	cls: 'swimlanesConfigDescription',
		// 	text: t('enable-swimlanes-info-1') + '\n' + t('enable-swimlanes-info-2'),
		// });

		// const checkbox = item.createEl('input', {
		// 	attr: { type: 'checkbox' },
		// });
		// checkbox.checked = this.enabled;
		// checkbox.addEventListener('change', (e) => {
		// 	this.enabled = (e.target as HTMLInputElement).checked;
		// 	this.renderContent(container.parentElement!);
		// });
	}

	private renderPropertySelection(container: HTMLElement) {
		const item = container.createDiv({
			cls: 'swimlanesConfigItem',
		});

		const label = item.createDiv({
			cls: 'swimlanesConfigLabel',
		});
		label.createEl('label', { text: t('task-property') });
		label.createDiv({
			cls: 'swimlanesConfigDescription',
			text: t('task-property-info'),
		});

		const select = item.createEl('select', {
			cls: 'swimlanesConfigSelect',
		});

		const propertyOptions = [
			{ value: 'tags', label: t('tags') },
			{ value: 'priority', label: t('priority') },
			{ value: 'status', label: t('status') },
		];

		propertyOptions.forEach((option) => {
			select.createEl('option', {
				attr: { value: option.value },
				text: option.label,
			});
		});

		select.value = this.property;
		select.addEventListener('change', (e) => {
			this.property = (e.target as HTMLSelectElement).value;
			this.renderContent(container.parentElement!);
		});
	}

	private renderCustomValue(container: HTMLElement) {
		if (this.property !== 'custom') return;

		const item = container.createDiv({
			cls: 'swimlanesConfigItem',
		});

		const label = item.createDiv({
			cls: 'swimlanesConfigLabel',
		});
		label.createEl('label', { text: t('custom-property-key') });
		label.createDiv({
			cls: 'swimlanesConfigDescription',
			text: t('custom-property-key-info'),
		});

		const input = item.createEl('input', {
			attr: { type: 'text', placeholder: 'e.g.: project' },
			cls: 'swimlanesConfigInput',
		});
		input.value = this.customValue;
		input.addEventListener('input', (e) => {
			this.customValue = (e.target as HTMLInputElement).value;
		});
	}

	private renderMaxHeight(container: HTMLElement) {
		const item = container.createDiv({
			cls: 'swimlanesConfigItem',
		});

		const label = item.createDiv({
			cls: 'swimlanesConfigLabel',
		});
		label.createEl('label', { text: t('max-swimlane-height') });
		label.createDiv({
			cls: 'swimlanesConfigDescription',
			text: t('max-swimlane-height-info'),
		});

		const input = item.createEl('input', {
			attr: { type: 'text', placeholder: 'Default is 300px' },
		});
		input.value = this.maxHeight || '300px';
		input.addEventListener('input', (e) => {
			this.maxHeight = (e.target as HTMLInputElement).value;
		});
	}

	private renderSortCriteria(container: HTMLElement) {
		const item = container.createDiv({
			cls: 'swimlanesConfigItem',
		});

		const label = item.createDiv({
			cls: 'swimlanesConfigLabel',
		});
		label.createEl('label', { text: t('swimlane-sort-order') });
		label.createDiv({
			cls: 'swimlanesConfigDescription',
			text: t('swimlane-sort-order-info'),
		});

		const select = item.createEl('select', {
			cls: 'swimlanesConfigSelect',
		});

		const sortOptions = [
			{ value: 'asc', label: t('ascending') },
			{ value: 'desc', label: t('descending') },
			{ value: 'custom', label: t('custom-sorting') },
		];

		sortOptions.forEach((option) => {
			select.createEl('option', {
				attr: { value: option.value },
				text: option.label,
			});
		});

		select.value = this.sortCriteria;
		select.addEventListener('change', (e) => {
			this.sortCriteria = (e.target as HTMLSelectElement).value;
			this.renderContent(container.parentElement!);
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
				text: '×',
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
		const item = container.createDiv({
			cls: 'swimlanesConfigItem',
		});

		const label = item.createDiv({
			cls: 'swimlanesConfigLabel',
		});
		label.createEl('label', { text: t('aggregator-swimlane') });
		label.createDiv({
			cls: 'swimlanesConfigDescription',
			text: t('aggregator-swimlane-info'),
		});

		const checkbox = item.createEl('input', {
			attr: { type: 'checkbox' },
		});
		checkbox.checked = this.groupAllRest;
		checkbox.addEventListener('change', (e) => {
			this.groupAllRest = (e.target as HTMLInputElement).checked;
		});
	}

	private renderHideEmptySwimlanes(container: HTMLElement) {
		const item = container.createDiv({
			cls: 'swimlanesConfigItem',
		});

		const label = item.createDiv({
			cls: 'swimlanesConfigLabel',
		});
		label.createEl('label', { text: t('hide-empty-swimlanes') });
		label.createDiv({
			cls: 'swimlanesConfigDescription',
			text: t('hide-empty-swimlanes-info'),
		});

		const checkbox = item.createEl('input', {
			attr: { type: 'checkbox' },
		});
		checkbox.checked = this.hideEmptySwimlanes;
		checkbox.addEventListener('change', (e) => {
			this.hideEmptySwimlanes = (e.target as HTMLInputElement).checked;
		});
	}

	private renderHeaderUIType(container: HTMLElement) {
		const item = container.createDiv({
			cls: 'swimlanesConfigItem',
		});

		const label = item.createDiv({
			cls: 'swimlanesConfigLabel',
		});
		label.createEl('label', { text: t('ui-type-for-swimlanes-header') });
		label.createDiv({
			cls: 'swimlanesConfigDescription',
			text: t('ui-type-for-swimlanes-header-info'),
		});

		const select = item.createEl('select', {
			cls: 'swimlanesConfigSelect',
		});

		select.createEl('option', {
			attr: { value: HeaderUITypeOptions.horizontal },
			text: t('horizontal'),
		});
		select.createEl('option', {
			attr: { value: HeaderUITypeOptions.vertical },
			text: t('vertical'),
		});

		select.value = this.headerUIType;
		select.addEventListener('change', (e) => {
			this.headerUIType = (e.target as HTMLSelectElement).value;
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
