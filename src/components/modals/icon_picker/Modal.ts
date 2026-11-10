import { App, Modal, getIcon, getIconIds } from 'obsidian';
import { t } from "i18next";
import { getOwnerWindow } from '../../../utils/dom-compat.js';
import { searchLucideIcons } from './IconSearch.js';
// import { setAccessibleLabelWithoutTooltip } from '../accessibility-label';

interface SettingsIconPickerModalOptions {
	settingsScope?: boolean;
	title?: string;
	value?: string;
	query?: string;
	onSelect: (value: string) => void | Promise<void>;
	onClear?: () => void | Promise<void>;
}

const COLUMN_COUNT = 7;
const ROW_COUNT = 5;
const PAGE_SIZE = COLUMN_COUNT * ROW_COUNT;
const LOAD_AHEAD_ROWS = 1;

function clampIndex(index: number, length: number): number {
	if (length === 0) return 0;
	return Math.max(0, Math.min(index, length - 1));
}

function formatCount(visibleCount: number, totalCount: number): string {
	if (visibleCount < totalCount) {
		return t('settings', 'settingsIconPickerCountPartial', {
			visible: String(visibleCount),
			total: String(totalCount),
		});
	}
	return t('settings', 'settingsIconPickerCount', { total: String(totalCount) });
}

export function normalizeTaskIconValue(
	value: string | null | undefined,
): string {
	if (typeof value !== "string") return "";
	const trimmed = value.trim();
	if (!trimmed) return "";
	if (trimmed.slice(0, "lucide-".length).toLowerCase() === "lucide-") {
		return trimmed.slice("lucide-".length).trim();
	}
	return trimmed;
}

export class SettingsIconPickerModal extends Modal {
	private readonly options: SettingsIconPickerModalOptions;
	private inputEl: HTMLInputElement | null = null;
	private gridEl: HTMLElement | null = null;
	private countEl: HTMLElement | null = null;
	private emptyEl: HTMLElement | null = null;
	private readonly allIcons = getIconIds().slice().sort((left, right) => left.localeCompare(right, 'en'));
	private matches: string[] = [];
	private activeIndex = 0;
	private loadedCount = PAGE_SIZE;
	private readonly currentValue: string;

	constructor(app: App, options: SettingsIconPickerModalOptions) {
		super(app);
		this.options = options;
		this.currentValue = normalizeTaskIconValue(options.value);
	}

	onOpen(): void {
		this.modalEl.addClass('task-board-settings-icon-picker-modal');
		this.titleEl.setText(this.options.title ?? t('settings', 'settingsIconPickerTitle'));
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		this.inputEl = contentEl.createEl('input', {
			cls: 'task-board-floating-input task-board-settings-icon-picker-search',
			attr: {
				type: 'text',
				placeholder: t('settings', 'settingsIconPickerSearchPlaceholder'),
			},
		});
		this.inputEl.value = this.options.query ?? '';

		if (this.currentValue) {
			const currentEl = contentEl.createDiv('task-board-settings-icon-picker-current');
			const iconWrap = currentEl.createSpan('task-board-settings-icon-picker-current-icon');
			const iconEl = getIcon(this.currentValue);
			if (iconEl) iconWrap.appendChild(iconEl);
			currentEl.createSpan({
				cls: 'task-board-settings-icon-picker-current-label',
				text: `${t('settings', 'settingsIconPickerCurrent')}: ${this.currentValue}`,
			});
		}

		this.emptyEl = contentEl.createDiv({
			cls: 'task-board-settings-icon-picker-empty',
			text: t('settings', 'settingsIconPickerEmpty'),
		});
		this.gridEl = contentEl.createDiv('task-board-icon-picker-grid task-board-settings-icon-picker-grid');

		const actions = contentEl.createDiv('task-board-floating-actions task-board-icon-picker-actions task-board-settings-icon-picker-actions');
		this.countEl = actions.createDiv('task-board-icon-picker-count');
		const buttonWrap = actions.createDiv('task-board-settings-icon-picker-button-group');
		if (this.options.onClear) {
			const clearButton = buttonWrap.createEl('button', {
				cls: 'task-board-floating-btn is-secondary',
				text: t('buttons', 'clear'),
				attr: { type: 'button' },
			});
			clearButton.addEventListener('click', () => {
				void this.clearSelection();
			});
		}
		const cancelButton = buttonWrap.createEl('button', {
			cls: 'task-board-floating-btn is-secondary',
			text: t('buttons', 'cancel'),
			attr: { type: 'button' },
		});
		cancelButton.addEventListener('click', () => this.close());

		this.inputEl.addEventListener('input', () => this.updateMatches(this.inputEl?.value ?? ''));
		this.inputEl.addEventListener('keydown', event => this.handleKeydown(event));
		this.gridEl.addEventListener('scroll', () => {
			if (this.loadMoreIfNearBottom()) this.renderGrid(false);
		});
		this.gridEl.addEventListener('wheel', event => {
			if (event.deltaY <= 0) return;
			if (!this.loadMoreIfNearBottom()) return;
			const gridEl = this.gridEl;
			if (!gridEl) return;
			const previousScrollTop = gridEl.scrollTop;
			event.preventDefault();
			this.renderGrid(false);
			getOwnerWindow(gridEl).requestAnimationFrame(() => {
				gridEl.scrollTop = previousScrollTop + event.deltaY;
			});
		});

		this.updateMatches(this.inputEl.value);
		const ownerWindow = getOwnerWindow(contentEl);
		ownerWindow.requestAnimationFrame(() => this.inputEl?.focus());
		ownerWindow.setTimeout(() => this.inputEl?.focus(), 0);
	}

