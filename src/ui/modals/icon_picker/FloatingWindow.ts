import { getIcon, getIconIds } from 'obsidian';
import { t } from "i18next";
import { searchLucideIcons } from './IconSearch.js';
import { getOwnerWindow } from '../../../utils/dom-compat.js';
import { FloatingHostOptions, createFloatingPanel, createButton, focusFloatingInput } from '../../../components/Common.js';

interface IconPickerOptions extends FloatingHostOptions {
	value?: string;
	query?: string;
	retainInputFocus?: boolean;
	onSelect: (value: string) => void;
	onClear?: () => void;
	onClose?: () => void;
}

const COLUMN_COUNT = 7;
const ROW_COUNT = 5;
const CELL_HEIGHT = 42;
const GRID_GAP = 4;
const PAGE_SIZE = COLUMN_COUNT * ROW_COUNT;
const LOAD_AHEAD_ROWS = 1;

function clampIndex(index: number, length: number): number {
	if (length === 0) return 0;
	return Math.max(0, Math.min(index, length - 1));
}

export function showIconPicker(anchor: HTMLElement | DOMRect, options: IconPickerOptions): () => void {
	let completed = false;
	const { panel, close } = createFloatingPanel(anchor, 'task-board-floating-panel task-board-icon-picker-panel', () => {
		if (!completed) options.onClose?.();
	}, {
		floatingHost: options.floatingHost,
		floatingScrollHost: options.floatingScrollHost,
		constrainToFloatingHost: options.constrainToFloatingHost,
		retainInputFocus: options.retainInputFocus,
	});

	const input = panel.createEl('input');
	input.type = 'text';
	input.className = 'task-board-floating-input';
	input.placeholder = t('taskEditor', 'searchIcon');
	input.value = options.query ?? '';
	const ownerWindow = getOwnerWindow(panel);

	const grid = panel.createDiv('task-board-icon-picker-grid');

	const actions = panel.createDiv('task-board-floating-actions task-board-icon-picker-actions');
	const countLabel = actions.createDiv('task-board-icon-picker-count');
	actions.appendChild(countLabel);
	if (options.onClear) {
		const clearButton = createButton(t('buttons', 'clear'), 'task-board-floating-btn is-secondary', actions);
		clearButton.addEventListener('click', () => {
			completed = true;
			options.onClear?.();
			close();
		});
		actions.appendChild(clearButton);
	}

	const allIcons = getIconIds().slice().sort((left, right) => left.localeCompare(right, 'en'));
	let matches: string[] = [];
	let activeIndex = 0;
	let loadedCount = PAGE_SIZE;
	const currentValue = (options.value ?? '').trim();

	const selectIcon = (iconId: string) => {
		completed = true;
		options.onSelect(iconId);
		close();
	};

	const moveActiveIndex = (delta: number) => {
		if (matches.length === 0) return;
		activeIndex = clampIndex(activeIndex + delta, matches.length);
		ensureLoadedForIndex(activeIndex);
		render();
	};

	const getVisibleMatches = (): string[] => matches.slice(0, Math.min(loadedCount, matches.length));

	const formatCountLabel = (): string => {
		const visibleCount = Math.min(loadedCount, matches.length);
		const noun = matches.length === 1 ? 'icon' : 'icons';
		return visibleCount < matches.length
			? `${visibleCount} / ${matches.length} ${noun}`
			: `${matches.length} ${noun}`;
	};

	const loadMore = (): boolean => {
		const nextLoadedCount = Math.min(loadedCount + PAGE_SIZE, matches.length);
		if (nextLoadedCount === loadedCount) return false;
		loadedCount = nextLoadedCount;
		return true;
	};

	const ensureLoadedForIndex = (index: number) => {
		const loadAhead = COLUMN_COUNT * LOAD_AHEAD_ROWS;
		const neededCount = Math.min(matches.length, index + 1 + loadAhead);
		if (neededCount <= loadedCount) return;
		loadedCount = Math.min(matches.length, Math.ceil(neededCount / PAGE_SIZE) * PAGE_SIZE);
	};

	const loadMoreIfNearBottom = (): boolean => {
		if (loadedCount >= matches.length) return false;
		const remainingScroll = grid.scrollHeight - grid.scrollTop - grid.clientHeight;
		if (remainingScroll > CELL_HEIGHT + GRID_GAP) return false;
		return loadMore();
	};

	const render = (keepActiveVisible = true) => {
		ensureLoadedForIndex(activeIndex);
		grid.replaceChildren();
		countLabel.textContent = formatCountLabel();
		if (matches.length === 0) {
			grid.classList.add('is-empty');
			return;
		}
		grid.classList.remove('is-empty');
		let activeItemEl: HTMLButtonElement | null = null;

		getVisibleMatches().forEach((iconId, absoluteIndex) => {
			const item = grid.createEl('button');
			item.type = 'button';
			item.className = 'task-board-icon-picker-cell';
			if (absoluteIndex === activeIndex) item.classList.add('is-active');

			const iconWrap = item.createDiv('task-board-icon-picker-icon');
			const icon = getIcon(iconId);
			if (icon) iconWrap.appendChild(icon);

			item.addEventListener('mousemove', () => {
				if (activeIndex === absoluteIndex) return;
				activeIndex = absoluteIndex;
				grid.querySelector('.task-board-icon-picker-cell.is-active')?.classList.remove('is-active');
				item.classList.add('is-active');
			});
			item.addEventListener('click', event => {
				event.preventDefault();
				selectIcon(iconId);
			});
			item.addEventListener('mousedown', event => {
				event.preventDefault();
				selectIcon(iconId);
			});

			grid.appendChild(item);
			if (absoluteIndex === activeIndex) {
				activeItemEl = item;
			}
		});
		if (keepActiveVisible && activeItemEl) {
			const activeRow = Math.floor(activeIndex / COLUMN_COUNT);
			const rowStride = CELL_HEIGHT + GRID_GAP;
			const targetTop = activeRow * rowStride;
			const targetBottom = targetTop + CELL_HEIGHT;
			const visibleTop = grid.scrollTop;
			const visibleBottom = visibleTop + grid.clientHeight;

			if (targetTop < visibleTop) {
				grid.scrollTop = targetTop;
			} else if (targetBottom > visibleBottom) {
				grid.scrollTop = targetBottom - grid.clientHeight;
			}
		}
	};

	const updateMatches = (query: string) => {
		const previousActiveIcon = matches[activeIndex] ?? currentValue;
		matches = searchLucideIcons(query, allIcons);
		loadedCount = PAGE_SIZE;
		if (query.trim().length === 0 && currentValue) {
			const selectedIndex = matches.indexOf(currentValue);
			activeIndex = selectedIndex >= 0 && selectedIndex < loadedCount ? selectedIndex : 0;
		} else {
			const previousIndex = previousActiveIcon ? matches.indexOf(previousActiveIcon) : -1;
			activeIndex = previousIndex >= 0 && previousIndex < loadedCount ? previousIndex : 0;
		}
		render();
	};

	input.addEventListener('input', () => updateMatches(input.value));
	grid.addEventListener('scroll', () => {
		if (loadMoreIfNearBottom()) render(false);
	});
	grid.addEventListener('wheel', event => {
		if (event.deltaY <= 0) return;
		if (!loadMoreIfNearBottom()) return;
		const previousScrollTop = grid.scrollTop;
		event.preventDefault();
		render(false);
		ownerWindow.requestAnimationFrame(() => {
			grid.scrollTop = previousScrollTop + event.deltaY;
		});
	});
	input.addEventListener('keydown', event => {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			moveActiveIndex(COLUMN_COUNT);
			return;
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			moveActiveIndex(-COLUMN_COUNT);
			return;
		}
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			moveActiveIndex(1);
			return;
		}
		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			moveActiveIndex(-1);
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			if (matches[activeIndex]) selectIcon(matches[activeIndex]);
		}
	});

	updateMatches(input.value);
	const focusInput = () => {
		focusFloatingInput(input);
		input.setSelectionRange(input.value.length, input.value.length);
	};
	ownerWindow.requestAnimationFrame(focusInput);
	ownerWindow.setTimeout(focusInput, 0);
	ownerWindow.setTimeout(focusInput, 50);
	return close;
}
