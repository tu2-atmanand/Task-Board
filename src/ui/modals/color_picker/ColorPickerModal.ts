import { Notice, setIcon } from "obsidian";
import { FloatingHostOptions, getFloatingRectAnchorOwner, createFloatingPanel, createButton, focusFloatingInput } from "../../components/Common.js";
import { asHTMLElement, getOwnerWindow } from "../../../utils/DomCompat.js";
import { ColorPaletteEntry, localizeColorPaletteNames } from "./ColorPalette.js";
import { t } from "i18next";
import { setAccessibleLabelWithoutTooltip } from "../../utils/AccessibilityLabel.js";

interface ColorPickerOptions extends FloatingHostOptions {
	value?: string;
	palette?: ColorPaletteEntry[];
	retainInputFocus?: boolean;
	onSelect: (value: string) => void;
	onClear?: () => void;
	onClose?: () => void;
}

interface RgbColor {
	r: number;
	g: number;
	b: number;
}

interface HsvColor {
	h: number;
	s: number;
	v: number;
}

const COLOR_GRID_COLUMNS = 7;
const COLOR_GRID_ROWS = 4;
const TONE_STRIP_SIZE = 7;
const TONE_STRIP_CENTER_INDEX = 3;
const EMPTY_GRID_INDEX = 0;
const CUSTOM_GRID_INDEX = -1;
const TONE_MIXES = [
	{ target: "white", amount: 0.36 },
	{ target: "white", amount: 0.24 },
	{ target: "white", amount: 0.12 },
	{ target: "self", amount: 0 },
	{ target: "black", amount: 0.12 },
	{ target: "black", amount: 0.24 },
	{ target: "black", amount: 0.36 },
] as const;

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function normalizeHex(value: string | null | undefined): string | null {
	const normalized = (value ?? "").trim().replace(/^#/, "");
	if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
	return `#${normalized.toUpperCase()}`;
}

function hexToRgb(hex: string): RgbColor {
	const normalized = hex.replace(/^#/, "");
	return {
		r: Number.parseInt(normalized.slice(0, 2), 16),
		g: Number.parseInt(normalized.slice(2, 4), 16),
		b: Number.parseInt(normalized.slice(4, 6), 16),
	};
}

function componentToHex(value: number): string {
	return clamp(Math.round(value), 0, 255)
		.toString(16)
		.padStart(2, "0")
		.toUpperCase();
}

function rgbToHex(color: RgbColor): string {
	return `#${componentToHex(color.r)}${componentToHex(color.g)}${componentToHex(color.b)}`;
}

function mixRgb(color: RgbColor, target: RgbColor, amount: number): RgbColor {
	return {
		r: color.r + (target.r - color.r) * amount,
		g: color.g + (target.g - color.g) * amount,
		b: color.b + (target.b - color.b) * amount,
	};
}

function buildToneStrip(baseHex: string): string[] {
	const base = hexToRgb(baseHex);
	return TONE_MIXES.map((mix) => {
		if (mix.target === "self") return baseHex;
		const target =
			mix.target === "black"
				? { r: 0, g: 0, b: 0 }
				: { r: 255, g: 255, b: 255 };
		return rgbToHex(mixRgb(base, target, mix.amount));
	});
}

function rgbToHsv(color: RgbColor): HsvColor {
	const r = color.r / 255;
	const g = color.g / 255;
	const b = color.b / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;
	let h = 0;

	if (delta !== 0) {
		if (max === r) {
			h = 60 * (((g - b) / delta) % 6);
		} else if (max === g) {
			h = 60 * ((b - r) / delta + 2);
		} else {
			h = 60 * ((r - g) / delta + 4);
		}
	}

	return {
		h: (h + 360) % 360,
		s: max === 0 ? 0 : delta / max,
		v: max,
	};
}

function hsvToRgb(color: HsvColor): RgbColor {
	const h = ((color.h % 360) + 360) % 360;
	const c = color.v * color.s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = color.v - c;
	let r = 0;
	let g = 0;
	let b = 0;

	if (h < 60) {
		r = c;
		g = x;
	} else if (h < 120) {
		r = x;
		g = c;
	} else if (h < 180) {
		g = c;
		b = x;
	} else if (h < 240) {
		g = x;
		b = c;
	} else if (h < 300) {
		r = x;
		b = c;
	} else {
		r = c;
		b = x;
	}

	return {
		r: (r + m) * 255,
		g: (g + m) * 255,
		b: (b + m) * 255,
	};
}

function hsvToHex(color: HsvColor): string {
	return rgbToHex(hsvToRgb(color));
}

function getQueryMatchIndexes(
	query: string,
	palette: ColorPaletteEntry[],
): number[] {
	const normalized = query.trim().toLowerCase();
	if (!normalized) return [];
	const normalizedHex = normalizeHex(query);
	if (normalizedHex) {
		const hexMatchIndex = palette.findIndex(
			(preset) => normalizeHex(preset.hex) === normalizedHex,
		);
		if (hexMatchIndex >= 0) return [hexMatchIndex];
	}
	const startsWithMatches: number[] = [];
	const includesMatches: number[] = [];
	palette.forEach((preset, index) => {
		const searchable = preset.name.toLowerCase();
		if (searchable.startsWith(normalized)) {
			startsWithMatches.push(index);
		} else if (searchable.includes(normalized)) {
			includesMatches.push(index);
		}
	});
	return [...startsWithMatches, ...includesMatches];
}

function setElementSwatch(element: HTMLElement, hex: string | null): void {
	if (hex) {
		element.style.setProperty("--task-board-color-picker-swatch", hex);
	} else {
		element.style.removeProperty("--task-board-color-picker-swatch");
	}
}

function setToneCellSwatch(element: HTMLElement, hex: string | null): void {
	setElementSwatch(element, hex);
	if (hex) {
		element.style.backgroundColor = hex;
	} else {
		element.style.removeProperty("background-color");
	}
}

export function showColorPicker(
	anchor: HTMLElement | DOMRect,
	options: ColorPickerOptions,
): () => void {
	let completed = false;
	const anchorEl =
		asHTMLElement(anchor) ?? getFloatingRectAnchorOwner(anchor);
	const editor = anchorEl?.closest<HTMLElement>(
		".task-board-task-editor:not(.task-board-task-editor-mobile):not(.task-board-task-editor-phone-desktop):not(.task-board-task-editor-touch-desktop)",
	);
	// Keep the full palette in its owning layer, outside the editor's clipped shell.
	const editorHost = !options.floatingHost
		? editor?.closest<HTMLElement>(
				".task-board-task-workspace, .task-board-task-editor-modal-container",
			)
		: null;
	const colorPresets = localizeColorPaletteNames(options.palette);
	const { panel, close } = createFloatingPanel(
		anchor,
		"task-board-floating-panel task-board-color-picker-panel",
		() => {
			if (!completed) options.onClose?.();
		},
		{
			floatingHost: options.floatingHost ?? editorHost ?? undefined,
			floatingScrollHost:
				options.floatingScrollHost ??
				(editorHost
					? (anchorEl?.closest<HTMLElement>(
							".task-board-task-editor-main-panel",
						) ?? getOwnerWindow(editorHost))
					: undefined),
			constrainToFloatingHost:
				options.constrainToFloatingHost ??
				(editorHost ? true : undefined),
			retainInputFocus: options.retainInputFocus,
		},
	);
	const ownerWindow = getOwnerWindow(panel);
	if (editorHost && editor) {
		const accent = ownerWindow
			.getComputedStyle(editor)
			.getPropertyValue("--task-board-task-editor-accent")
			.trim();
		if (accent)
			panel.style.setProperty("--task-board-task-editor-accent", accent);
	}

	const input = panel.createEl("input");
	input.type = "text";
	input.className = "task-board-floating-input task-board-color-picker-search";
	input.placeholder = t("taskEditor", "searchColor");
	setAccessibleLabelWithoutTooltip(input, t("taskEditor", "searchColor"));

	const toneStrip = panel.createDiv("task-board-color-picker-tone-strip");

	const body = panel.createDiv("task-board-color-picker-body");
	const paletteColumn = body.createDiv("task-board-color-picker-palette-column");

	const grid = paletteColumn.createDiv("task-board-color-picker-grid");
	grid.setAttribute("role", "grid");

	const customColumn = body.createDiv("task-board-color-picker-custom-column");
	const freePlane = customColumn.createDiv("task-board-color-picker-free-plane");
	freePlane.tabIndex = 0;
	freePlane.setAttribute("role", "application");
	setAccessibleLabelWithoutTooltip(freePlane, t("taskEditor", "customColor"));
	const freeHandle = freePlane.createSpan("task-board-color-picker-free-handle");
	const freeEmpty = freePlane.createDiv("task-board-color-picker-free-empty");
	freeEmpty.textContent = t("taskEditor", "noColorSelected");

	const hueSliderWrap = customColumn.createDiv(
		"task-board-color-picker-hue-control",
	);
	hueSliderWrap.tabIndex = 0;
	hueSliderWrap.setAttribute("role", "slider");
	hueSliderWrap.setAttribute("aria-valuemin", "0");
	hueSliderWrap.setAttribute("aria-valuemax", "359");
	setAccessibleLabelWithoutTooltip(
		hueSliderWrap,
		t("taskEditor", "colorHue"),
	);
	const hueHandle = hueSliderWrap.createSpan(
		"task-board-color-picker-hue-handle",
	);
	const hueSlider = hueSliderWrap.createEl("input", {
		cls: "task-board-color-picker-hue-slider",
		attr: {
			type: "range",
			min: "0",
			max: "359",
			step: "1",
		},
	});
	hueSlider.tabIndex = -1;
	hueSlider.setAttribute("aria-hidden", "true");

	const footer = customColumn.createDiv("task-board-color-picker-footer");
	const actions = footer.createDiv(
		"task-board-floating-actions task-board-color-picker-actions",
	);
	let clearButton: HTMLButtonElement | null = null;
	if (options.onClear) {
		clearButton = createButton(
			t("buttons", "clear"),
			"task-board-floating-btn is-secondary",
			actions,
		);
		clearButton.addEventListener("click", () => {
			completed = true;
			options.onClear?.();
			close();
		});
		actions.appendChild(clearButton);
	}

	const copyButton = actions.createEl("button", {
		cls: "task-board-color-picker-copy",
		attr: { type: "button" },
	});
	setIcon(copyButton, "copy");
	setAccessibleLabelWithoutTooltip(
		copyButton,
		t("taskEditor", "copyColorHex"),
	);

	const chooseButton = createButton(
		t("buttons", "choose"),
		"task-board-floating-btn task-board-color-picker-choose",
		actions,
	);
	chooseButton.addEventListener("click", () => {
		commitActiveHex();
	});
	actions.appendChild(chooseButton);

	let baseHex = normalizeHex(options.value);
	let selectedPresetIndex = baseHex
		? findPresetIndexByHex(baseHex)
		: CUSTOM_GRID_INDEX;
	let activeGridIndex =
		selectedPresetIndex >= 0
			? selectedPresetIndex
			: baseHex
				? CUSTOM_GRID_INDEX
				: EMPTY_GRID_INDEX;
	let activeHex = baseHex;
	let activeStripIndex = baseHex ? TONE_STRIP_CENTER_INDEX : -1;
	let isDraggingFreePlane = false;
	let isDraggingHue = false;
	let freeHue = baseHex ? rgbToHsv(hexToRgb(baseHex)).h : 0;
	let stripButtons: HTMLButtonElement[] = [];
	let gridButtons: HTMLButtonElement[] = [];

	function getToneValues(): string[] {
		return baseHex ? buildToneStrip(baseHex) : [];
	}

	function updateBaseColor(hex: string, presetIndex: number): void {
		const normalized = normalizeHex(hex);
		if (!normalized) return;
		baseHex = normalized;
		activeHex = normalized;
		activeStripIndex = TONE_STRIP_CENTER_INDEX;
		selectedPresetIndex = presetIndex;
		freeHue = rgbToHsv(hexToRgb(normalized)).h;
	}

	function previewPresetInStrip(index: number): void {
		const presetIndex = clamp(index, 0, colorPresets.length - 1);
		activeGridIndex = presetIndex;
		updateBaseColor(colorPresets[presetIndex].hex, presetIndex);
	}

	function findPresetIndexByHex(hex: string): number {
		const normalized = normalizeHex(hex);
		if (!normalized) return CUSTOM_GRID_INDEX;
		return colorPresets.findIndex(
			(preset) => normalizeHex(preset.hex) === normalized,
		);
	}

	function previewTypedHexInput(): boolean {
		const normalized = normalizeHex(input.value);
		if (!normalized) return false;
		const presetIndex = findPresetIndexByHex(normalized);
		baseHex = normalized;
		activeHex = normalized;
		activeStripIndex = TONE_STRIP_CENTER_INDEX;
		selectedPresetIndex = presetIndex;
		activeGridIndex = presetIndex >= 0 ? presetIndex : CUSTOM_GRID_INDEX;
		freeHue = rgbToHsv(hexToRgb(normalized)).h;
		return true;
	}

	function commitActiveHex(): void {
		if (input.value.trim() && !previewSearchInput()) return;
		const normalized = normalizeHex(activeHex);
		if (!normalized) return;
		completed = true;
		options.onSelect(normalized.replace(/^#/, ""));
		close();
	}

	function commitManualActiveHex(): void {
		clearSearchForManualColor(false);
		commitActiveHex();
	}

	function focusSearchInput(): void {
		focusFloatingInput(input);
		input.setSelectionRange(input.value.length, input.value.length);
	}

	function focusActiveStripCell(): void {
		if (!baseHex) {
			focusActiveGridCell();
			return;
		}
		activeStripIndex = clamp(activeStripIndex, 0, TONE_STRIP_SIZE - 1);
		render();
		const activeButton = stripButtons[activeStripIndex];
		if (activeButton) focusFloatingInput(activeButton);
	}

	function moveStrip(delta: number, focusStrip = true): void {
		if (!baseHex) return;
		clearSearchForManualColor(false);
		const tones = getToneValues();
		activeStripIndex = clamp(
			activeStripIndex >= 0
				? activeStripIndex + delta
				: TONE_STRIP_CENTER_INDEX + delta,
			0,
			TONE_STRIP_SIZE - 1,
		);
		activeHex = tones[activeStripIndex] ?? baseHex;
		render();
		if (focusStrip) {
			const activeButton = stripButtons[activeStripIndex];
			if (activeButton) focusFloatingInput(activeButton);
		}
	}

	function focusActiveGridCell(): void {
		activeGridIndex = clamp(activeGridIndex, 0, colorPresets.length - 1);
		previewPresetInStrip(activeGridIndex);
		render();
		const activeButton = gridButtons[activeGridIndex];
		if (activeButton) focusFloatingInput(activeButton);
	}

	function focusGridCellWithoutPreview(index: number): void {
		activeGridIndex = clamp(index, 0, colorPresets.length - 1);
		render();
		const activeButton = gridButtons[activeGridIndex];
		if (activeButton) focusFloatingInput(activeButton);
	}

	function centerPresetInStrip(index: number): void {
		clearSearchForManualColor(false);
		previewPresetInStrip(index);
		focusActiveStripCell();
	}

	function clearSearchForManualColor(resetGridIndex = true): void {
		if (!input.value) return;
		input.value = "";
		if (resetGridIndex) activeGridIndex = EMPTY_GRID_INDEX;
	}

	function copyActiveHex(): void {
		const normalized = normalizeHex(activeHex);
		if (!normalized) return;
		const clipboard = navigator.clipboard;
		if (!clipboard?.writeText) {
			new Notice(t("notifications", "clipboardWriteFailed"));
			return;
		}
		void clipboard
			.writeText(normalized)
			.then(() => {
				new Notice(t("notifications", "colorHexCopied"));
			})
			.catch(() => {
				new Notice(t("notifications", "clipboardWriteFailed"));
			});
	}

	function getRegisteredColorName(hex: string): string | null {
		const normalized = normalizeHex(hex);
		if (!normalized) return null;
		if (selectedPresetIndex >= 0) {
			const selectedPreset = colorPresets[selectedPresetIndex];
			if (
				selectedPreset &&
				normalizeHex(selectedPreset.hex) === normalized
			)
				return selectedPreset.name;
		}
		return (
			colorPresets.find(
				(preset) => normalizeHex(preset.hex) === normalized,
			)?.name ?? null
		);
	}

	function getToneCellLabel(toneHex: string, index: number): string {
		if (index === TONE_STRIP_CENTER_INDEX) {
			return getRegisteredColorName(toneHex) ?? toneHex;
		}
		return toneHex;
	}

	function renderToneStrip(): void {
		toneStrip.replaceChildren();
		stripButtons = [];
		const tones = getToneValues();
		const hasTones = tones.length > 0;
		toneStrip.classList.toggle("is-empty", !hasTones);
		toneStrip.style.gridTemplateColumns = Array.from(
			{ length: TONE_STRIP_SIZE },
			(_, index) =>
				hasTones && index === activeStripIndex ? "2fr" : "1fr",
		).join(" ");

		for (let index = 0; index < TONE_STRIP_SIZE; index++) {
			const toneHex = tones[index] ?? null;
			const button = toneStrip.createEl("button", {
				cls: "task-board-color-picker-tone-cell",
				attr: { type: "button" },
			});
			button.disabled = !toneHex;
			setToneCellSwatch(button, toneHex);
			if (toneHex) {
				setAccessibleLabelWithoutTooltip(
					button,
					`${t("taskEditor", "colorToneStrip")} ${index + 1}: ${toneHex}`,
				);
			}
			if (toneHex && index === activeStripIndex) {
				button.classList.add("is-active");
				button.createSpan({
					cls: "task-board-color-picker-tone-hex",
					text: getToneCellLabel(toneHex, index),
				});
			}
			if (index === TONE_STRIP_CENTER_INDEX) {
				button.classList.add("is-center");
			}
			button.addEventListener("click", (event) => {
				event.preventDefault();
				if (!toneHex) return;
				activeStripIndex = index;
				activeHex = toneHex;
				commitManualActiveHex();
			});
			button.addEventListener("keydown", (event) => {
				handleStripKeydown(event);
			});
			stripButtons.push(button);
		}
	}

	function renderGrid(): void {
		grid.replaceChildren();
		gridButtons = [];
		const matchIndexes = getQueryMatchIndexes(input.value, colorPresets);
		const matchSet = new Set(matchIndexes);
		const hasQuery = input.value.trim().length > 0;

		colorPresets.forEach((preset, index) => {
			const button = grid.createEl("button", {
				cls: "task-board-color-picker-grid-cell",
				attr: { type: "button", role: "gridcell" },
			});
			setElementSwatch(button, preset.hex);
			button.style.setProperty(
				"--task-board-color-picker-cell-accent",
				preset.hex,
			);
			setAccessibleLabelWithoutTooltip(
				button,
				`${preset.name} ${preset.hex}`,
			);
			button.classList.toggle("is-active", index === activeGridIndex);
			button.classList.toggle(
				"is-selected",
				index === selectedPresetIndex,
			);
			button.classList.toggle(
				"is-match",
				hasQuery && matchSet.has(index),
			);

			const swatch = button.createSpan("task-board-color-picker-grid-swatch");
			setElementSwatch(swatch, preset.hex);

			button.addEventListener("click", (event) => {
				event.preventDefault();
				centerPresetInStrip(index);
			});
			button.addEventListener("mousemove", () => {
				if (activeGridIndex === index) return;
				gridButtons[activeGridIndex]?.classList.remove("is-active");
				activeGridIndex = index;
				button.classList.add("is-active");
			});
			button.addEventListener("keydown", (event) => {
				handleGridKeydown(event);
			});
			gridButtons.push(button);
		});
	}

	function renderFreePlane(): void {
		const normalized = normalizeHex(baseHex);
		freePlane.classList.toggle("is-disabled", !normalized);
		freeHandle.classList.toggle("is-hidden", !normalized);
		freeEmpty.classList.toggle("is-hidden", !!normalized);
		if (!normalized) {
			freePlane.style.removeProperty("--task-board-color-picker-free-hue");
			freePlane.style.removeProperty("--task-board-color-picker-free-x");
			freePlane.style.removeProperty("--task-board-color-picker-free-y");
			return;
		}
		const hsv = rgbToHsv(hexToRgb(normalized));
		freeHue = hsv.s > 0.02 ? hsv.h : freeHue;
		freePlane.style.setProperty(
			"--task-board-color-picker-free-hue",
			`${Math.round(freeHue)}deg`,
		);
		freePlane.style.setProperty(
			"--task-board-color-picker-free-x",
			`${Math.round(hsv.s * 100)}%`,
		);
		freePlane.style.setProperty(
			"--task-board-color-picker-free-y",
			`${Math.round((1 - hsv.v) * 100)}%`,
		);
	}

	function renderFooter(): void {
		const normalized = normalizeHex(activeHex);
		const canUseActiveHex = !!normalized && isSearchInputCommitCandidate();
		copyButton.disabled = !canUseActiveHex;
		chooseButton.disabled = !canUseActiveHex;
		hueSlider.disabled = false;
		hueSlider.value = String(Math.round(freeHue));
		hueSliderWrap.classList.remove("is-disabled");
		hueSliderWrap.style.setProperty(
			"--task-board-color-picker-hue-x",
			`${Math.round((freeHue / 359) * 100)}%`,
		);
		hueSliderWrap.setAttribute(
			"aria-valuenow",
			String(Math.round(freeHue)),
		);
		hueSliderWrap.setAttribute(
			"aria-valuetext",
			`${Math.round(freeHue)} degrees`,
		);
		hueHandle.removeAttribute("hidden");
	}

	function render(): void {
		renderToneStrip();
		renderGrid();
		renderFreePlane();
		renderFooter();
	}

	function getSearchTargetIndex(): number {
		const matchIndexes = getQueryMatchIndexes(input.value, colorPresets);
		if (matchIndexes.length > 0) return matchIndexes[0];
		return clamp(activeGridIndex, 0, colorPresets.length - 1);
	}

	function isSearchInputCommitCandidate(): boolean {
		const query = input.value.trim();
		if (!query) return true;
		if (normalizeHex(query)) return true;
		return getQueryMatchIndexes(query, colorPresets).length > 0;
	}

	function handleSearchKeydown(event: KeyboardEvent): void {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			if (input.value.trim() && previewSearchInput() && baseHex) {
				focusActiveStripCell();
				return;
			}
			if (baseHex) {
				focusActiveStripCell();
				return;
			}
			activeGridIndex = getSearchTargetIndex();
			focusActiveGridCell();
			return;
		}

		if (event.key === "Enter") {
			if (input.value.trim() && !previewSearchInput()) return;
			if (!normalizeHex(activeHex)) return;
			event.preventDefault();
			commitActiveHex();
		}
	}

	function handleStripKeydown(event: KeyboardEvent): void {
		if (!baseHex) return;
		if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
			event.preventDefault();
			moveStrip(event.key === "ArrowRight" ? 1 : -1);
			return;
		}

		if (event.key === "ArrowDown") {
			event.preventDefault();
			if (selectedPresetIndex >= 0) {
				activeGridIndex = selectedPresetIndex;
				focusActiveGridCell();
			} else {
				focusGridCellWithoutPreview(EMPTY_GRID_INDEX);
			}
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			focusSearchInput();
			return;
		}

		if (event.key === "Enter") {
			event.preventDefault();
			commitManualActiveHex();
		}
	}

	function moveGridTo(index: number): void {
		activeGridIndex = clamp(index, 0, colorPresets.length - 1);
		focusActiveGridCell();
	}

	function moveGridColumn(delta: number): void {
		const row = activeGridIndex % COLOR_GRID_ROWS;
		const column = Math.floor(activeGridIndex / COLOR_GRID_ROWS);
		const nextColumn = clamp(column + delta, 0, COLOR_GRID_COLUMNS - 1);
		moveGridTo(nextColumn * COLOR_GRID_ROWS + row);
	}

	function moveGridRow(delta: number): void {
		const row = activeGridIndex % COLOR_GRID_ROWS;
		const nextRow = clamp(row + delta, 0, COLOR_GRID_ROWS - 1);
		const columnStartIndex = activeGridIndex - row;
		moveGridTo(columnStartIndex + nextRow);
	}

	function handleGridKeydown(event: KeyboardEvent): void {
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			moveGridColumn(-1);
			return;
		}

		if (event.key === "ArrowRight") {
			event.preventDefault();
			moveGridColumn(1);
			return;
		}

		if (event.key === "ArrowDown") {
			event.preventDefault();
			moveGridRow(1);
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			if (activeGridIndex % COLOR_GRID_ROWS === 0) {
				focusActiveStripCell();
				return;
			}
			moveGridRow(-1);
			return;
		}

		if (event.key === "Enter") {
			event.preventDefault();
			centerPresetInStrip(activeGridIndex);
		}
	}

	function updateGridMatchFromSearch(): void {
		previewSearchInput();
		render();
	}

	function previewSearchInput(): boolean {
		if (previewTypedHexInput()) return true;
		return previewBestSearchMatch();
	}

	function previewBestSearchMatch(): boolean {
		const matchIndexes = getQueryMatchIndexes(input.value, colorPresets);
		if (input.value.trim() && matchIndexes.length > 0) {
			previewPresetInStrip(matchIndexes[0]);
			return true;
		}
		return !input.value.trim();
	}

	function updateFreeColorFromPointer(event: PointerEvent): void {
		if (!baseHex) return;
		clearSearchForManualColor();
		const rect = freePlane.getBoundingClientRect();
		const saturation = clamp(
			(event.clientX - rect.left) / rect.width,
			0,
			1,
		);
		const value = clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1);
		const hex = hsvToHex({ h: freeHue, s: saturation, v: value });
		baseHex = hex;
		activeHex = hex;
		activeStripIndex = TONE_STRIP_CENTER_INDEX;
		selectedPresetIndex = -1;
		render();
		focusFloatingInput(freePlane);
	}

	function updateHueFromSlider(): void {
		clearSearchForManualColor();
		freeHue = Number(hueSlider.value);
		const hsv = baseHex
			? rgbToHsv(hexToRgb(baseHex))
			: { h: freeHue, s: 1, v: 1 };
		const hex = hsvToHex({
			h: freeHue,
			s: hsv.s > 0.02 ? hsv.s : 1,
			v: hsv.v > 0.02 ? hsv.v : 1,
		});
		baseHex = hex;
		activeHex = hex;
		activeStripIndex = TONE_STRIP_CENTER_INDEX;
		selectedPresetIndex = -1;
		render();
	}

	function setHueFromControl(value: number): void {
		const nextHue = Math.round(((value % 360) + 360) % 360);
		hueSlider.value = String(nextHue);
		updateHueFromSlider();
	}

	function updateHueFromPointer(event: PointerEvent): void {
		const rect = hueSliderWrap.getBoundingClientRect();
		const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
		setHueFromControl(ratio * 359);
	}

	input.addEventListener("input", updateGridMatchFromSearch);
	input.addEventListener("keydown", (event) => {
		handleSearchKeydown(event);
	});

	copyButton.addEventListener("click", copyActiveHex);
	hueSlider.addEventListener("input", updateHueFromSlider);

	hueSliderWrap.addEventListener("pointerdown", (event) => {
		event.preventDefault();
		isDraggingHue = true;
		hueSliderWrap.setPointerCapture(event.pointerId);
		updateHueFromPointer(event);
	});
	hueSliderWrap.addEventListener("pointermove", (event) => {
		if (!isDraggingHue) return;
		event.preventDefault();
		updateHueFromPointer(event);
	});
	hueSliderWrap.addEventListener("pointerup", (event) => {
		isDraggingHue = false;
		if (hueSliderWrap.hasPointerCapture(event.pointerId)) {
			hueSliderWrap.releasePointerCapture(event.pointerId);
		}
	});
	hueSliderWrap.addEventListener("pointercancel", (event) => {
		isDraggingHue = false;
		if (hueSliderWrap.hasPointerCapture(event.pointerId)) {
			hueSliderWrap.releasePointerCapture(event.pointerId);
		}
	});
	hueSliderWrap.addEventListener("keydown", (event) => {
		if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
			event.preventDefault();
			setHueFromControl(freeHue - 1);
			return;
		}
		if (event.key === "ArrowRight" || event.key === "ArrowUp") {
			event.preventDefault();
			setHueFromControl(freeHue + 1);
			return;
		}
		if (event.key === "PageDown") {
			event.preventDefault();
			setHueFromControl(freeHue - 15);
			return;
		}
		if (event.key === "PageUp") {
			event.preventDefault();
			setHueFromControl(freeHue + 15);
			return;
		}
		if (event.key === "Home") {
			event.preventDefault();
			setHueFromControl(0);
			return;
		}
		if (event.key === "End") {
			event.preventDefault();
			setHueFromControl(359);
			return;
		}
		if (event.key === "Enter") {
			event.preventDefault();
			commitManualActiveHex();
		}
	});

	freePlane.addEventListener("pointerdown", (event) => {
		if (!baseHex) return;
		event.preventDefault();
		isDraggingFreePlane = true;
		freePlane.setPointerCapture(event.pointerId);
		updateFreeColorFromPointer(event);
	});
	freePlane.addEventListener("pointermove", (event) => {
		if (!isDraggingFreePlane) return;
		event.preventDefault();
		updateFreeColorFromPointer(event);
	});
	freePlane.addEventListener("pointerup", (event) => {
		isDraggingFreePlane = false;
		if (freePlane.hasPointerCapture(event.pointerId)) {
			freePlane.releasePointerCapture(event.pointerId);
		}
	});
	freePlane.addEventListener("pointercancel", (event) => {
		isDraggingFreePlane = false;
		if (freePlane.hasPointerCapture(event.pointerId)) {
			freePlane.releasePointerCapture(event.pointerId);
		}
	});
	freePlane.addEventListener("keydown", (event) => {
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			focusActiveStripCell();
			return;
		}
		if (event.key === "Enter") {
			event.preventDefault();
			commitManualActiveHex();
		}
	});

	render();
	const focusSearch = () => {
		if (!panel.isConnected) return;
		focusSearchInput();
	};
	ownerWindow.requestAnimationFrame(focusSearch);
	ownerWindow.setTimeout(focusSearch, 0);
	ownerWindow.setTimeout(focusSearch, 50);

	return close;
}