	private handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			this.moveActiveIndex(COLUMN_COUNT);
			return;
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			this.moveActiveIndex(-COLUMN_COUNT);
			return;
		}
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			this.moveActiveIndex(1);
			return;
		}
		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			this.moveActiveIndex(-1);
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			const iconId = this.matches[this.activeIndex];
			if (iconId) void this.selectIcon(iconId);
		}
	}

	private updateMatches(query: string): void {
		const previousActiveIcon = this.matches[this.activeIndex] ?? this.currentValue;
		this.matches = searchLucideIcons(query, this.allIcons);
		this.loadedCount = PAGE_SIZE;
		if (query.trim().length === 0 && this.currentValue) {
			const selectedIndex = this.matches.indexOf(this.currentValue);
			this.activeIndex = selectedIndex >= 0 && selectedIndex < this.loadedCount ? selectedIndex : 0;
		} else {
			const previousIndex = previousActiveIcon ? this.matches.indexOf(previousActiveIcon) : -1;
			this.activeIndex = previousIndex >= 0 && previousIndex < this.loadedCount ? previousIndex : 0;
		}
		this.renderGrid();
	}

	private getVisibleMatches(): string[] {
		return this.matches.slice(0, Math.min(this.loadedCount, this.matches.length));
	}

	private renderGrid(keepActiveVisible = true): void {
		const gridEl = this.gridEl;
		const countEl = this.countEl;
		const emptyEl = this.emptyEl;
		if (!gridEl || !countEl || !emptyEl) return;

		this.ensureLoadedForIndex(this.activeIndex);
		gridEl.replaceChildren();
		countEl.setText(formatCount(Math.min(this.loadedCount, this.matches.length), this.matches.length));
		const isEmpty = this.matches.length === 0;
		gridEl.toggleClass('is-empty', isEmpty);
		emptyEl.toggleClass('is-hidden', !isEmpty);
		emptyEl.toggleAttribute('hidden', !isEmpty);
		if (isEmpty) return;

		let activeItemEl: HTMLButtonElement | null = null;
		this.getVisibleMatches().forEach((iconId, absoluteIndex) => {
			const item = gridEl.createEl('button');
			item.type = 'button';
			item.className = 'task-board-icon-picker-cell';
			if (absoluteIndex === this.activeIndex) item.classList.add('is-active');

			const iconWrap = item.createDiv('task-board-icon-picker-icon');
			const icon = getIcon(iconId);
			if (icon) iconWrap.appendChild(icon);
			// setAccessibleLabelWithoutTooltip(item, iconId);

			item.addEventListener('mousemove', () => {
				if (this.activeIndex === absoluteIndex) return;
				this.activeIndex = absoluteIndex;
				gridEl.querySelector('.task-board-icon-picker-cell.is-active')?.classList.remove('is-active');
				item.classList.add('is-active');
			});
			item.addEventListener('click', event => {
				event.preventDefault();
				void this.selectIcon(iconId);
			});
			item.addEventListener('mousedown', event => {
				event.preventDefault();
				void this.selectIcon(iconId);
			});

			gridEl.appendChild(item);
			if (absoluteIndex === this.activeIndex) activeItemEl = item;
		});

		if (keepActiveVisible && activeItemEl) {
			this.scrollActiveItemIntoView(activeItemEl);
		}
	}

	private scrollActiveItemIntoView(activeItemEl: HTMLElement): void {
		const gridEl = this.gridEl;
		if (!gridEl) return;
		const activeRect = activeItemEl.getBoundingClientRect();
		const gridRect = gridEl.getBoundingClientRect();
		if (activeRect.top < gridRect.top) {
			gridEl.scrollTop -= gridRect.top - activeRect.top;
		} else if (activeRect.bottom > gridRect.bottom) {
			gridEl.scrollTop += activeRect.bottom - gridRect.bottom;
		}
	}

	private moveActiveIndex(delta: number): void {
		if (this.matches.length === 0) return;
		this.activeIndex = clampIndex(this.activeIndex + delta, this.matches.length);
		this.ensureLoadedForIndex(this.activeIndex);
		this.renderGrid();
	}

	private ensureLoadedForIndex(index: number): void {
		const loadAhead = COLUMN_COUNT * LOAD_AHEAD_ROWS;
		const neededCount = Math.min(this.matches.length, index + 1 + loadAhead);
		if (neededCount <= this.loadedCount) return;
		this.loadedCount = Math.min(this.matches.length, Math.ceil(neededCount / PAGE_SIZE) * PAGE_SIZE);
	}

	private loadMoreIfNearBottom(): boolean {
		const gridEl = this.gridEl;
		if (!gridEl || this.loadedCount >= this.matches.length) return false;
		const remainingScroll = gridEl.scrollHeight - gridEl.scrollTop - gridEl.clientHeight;
		if (remainingScroll > 46) return false;
		const nextLoadedCount = Math.min(this.loadedCount + PAGE_SIZE, this.matches.length);
		if (nextLoadedCount === this.loadedCount) return false;
		this.loadedCount = nextLoadedCount;
		return true;
	}

	private async selectIcon(iconId: string): Promise<void> {
		await this.options.onSelect(normalizeTaskIconValue(iconId));
		this.close();
	}

	private async clearSelection(): Promise<void> {
		await this.options.onClear?.();
		this.close();
	}
}

export function openIconPickerModal(app: App, options: SettingsIconPickerModalOptions): SettingsIconPickerModal {
	const modal = new SettingsIconPickerModal(app, options);
	modal.open();
	return modal;
}

