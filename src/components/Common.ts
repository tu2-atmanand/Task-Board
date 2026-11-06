// import { isSettingsScope, setSettingsScope } from "../settings/settings-scope";
import { App } from "obsidian";
import {
	getOwnerWindow,
	asHTMLElement,
	getActiveWindow,
	getOwnerBody,
	getActiveDocument,
	createOwnerElement,
	getOwnerDocument,
} from "../utils/dom-compat.js";
import { getWindowApp } from "../services/ObsidianApp.js";

/**
 * Track native board transforms without reading or writing their data models.
 **/
export function observeTaskCardAnchor(
	anchor: HTMLElement,
	changed: () => void,
): () => void {
	const canvas = anchor.closest<HTMLElement>(
		".canvas-wrapper, .canvas, .excalidraw",
	);
	if (!canvas) return () => undefined;
	let win = getOwnerWindow(anchor) as Window & {
		MutationObserver: typeof MutationObserver;
		ResizeObserver: typeof ResizeObserver;
	};
	let frame = 0,
		closed = false;
	let observer: MutationObserver, resize: ResizeObserver;
	const schedule = (): void => {
		if (!closed && !frame)
			frame = win.requestAnimationFrame(() => {
				frame = 0;
				if (!closed) changed();
			});
	};
	const bind = (): void => {
		observer = new win.MutationObserver(schedule);
		observer.observe(canvas, {
			attributes: true,
			attributeFilter: ["style", "class"],
			childList: true,
			subtree: true,
		});
		resize = new win.ResizeObserver(schedule);
		resize.observe(anchor);
	};
	bind();
	const stopMigration = anchor.onWindowMigrated?.(() => {
		const next = getOwnerWindow(anchor) as typeof win;
		if (closed || next === win) return;
		const pending = !!frame;
		observer.disconnect();
		resize.disconnect();
		if (frame) win.cancelAnimationFrame(frame);
		frame = 0;
		win = next;
		bind();
		if (pending) schedule();
	});
	return () => {
		if (closed) return;
		closed = true;
		stopMigration?.();
		observer.disconnect();
		resize.disconnect();
		if (frame) win.cancelAnimationFrame(frame);
		frame = 0;
	};
}

export interface FloatingPanel {
	panel: HTMLElement;
	close: () => void;
}

export type FloatingPanelCloseReason =
	| "outside"
	| "escape"
	| "window-blur"
	| "window-resize"
	| "anchor-detach";

interface FloatingPanelRecord {
	getAnchorOwner: () => HTMLElement | null;
	reanchor: (anchor: HTMLElement | DOMRect) => void;
	panel: HTMLElement;
	anchorEl: HTMLElement | null;
	close: () => void;
	requestClose: (reason: FloatingPanelCloseReason) => boolean;
}

export interface FloatingHostOptions {
	/** Opt-in for Filter Editor grouping/sorting: local coordinates clipped to the viewport. */
	fitToHostViewport?: boolean;
	floatingHost?: HTMLElement;
	floatingScrollHost?: HTMLElement | Window;
	constrainToFloatingHost?: boolean;
}

export interface FloatingPositionOptions extends FloatingHostOptions {
	gap?: number;
	margin?: number;
	matchWidth?: number;
}

export interface FloatingPanelOptions extends FloatingHostOptions {
	retainInputFocus?: boolean;
	focusInputSelector?: string;
	outsideClickExclusions?:
		| readonly HTMLElement[]
		| (() => readonly HTMLElement[]);
	closeOnWindowResize?: boolean;
	matchWidth?: number;
	repositionOnWindowResize?: boolean;
	repositionOnPanelResize?: boolean;
	repositionOnScroll?: boolean;
	shouldClose?: (reason: FloatingPanelCloseReason) => boolean;
	shouldHandleEscape?: (event: KeyboardEvent) => boolean;
}

export interface PickerListItemActivationOptions {
	stopPropagation?: boolean;
}

interface FloatingHostContext {
	host: HTMLElement;
	constrainToHost: boolean;
	scrollHost: HTMLElement | Window;
}

const activeFloatingPanels = new Set<FloatingPanelRecord>();
const FLOATING_RECT_ANCHOR_OWNER = Symbol("task-board-floating-rect-anchor-owner");
const FLOATING_RECT_CURRENT = Symbol("task-board-floating-rect-current");
export const MOBILE_PICKER_OPEN_EVENT = "task-board-mobile-picker-open";
export const MOBILE_PICKER_CLOSE_EVENT = "task-board-mobile-picker-close";
export const TASK_EDITOR_MOBILE_PICKER_OPEN_EVENT =
	"task-board-task-editor-mobile-picker-open";
export const TASK_EDITOR_MOBILE_PICKER_CLOSE_EVENT =
	"task-board-task-editor-mobile-picker-close";
const TASK_EDITOR_MOBILE_SURFACE_MIN_WIDTH = 180;
const TASK_CREATOR_MOBILE_SURFACE_MIN_WIDTH = 180;


const TASK_EDITOR_MOBILE_DESCRIPTION_SELECTOR =
	".task-board-task-editor-mobile-description";
const TASK_EDITOR_MOBILE_CORE_TOOLBAR_SELECTOR =
	".task-board-task-editor-mobile-core-toolbar";
const TASK_CREATOR_MOBILE_ROOT_SELECTOR = ".task-board-task-creator";
const TASK_CREATOR_MOBILE_MODAL_SELECTOR = ".task-board-task-creator-modal-mobile";
const TASK_CREATOR_MOBILE_TOOLBAR_SELECTOR = ".task-board-task-creator-toolbar";
const TASK_CREATOR_MOBILE_ACTION_ROW_SELECTOR =
	".task-board-task-creator-action-row";

interface MobilePickerSurfaceContext {
	kind: "task-editor" | "task-creator";
	root: HTMLElement;
	panelHost: HTMLElement;
	surfaceClass: string;
	openEvents: string[];
	closeEvents: string[];
}

type OwnedFloatingRect = DOMRect & {
	[FLOATING_RECT_CURRENT]?: () => DOMRect;
	[FLOATING_RECT_ANCHOR_OWNER]?: HTMLElement;
};

/**
 * Keeps scroll gestures on mobile list pickers from being treated as item selections.
 * Mouse selection remains eager so desktop pickers retain their current focus behavior.
 */
export function bindPickerListItemActivation(
	item: HTMLElement,
	onActivate: () => void,
	options: PickerListItemActivationOptions = {},
): void {
	let nonMousePointerStarted = false;
	let mouseActivationHandled = false;
	const consume = (event: Event): void => {
		event.preventDefault();
		if (options.stopPropagation) event.stopPropagation();
	};

	item.addEventListener("pointerdown", (event) => {
		if (event.pointerType !== "mouse") {
			nonMousePointerStarted = true;
			return;
		}
		mouseActivationHandled = true;
		consume(event);
		onActivate();
	});

	item.addEventListener("mousedown", (event) => {
		if (nonMousePointerStarted) return;
		consume(event);
		if (mouseActivationHandled) return;
		mouseActivationHandled = true;
		onActivate();
	});

	item.addEventListener("click", (event) => {
		if (mouseActivationHandled && event.detail > 0) {
			consume(event);
			return;
		}
		consume(event);
		onActivate();
	});
}

function isEditablePanelFocus(
	element: Element | null,
	panel: HTMLElement,
): boolean {
	const htmlElement = asHTMLElement(element, panel);
	if (!htmlElement || !panel.contains(htmlElement)) return false;
	return htmlElement.matches(
		'input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]',
	);
}

function getTaskEditorMobileRoot(
	anchorEl: HTMLElement | null,
): HTMLElement | null {
	return asHTMLElement(
		anchorEl?.closest(
			".task-board-task-editor-mobile, .task-board-task-editor-phone-desktop, .task-board-task-editor-touch-desktop",
		) ?? null,
		anchorEl,
	);
}

function shouldUseTaskEditorMobileSurface(
	anchorEl: HTMLElement | null,
	options: FloatingHostOptions = {},
): boolean {
	return !options.floatingHost && getTaskEditorMobileRoot(anchorEl) != null;
}

function getTaskEditorMobilePanelHost(
	root: HTMLElement | null,
	fallback: HTMLElement,
): HTMLElement {
	return (
		asHTMLElement(
			root?.closest(".task-board-task-editor-modal, .modal") ?? null,
			root,
		) ?? fallback
	);
}

function getTaskCreatorMobileRoot(
	anchorEl: HTMLElement | null,
): HTMLElement | null {
	const root = asHTMLElement(
		anchorEl?.closest(TASK_CREATOR_MOBILE_ROOT_SELECTOR) ?? null,
		anchorEl,
	);
	if (!root) return null;
	return root.closest(TASK_CREATOR_MOBILE_MODAL_SELECTOR) ? root : null;
}

function getTaskCreatorMobilePanelHost(
	root: HTMLElement | null,
	fallback: HTMLElement,
): HTMLElement {
	return (
		asHTMLElement(
			root?.closest(".task-board-task-creator-modal, .modal") ?? null,
			root,
		) ?? fallback
	);
}

function getMobilePickerSurfaceContext(
	anchorEl: HTMLElement | null,
	options: FloatingHostOptions,
	fallbackHost: HTMLElement,
): MobilePickerSurfaceContext | null {
	if (shouldUseTaskEditorMobileSurface(anchorEl, options)) {
		const root = getTaskEditorMobileRoot(anchorEl);
		if (!root) return null;
		return {
			kind: "task-editor",
			root,
			panelHost: getTaskEditorMobilePanelHost(root, fallbackHost),
			surfaceClass: root.matches(
				".task-board-task-editor-phone-desktop, .task-board-task-editor-touch-desktop",
			)
				? "task-board-task-editor-phone-desktop-picker-surface"
				: "task-board-task-editor-mobile-picker-surface",
			openEvents: [
				MOBILE_PICKER_OPEN_EVENT,
				TASK_EDITOR_MOBILE_PICKER_OPEN_EVENT,
			],
			closeEvents: [
				MOBILE_PICKER_CLOSE_EVENT,
				TASK_EDITOR_MOBILE_PICKER_CLOSE_EVENT,
			],
		};
	}

	if (!options.floatingHost) {
		const root = getTaskCreatorMobileRoot(anchorEl);
		if (root) {
			return {
				kind: "task-creator",
				root,
				panelHost: getTaskCreatorMobilePanelHost(root, fallbackHost),
				surfaceClass: "task-board-task-creator-mobile-picker-surface",
				openEvents: [MOBILE_PICKER_OPEN_EVENT],
				closeEvents: [MOBILE_PICKER_CLOSE_EVENT],
			};
		}
	}

	return null;
}

function dispatchMobilePickerEvent(
	context: MobilePickerSurfaceContext | null,
	eventNames: string[],
): void {
	if (!context) return;
	for (const eventName of eventNames) {
		context.root.dispatchEvent(
			new CustomEvent(eventName, { bubbles: true }),
		);
	}
}

export function snapshotFloatingRectAnchor(anchorEl: HTMLElement): DOMRect {
	const rect = anchorEl.getBoundingClientRect();
	const DOMRectCtor = (
		getOwnerWindow(anchorEl) as unknown as { DOMRect: typeof DOMRect }
	).DOMRect;
	const snapshot = new DOMRectCtor(
		rect.x,
		rect.y,
		rect.width,
		rect.height,
	) as OwnedFloatingRect;
	const card = anchorEl.closest<HTMLElement>(".task-board-task-card-embed");
	Object.defineProperty(snapshot, FLOATING_RECT_ANCHOR_OWNER, {
		value: card ?? anchorEl,
	});
	if (card) {
		const initial = card.getBoundingClientRect();
		const initialScale =
			card.offsetWidth > 0 ? initial.width / card.offsetWidth : 1;
		const scale = initialScale > 0 ? initialScale : 1;
		Object.defineProperty(snapshot, FLOATING_RECT_CURRENT, {
			value: () => {
				if (anchorEl.isConnected)
					return anchorEl.getBoundingClientRect();
				const current = card.getBoundingClientRect();
				const nextScale =
					card.offsetWidth > 0
						? current.width / card.offsetWidth
						: scale;
				const ratio = nextScale / scale;
				return new DOMRectCtor(
					current.left + (rect.left - initial.left) * ratio,
					current.top + (rect.top - initial.top) * ratio,
					rect.width * ratio,
					rect.height * ratio,
				);
			},
		});
	}
	return snapshot;
}

export function getFloatingRectAnchorOwner(
	anchor: HTMLElement | DOMRect,
): HTMLElement | null {
	return (anchor as OwnedFloatingRect)[FLOATING_RECT_ANCHOR_OWNER] ?? null;
}

export function resolvePickerApp(
	anchor: HTMLElement | DOMRect,
	app?: App,
): App | undefined {
	if (app) return app;
	const anchorOwnerEl =
		asHTMLElement(anchor) ?? getFloatingRectAnchorOwner(anchor);
	return getWindowApp(
		anchorOwnerEl ? getOwnerWindow(anchorOwnerEl) : getActiveWindow(),
	);
}

function resolveRect(anchor: HTMLElement | DOMRect): DOMRect {
	const anchorEl = asHTMLElement(anchor);
	if (anchorEl) return anchorEl.getBoundingClientRect();
	return (
		(anchor as OwnedFloatingRect)[FLOATING_RECT_CURRENT]?.() ??
		(anchor as DOMRect)
	);
}

export function resolveSurfaceFloatingHostOptions(
	anchorEl: HTMLElement,
): FloatingHostOptions {
	const lightboxHost = asHTMLElement(
		anchorEl.closest(".task-board-native-lightbox-host"),
		anchorEl,
	);
	if (lightboxHost)
		return {
			floatingHost: lightboxHost,
			floatingScrollHost: getOwnerWindow(lightboxHost),
			constrainToFloatingHost: true,
		};
	const pagePreviewHost = asHTMLElement(
		anchorEl.closest(".hover-popover, .popover.hover-popover"),
		anchorEl,
	);
	if (!pagePreviewHost) {
		const excalidraw = anchorEl
			.closest("[data-task-board-task-card-excalidraw]")
			?.closest(".view-content");
		const host = asHTMLElement(excalidraw ?? null, anchorEl);
		return host
			? {
					floatingHost: host,
					floatingScrollHost: getOwnerWindow(host),
					constrainToFloatingHost: true,
				}
			: {};
	}
	const scrollHost =
		asHTMLElement(
			anchorEl.closest(
				".popover-content, .view-content, .markdown-preview-view",
			),
			anchorEl,
		) ?? pagePreviewHost;
	return {
		floatingHost: pagePreviewHost,
		floatingScrollHost: scrollHost,
		constrainToFloatingHost: true,
	};
}

function resolveHostContext(
	anchor: HTMLElement | DOMRect,
	options: FloatingHostOptions = {},
): FloatingHostContext {
	if (options.floatingHost) {
		return {
			host: options.floatingHost,
			constrainToHost: options.constrainToFloatingHost ?? false,
			scrollHost:
				options.floatingScrollHost ??
				getOwnerWindow(options.floatingHost),
		};
	}

	const anchorEl = asHTMLElement(anchor);
	const rectAnchorOwnerEl = anchorEl
		? null
		: getFloatingRectAnchorOwner(anchor);
	if (rectAnchorOwnerEl) {
		const lightbox = asHTMLElement(
			rectAnchorOwnerEl.closest(".task-board-native-lightbox-host"),
			rectAnchorOwnerEl,
		);
		if (lightbox)
			return {
				host: lightbox,
				constrainToHost: true,
				scrollHost: getOwnerWindow(lightbox),
			};
		return {
			host: getOwnerBody(rectAnchorOwnerEl),
			constrainToHost: false,
			scrollHost: getOwnerWindow(rectAnchorOwnerEl),
		};
	}
	if (!anchorEl) {
		return {
			host: getActiveDocument().body,
			constrainToHost: false,
			scrollHost: getActiveWindow(),
		};
	}
	const ownerWindow = getOwnerWindow(anchorEl);
	const surfaceOptions = resolveSurfaceFloatingHostOptions(anchorEl);
	if (surfaceOptions.floatingHost) {
		return {
			host: surfaceOptions.floatingHost,
			constrainToHost: true,
			scrollHost: surfaceOptions.floatingScrollHost ?? ownerWindow,
		};
	}

	const taskEditorHost = asHTMLElement(
		anchorEl.closest(".task-board-task-editor-shell"),
		anchorEl,
	);
	if (taskEditorHost) {
		return {
			host: taskEditorHost,
			constrainToHost: true,
			scrollHost:
				asHTMLElement(
					anchorEl.closest(".task-board-task-editor-main-panel"),
					anchorEl,
				) ?? ownerWindow,
		};
	}

	const taskCreatorHost = asHTMLElement(
		anchorEl.closest(".task-board-task-creator-modal-container"),
		anchorEl,
	);
	if (taskCreatorHost) {
		return {
			host: taskCreatorHost,
			constrainToHost: true,
			scrollHost:
				asHTMLElement(anchorEl.closest(".modal-content"), anchorEl) ??
				ownerWindow,
		};
	}

	const obsidianModalHost = asHTMLElement(
		anchorEl.closest(".modal"),
		anchorEl,
	);
	if (obsidianModalHost) {
		return {
			host: obsidianModalHost,
			constrainToHost: false,
			scrollHost:
				asHTMLElement(
					anchorEl.closest(".vertical-tab-content, .modal-content"),
					anchorEl,
				) ?? ownerWindow,
		};
	}

	return {
		host: getOwnerBody(anchorEl),
		constrainToHost: false,
		scrollHost: ownerWindow,
	};
}

export function positionFloatingElement(
	panel: HTMLElement,
	anchor: HTMLElement | DOMRect,
	options: FloatingPositionOptions = {},
): void {
	const anchorEl = asHTMLElement(anchor);
	const rect = resolveRect(anchor);
	const { host, constrainToHost } = resolveHostContext(anchor, options);
	const hostWindow = getOwnerWindow(host);
	const hostIsBody = host === getOwnerBody(host);
	const margin = options.margin ?? 8;
	const gap = options.gap ?? 6;
	const useHostBounds = constrainToHost && !hostIsBody;
	const mobileSurfaceContext = getMobilePickerSurfaceContext(
		anchorEl,
		options,
		host,
	);
	if (useHostBounds && mobileSurfaceContext) {
		if (mobileSurfaceContext.kind === "task-editor") {
			if (
				mobileSurfaceContext.root.matches(
					".task-board-task-editor-phone-desktop, .task-board-task-editor-touch-desktop",
				)
			) {
				positionTaskEditorPhoneDesktopSurface(
					panel,
					mobileSurfaceContext.panelHost,
					hostWindow,
					margin,
					mobileSurfaceContext.root,
					anchorEl,
				);
			} else {
				positionTaskEditorMobileSurface(
					panel,
					host,
					hostWindow,
					margin,
				);
			}
		} else {
			positionTaskCreatorMobileSurface(
				panel,
				mobileSurfaceContext.root,
				hostWindow,
				margin,
			);
		}
		return;
	}
	const DOMRectCtor =
		(hostWindow as Window & { DOMRect?: typeof DOMRect }).DOMRect ??
		DOMRect;
	const hostRect = useHostBounds
		? host.getBoundingClientRect()
		: new DOMRectCtor(0, 0, hostWindow.innerWidth, hostWindow.innerHeight);
	const fit = useHostBounds && options.fitToHostViewport === true;
	const scaleX =
		fit && host.offsetWidth ? hostRect.width / host.offsetWidth || 1 : 1;
	const scaleY =
		fit && host.offsetHeight ? hostRect.height / host.offsetHeight || 1 : 1;
	const originLeft = hostRect.left + (fit ? host.clientLeft * scaleX : 0);
	const originTop = hostRect.top + (fit ? host.clientTop * scaleY : 0);
	const clipLeft = fit ? Math.max(0, -originLeft / scaleX) : 0;
	const clipTop = fit ? Math.max(0, -originTop / scaleY) : 0;
	const hostScrollLeft = useHostBounds ? host.scrollLeft + clipLeft : 0;
	const hostScrollTop = useHostBounds ? host.scrollTop + clipTop : 0;
	const anchorLeft = useHostBounds
		? (rect.left - originLeft) / scaleX -
			clipLeft +
			(fit ? 0 : hostScrollLeft)
		: rect.left;
	const anchorTop = useHostBounds
		? (rect.top - originTop) / scaleY - clipTop + (fit ? 0 : hostScrollTop)
		: rect.top;
	const anchorBottom = useHostBounds
		? (rect.bottom - originTop) / scaleY -
			clipTop +
			(fit ? 0 : hostScrollTop)
		: rect.bottom;
	const availableWidth = fit
		? Math.max(
				0,
				Math.min(
					host.clientWidth,
					(hostWindow.innerWidth - originLeft) / scaleX,
				) - clipLeft,
			)
		: useHostBounds
			? host.clientWidth
			: hostWindow.innerWidth;
	const availableHeight = fit
		? Math.max(
				0,
				Math.min(
					host.clientHeight,
					(hostWindow.innerHeight - originTop) / scaleY,
				) - clipTop,
			)
		: useHostBounds
			? host.clientHeight
			: hostWindow.innerHeight;
	if (typeof options.matchWidth === "number" && options.matchWidth > 0) {
		panel.style.width = `${Math.round(options.matchWidth / scaleX)}px`;
	}
	if (fit) {
		panel.style.maxWidth = `${Math.max(0, availableWidth - margin * 2)}px`;
	}
	const panelWidth = panel.offsetWidth;
	const panelHeight = panel.offsetHeight;

	const maxHeight = Math.max(fit ? 0 : 160, availableHeight - margin * 2);
	panel.style.maxHeight = `${maxHeight}px`;
	panel.style.overflowY = panelHeight > maxHeight ? "auto" : "";

	const effectiveHeight = Math.min(panel.offsetHeight, maxHeight);
	const spaceBelow = availableHeight - anchorBottom - margin;
	const spaceAbove = anchorTop - margin;

	let top = anchorBottom + gap;
	if (effectiveHeight > spaceBelow && spaceAbove > spaceBelow) {
		top = anchorTop - effectiveHeight - gap;
	}
	top = Math.max(
		margin,
		Math.min(top, availableHeight - effectiveHeight - margin),
	);

	let left = anchorLeft;
	if (left + panelWidth > availableWidth - margin) {
		left = availableWidth - panelWidth - margin;
	}
	left = Math.max(margin, left);

	if (fit) {
		left += hostScrollLeft;
		top += hostScrollTop;
	}
	if (useHostBounds) {
		const minLeft = hostScrollLeft + margin;
		const maxLeft = hostScrollLeft + availableWidth - panelWidth - margin;
		const minTop = hostScrollTop + margin;
		const maxTop =
			hostScrollTop + availableHeight - effectiveHeight - margin;
		left = Math.max(minLeft, Math.min(left, maxLeft));
		top = Math.max(minTop, Math.min(top, maxTop));
	}

	panel.style.top = `${Math.round(top)}px`;
	panel.style.left = `${Math.round(left)}px`;
}

// The desktop layout on phones uses the visible modal, not the legacy toolbar geometry.
function positionTaskEditorPhoneDesktopSurface(
	panel: HTMLElement,
	host: HTMLElement,
	hostWindow: Window,
	margin: number,
	root: HTMLElement,
	anchor: HTMLElement | null,
): void {
	const rect = host.getBoundingClientRect();
	const viewport = hostWindow.visualViewport;
	const viewportLeft = viewport?.offsetLeft ?? 0;
	const viewportTop = viewport?.offsetTop ?? 0;
	const left = Math.max(rect.left, viewportLeft) + margin;
	const top = Math.max(rect.top, viewportTop) + margin;
	const right =
		Math.min(
			rect.right,
			viewportLeft + (viewport?.width ?? hostWindow.innerWidth),
		) - margin;
	const bottom =
		Math.min(
			rect.bottom,
			viewportTop + (viewport?.height ?? hostWindow.innerHeight),
		) - margin;
	panel.style.left = `${Math.round(left)}px`;
	panel.style.top = `${Math.round(top)}px`;
	panel.style.width = `${Math.max(1, Math.floor(right - left))}px`;
	panel.style.maxWidth = panel.style.width;
	panel.style.maxHeight = `${Math.max(1, Math.floor(bottom - top))}px`;
	const mainPanel = anchor?.closest<HTMLElement>(
		".task-board-task-editor-main-panel",
	);
	if (
		!root.matches(".task-board-task-editor-phone-desktop") &&
		mainPanel &&
		mainPanel.clientWidth > 420 &&
		anchor
	) {
		panel.style.removeProperty("width");
		const width = Math.min(panel.offsetWidth, Math.max(1, right - left));
		const height = Math.min(panel.offsetHeight, Math.max(1, bottom - top));
		const anchorRect = anchor.getBoundingClientRect();
		const preferredTop =
			bottom - anchorRect.bottom >= height
				? anchorRect.bottom + 6
				: anchorRect.top - height - 6;
		panel.style.left = `${Math.round(Math.max(left, Math.min(anchorRect.left, right - width)))}px`;
		panel.style.top = `${Math.round(Math.max(top, Math.min(preferredTop, bottom - height)))}px`;
	}
}

function positionTaskEditorMobileSurface(
	panel: HTMLElement,
	host: HTMLElement,
	hostWindow: Window,
	margin: number,
): void {
	const hostRect = host.getBoundingClientRect();
	const visibleLeft = Math.max(hostRect.left, 0);
	const visibleRight = Math.min(hostRect.right, hostWindow.innerWidth);
	const visibleTop = Math.max(hostRect.top, 0);
	const visibleBottom = hostWindow.innerHeight;
	const surfaceTop = resolveTaskEditorMobileSurfaceTop(
		host,
		visibleTop,
		visibleBottom,
	);
	const availableWidth = Math.max(
		TASK_EDITOR_MOBILE_SURFACE_MIN_WIDTH,
		visibleRight - visibleLeft - margin * 2,
	);
	const availableHeight = Math.max(
		1,
		visibleBottom - surfaceTop - margin * 2,
	);
	const left = visibleLeft + margin;
	const top = surfaceTop + margin;

	panel.style.width = `${Math.round(availableWidth)}px`;
	panel.style.maxWidth = `${Math.round(availableWidth)}px`;
	panel.style.maxHeight = `${Math.round(availableHeight)}px`;
	panel.style.left = `${Math.round(left)}px`;
	panel.style.top = `${Math.round(top)}px`;
}

function resolveTaskEditorMobileSurfaceTop(
	host: HTMLElement,
	visibleTop: number,
	visibleBottom: number,
): number {
	const coreToolbar = asHTMLElement(
		host.querySelector(TASK_EDITOR_MOBILE_CORE_TOOLBAR_SELECTOR),
		host,
	);
	if (coreToolbar) {
		const toolbarRect = coreToolbar.getBoundingClientRect();
		if (
			toolbarRect.bottom > visibleTop &&
			toolbarRect.top < visibleBottom
		) {
			return Math.max(visibleTop, toolbarRect.bottom);
		}
	}

	const description = asHTMLElement(
		host.querySelector(TASK_EDITOR_MOBILE_DESCRIPTION_SELECTOR),
		host,
	);
	if (!description) return visibleTop;
	const descriptionRect = description.getBoundingClientRect();
	if (
		descriptionRect.bottom <= visibleTop ||
		descriptionRect.top >= visibleBottom
	)
		return visibleTop;
	return Math.max(visibleTop, descriptionRect.bottom);
}

function positionTaskCreatorMobileSurface(
	panel: HTMLElement,
	root: HTMLElement,
	hostWindow: Window,
	margin: number,
): void {
	const modal =
		asHTMLElement(root.closest(TASK_CREATOR_MOBILE_MODAL_SELECTOR), root) ??
		root;
	const modalRect = modal.getBoundingClientRect();
	const viewport = hostWindow.visualViewport;
	const viewportLeft = viewport?.offsetLeft ?? 0;
	const viewportTop = viewport?.offsetTop ?? 0;
	const visibleLeft = Math.max(modalRect.left, viewportLeft);
	const visibleRight = Math.min(
		modalRect.right,
		viewportLeft + (viewport?.width ?? hostWindow.innerWidth),
	);
	const visibleTop = Math.max(modalRect.top, viewportTop);
	const visibleBottom = Math.min(
		modalRect.bottom,
		viewportTop + (viewport?.height ?? hostWindow.innerHeight),
	);
	let surfaceTop = resolveTaskCreatorMobileSurfaceTop(
		root,
		visibleTop,
		visibleBottom,
	);
	// Wrapped tools can fill the keyboard viewport. Keep the picker usable above them instead.
	const minimumHeight = Math.min(
		240,
		visibleBottom - visibleTop - margin * 2,
	);
	if (visibleBottom - surfaceTop - margin * 2 < minimumHeight)
		surfaceTop = visibleTop;
	const availableWidth = Math.max(
		TASK_CREATOR_MOBILE_SURFACE_MIN_WIDTH,
		visibleRight - visibleLeft - margin * 2,
	);
	const availableHeight = Math.max(
		1,
		visibleBottom - surfaceTop - margin * 2,
	);
	const left = visibleLeft + margin;
	const top = surfaceTop + margin;

	panel.style.width = `${Math.round(availableWidth)}px`;
	panel.style.maxWidth = `${Math.round(availableWidth)}px`;
	panel.style.maxHeight = `${Math.round(availableHeight)}px`;
	panel.style.left = `${Math.round(left)}px`;
	panel.style.top = `${Math.round(top)}px`;
}

function resolveTaskCreatorMobileSurfaceTop(
	root: HTMLElement,
	visibleTop: number,
	visibleBottom: number,
): number {
	const actionRow = asHTMLElement(
		root.querySelector(TASK_CREATOR_MOBILE_ACTION_ROW_SELECTOR),
		root,
	);
	if (actionRow) {
		const actionRect = actionRow.getBoundingClientRect();
		if (actionRect.bottom > visibleTop && actionRect.top < visibleBottom) {
			return Math.max(visibleTop, actionRect.bottom);
		}
	}

	const toolbar = asHTMLElement(
		root.querySelector(TASK_CREATOR_MOBILE_TOOLBAR_SELECTOR),
		root,
	);
	if (!toolbar) return visibleTop;
	const toolbarRect = toolbar.getBoundingClientRect();
	if (toolbarRect.bottom <= visibleTop || toolbarRect.top >= visibleBottom)
		return visibleTop;
	return Math.max(visibleTop, toolbarRect.bottom);
}

export function createFloatingPanel(
	anchor: HTMLElement | DOMRect,
	className: string,
	onClose?: () => void,
	options: FloatingPanelOptions = {},
): FloatingPanel {
	let cardAnchor =
		asHTMLElement(anchor) ?? getFloatingRectAnchorOwner(anchor);
	let followsTaskCard = !!cardAnchor?.closest(".task-board-task-card-embed");
	let groupHost = cardAnchor?.closest<HTMLElement>(
		".task-board-canvas-group-layer",
	);
	if (groupHost)
		options = {
			...options,
			floatingHost: groupHost,
			constrainToFloatingHost: true,
			closeOnWindowResize: false,
		};

	if (followsTaskCard && asHTMLElement(anchor))
		anchor = snapshotFloatingRectAnchor(anchor as HTMLElement);
	let anchorEl = asHTMLElement(anchor);
	let rectAnchorOwnerEl = anchorEl
		? null
		: getFloatingRectAnchorOwner(anchor);
	let { host, constrainToHost, scrollHost } = resolveHostContext(
		anchor,
		options,
	);
	let mobileSurfaceContext = getMobilePickerSurfaceContext(
		anchorEl,
		options,
		host,
	);
	let panelHost = mobileSurfaceContext?.panelHost ?? host;
	const panel = createOwnerElement(
		anchorEl ?? rectAnchorOwnerEl ?? host,
		"div",
	);
	panel.className = className;
	// setSettingsScope(panel, isSettingsScope(anchorEl ?? rectAnchorOwnerEl));
	if (mobileSurfaceContext) {
		panel.classList.add(
			"task-board-mobile-picker-surface",
			mobileSurfaceContext.surfaceClass,
		);
		if (
			mobileSurfaceContext.root.matches(
				".task-board-task-editor-touch-desktop",
			)
		)
			panel.classList.add("task-board-task-editor-touch-picker");
	}
	const positionOptions: FloatingPositionOptions = {
		floatingHost: options.floatingHost,
		floatingScrollHost: options.floatingScrollHost,
		constrainToFloatingHost: options.constrainToFloatingHost,
		fitToHostViewport: options.fitToHostViewport,
		matchWidth: options.matchWidth,
	};
	const restoreKeyboardFocus =
		mobileSurfaceContext?.root.matches(
			".task-board-task-editor-touch-desktop",
		) && mobileSurfaceContext.root.dataset.editorInput === "keyboard";
	let hostDocument = getOwnerDocument(host);
	let hostWindow = getOwnerWindow(host);
	let visualViewport =
		mobileSurfaceContext || groupHost ? hostWindow.visualViewport : null;
	panel.style.position =
		mobileSurfaceContext || !constrainToHost ? "fixed" : "absolute";
	if (mobileSurfaceContext) {
		panel.addClass("is-opening");
		positionFloatingElement(panel, anchor, positionOptions);
	}
	let rafId = 0;
	let focusRetentionRafId = 0;
	let retainedFocusInput: HTMLElement | null = null;
	let closed = false;
	let stopCardAnchor: (() => void) | null = null;
	const record: FloatingPanelRecord = {
		getAnchorOwner: () => anchorEl ?? rectAnchorOwnerEl,
		panel,
		anchorEl,
		close: () => undefined,
		requestClose: () => false,
		reanchor: () => undefined,
	};
	const isAnchorConnected = (): boolean =>
		followsTaskCard
			? rectAnchorOwnerEl?.isConnected === true
			: !anchorEl || anchorEl.isConnected;
	const schedulePosition = () => {
		if (rafId) return;
		rafId = hostWindow.requestAnimationFrame(() => {
			rafId = 0;
			if (!panel.isConnected) return;
			if (!isAnchorConnected()) {
				stopCardAnchor?.();
				stopCardAnchor = null;
				if (followsTaskCard) record.requestClose("anchor-detach");
				else cleanup();
				return;
			}
			positionFloatingElement(panel, anchor, positionOptions);
		});
	};
	let sizeObserver: ResizeObserver | null = null;
	let stopMigration: (() => void) | null = null;
	const getRetainedFocusInput = (): HTMLElement | null => {
		if (
			retainedFocusInput?.isConnected &&
			panel.contains(retainedFocusInput)
		) {
			return retainedFocusInput;
		}
		return panel.querySelector<HTMLElement>(
			options.focusInputSelector ?? ".task-board-floating-input",
		);
	};
	const reclaimRetainedInputFocus = () => {
		focusRetentionRafId = 0;
		if (closed || !panel.isConnected) return;
		const input = getRetainedFocusInput();
		if (input?.isConnected) {
			const activeElement = hostDocument.activeElement;
			if (
				activeElement !== input &&
				!isEditablePanelFocus(activeElement, panel)
			) {
				input.focus({ preventScroll: true });
			}
		}
	};
	const scheduleRetainedInputFocus = () => {
		if (closed || !panel.isConnected || focusRetentionRafId) return;
		focusRetentionRafId = hostWindow.requestAnimationFrame(
			reclaimRetainedInputFocus,
		);
	};
	const onPanelFocusIn = (event: FocusEvent) => {
		const target = asHTMLElement(event.target, panel);
		if (!target || !isEditablePanelFocus(target, panel)) return;
		retainedFocusInput = target;
	};
	const onPanelFocusOut = (event: FocusEvent) => {
		const target = asHTMLElement(event.target, panel);
		if (!target || !isEditablePanelFocus(target, panel)) return;
		scheduleRetainedInputFocus();
	};
	let onHostWindowResize: () => void = () => undefined;
	let onHostWindowBlur: () => void = () => undefined;

	const cleanup = () => {
		if (closed) return;
		closed = true;
		stopMigration?.();
		stopMigration = null;
		if (rafId) {
			hostWindow.cancelAnimationFrame(rafId);
			rafId = 0;
		}
		if (focusRetentionRafId) {
			hostWindow.cancelAnimationFrame(focusRetentionRafId);
			focusRetentionRafId = 0;
		}
		sizeObserver?.disconnect();
		stopCardAnchor?.();
		stopCardAnchor = null;
		const restoreFocus =
			restoreKeyboardFocus &&
			anchorEl?.isConnected &&
			mobileSurfaceContext?.root.isConnected &&
			(panel.contains(hostDocument.activeElement) ||
				hostDocument.activeElement === hostDocument.body);
		panel.remove();
		activeFloatingPanels.delete(record);
		panel.removeEventListener("focusin", onPanelFocusIn);
		panel.removeEventListener("focusout", onPanelFocusOut);
		hostDocument.removeEventListener("mousedown", onOutside, true);
		hostDocument.removeEventListener("keydown", onKeyDown, true);
		scrollHost.removeEventListener("scroll", schedulePosition, true);
		hostWindow.removeEventListener("resize", onHostWindowResize);
		visualViewport?.removeEventListener("resize", schedulePosition);
		visualViewport?.removeEventListener("scroll", schedulePosition);
		hostWindow.removeEventListener("blur", onHostWindowBlur);
		onClose?.();
		dispatchMobilePickerEvent(
			mobileSurfaceContext,
			mobileSurfaceContext?.closeEvents ?? [],
		);
		if (
			restoreFocus &&
			anchorEl?.isConnected &&
			(hostDocument.activeElement === hostDocument.body ||
				panel.contains(hostDocument.activeElement))
		)
			anchorEl.focus({ preventScroll: true });
	};
	record.reanchor = (next) => {
		const nextOwner =
			asHTMLElement(next) ?? getFloatingRectAnchorOwner(next);
		if (!nextOwner || getOwnerDocument(nextOwner) !== hostDocument) return;
		stopCardAnchor?.();
		stopCardAnchor = null;
		cardAnchor = nextOwner;
		followsTaskCard = !!cardAnchor.closest(".task-board-task-card-embed");
		anchor =
			followsTaskCard && asHTMLElement(next)
				? snapshotFloatingRectAnchor(next as HTMLElement)
				: next;
		anchorEl = asHTMLElement(anchor);
		rectAnchorOwnerEl = anchorEl
			? null
			: getFloatingRectAnchorOwner(anchor);
		record.anchorEl = anchorEl;
		bindMigration();
		// setSettingsScope(panel, isSettingsScope(nextOwner));
		if (followsTaskCard && rectAnchorOwnerEl)
			stopCardAnchor = observeTaskCardAnchor(
				rectAnchorOwnerEl,
				schedulePosition,
			);
		schedulePosition();
	};
	record.close = cleanup;

	const requestClose = (reason: FloatingPanelCloseReason): boolean => {
		if (options.shouldClose?.(reason) === false) return false;
		cleanup();
		return true;
	};
	record.requestClose = requestClose;

	const onOutside = (event: MouseEvent) => {
		if (
			getOwnerDocument(anchorEl ?? rectAnchorOwnerEl ?? panelHost) !==
			hostDocument
		)
			return;
		const target = event.target as Node;
		const outsideClickExclusions =
			typeof options.outsideClickExclusions === "function"
				? options.outsideClickExclusions()
				: options.outsideClickExclusions;
		const isExcluded =
			outsideClickExclusions?.some((element) =>
				element.contains(target),
			) === true;
		if (!panel.contains(target) && !isExcluded) {
			requestClose("outside");
		}
	};

	const onKeyDown = (event: KeyboardEvent) => {
		if (
			getOwnerDocument(anchorEl ?? rectAnchorOwnerEl ?? panelHost) !==
			hostDocument
		)
			return;
		if (
			event.key === "Escape" &&
			!event.isComposing &&
			Reflect.get(event, "keyCode") !== 229 &&
			options.shouldHandleEscape?.(event) !== false &&
			isTopMostFloatingPanel(record)
		) {
			if (panel.closest(".task-board-native-lightbox-host")) {
				event.preventDefault();
				event.stopPropagation();
			}
			requestClose("escape");
		}
	};

	onHostWindowResize = () => {
		if (
			mobileSurfaceContext ||
			followsTaskCard ||
			options.closeOnWindowResize === false
		) {
			if (options.repositionOnWindowResize !== false) {
				schedulePosition();
			}
			return;
		}
		requestClose("window-resize");
	};
	onHostWindowBlur = () => {
		if (
			getOwnerDocument(anchorEl ?? rectAnchorOwnerEl ?? panelHost) ===
			hostDocument
		)
			requestClose("window-blur");
	};

	dispatchMobilePickerEvent(
		mobileSurfaceContext,
		mobileSurfaceContext?.openEvents ?? [],
	);
	panelHost.appendChild(panel);
	activeFloatingPanels.add(record);
	if (followsTaskCard && rectAnchorOwnerEl)
		stopCardAnchor = observeTaskCardAnchor(
			rectAnchorOwnerEl,
			schedulePosition,
		);
	if (options.retainInputFocus) {
		panel.addEventListener("focusin", onPanelFocusIn);
		panel.addEventListener("focusout", onPanelFocusOut);
		scheduleRetainedInputFocus();
	}

	const bindHost = (): void => {
		if (closed || !panel.isConnected) return;
		if (!isAnchorConnected()) {
			stopCardAnchor?.();
			stopCardAnchor = null;
			if (followsTaskCard) record.requestClose("anchor-detach");
			else cleanup();
			return;
		}
		positionFloatingElement(panel, anchor, positionOptions);
		if (mobileSurfaceContext) {
			panel.removeClass("is-opening");
		}
		if (options.repositionOnPanelResize !== false) {
			const Resize = (
				hostWindow as Window & {
					ResizeObserver?: typeof ResizeObserver;
				}
			).ResizeObserver;
			sizeObserver = Resize ? new Resize(schedulePosition) : null;
			sizeObserver?.observe(panel);
		}
		hostDocument.addEventListener("mousedown", onOutside, true);
		hostDocument.addEventListener("keydown", onKeyDown, true);
		if (options.repositionOnScroll !== false) {
			scrollHost.addEventListener("scroll", schedulePosition, true);
		}
		hostWindow.addEventListener("resize", onHostWindowResize);
		if (options.repositionOnWindowResize !== false) {
			visualViewport?.addEventListener("resize", schedulePosition);
		}
		if (options.repositionOnScroll !== false) {
			visualViewport?.addEventListener("scroll", schedulePosition);
		}
		hostWindow.addEventListener("blur", onHostWindowBlur);
	};

	const bindMigration = (): void => {
		stopMigration?.();
		stopMigration =
			(anchorEl ?? rectAnchorOwnerEl ?? panelHost).onWindowMigrated?.(
				() => {
					const nextDocument = getOwnerDocument(
						anchorEl ?? rectAnchorOwnerEl ?? panelHost,
					);
					if (closed || nextDocument === hostDocument) return;
					const nextWindow = getOwnerWindow(
						anchorEl ?? rectAnchorOwnerEl ?? panelHost,
					);
					hostDocument.removeEventListener(
						"mousedown",
						onOutside,
						true,
					);
					hostDocument.removeEventListener(
						"keydown",
						onKeyDown,
						true,
					);
					scrollHost.removeEventListener(
						"scroll",
						schedulePosition,
						true,
					);
					hostWindow.removeEventListener(
						"resize",
						onHostWindowResize,
					);
					hostWindow.removeEventListener("blur", onHostWindowBlur);
					visualViewport?.removeEventListener(
						"resize",
						schedulePosition,
					);
					visualViewport?.removeEventListener(
						"scroll",
						schedulePosition,
					);
					const focusPending = !!focusRetentionRafId;
					if (rafId) hostWindow.cancelAnimationFrame(rafId);
					if (focusRetentionRafId)
						hostWindow.cancelAnimationFrame(focusRetentionRafId);
					rafId = 0;
					focusRetentionRafId = 0;
					sizeObserver?.disconnect();
					sizeObserver = null;
					stopCardAnchor?.();
					stopCardAnchor = null;
					const floatingHost =
						options.floatingHost === hostDocument.body
							? nextDocument.body
							: options.floatingHost?.ownerDocument ===
								  nextDocument
								? options.floatingHost
								: undefined;
					const floatingScrollHost =
						options.floatingScrollHost === hostWindow
							? nextWindow
							: asHTMLElement(options.floatingScrollHost)
										?.ownerDocument === nextDocument
								? options.floatingScrollHost
								: undefined;
					options = { ...options, floatingHost, floatingScrollHost };
					({ host, constrainToHost, scrollHost } = resolveHostContext(
						anchor,
						options,
					));
					hostDocument = nextDocument;
					hostWindow = nextWindow;
					groupHost = (
						anchorEl ?? rectAnchorOwnerEl
					)?.closest<HTMLElement>(".task-board-canvas-group-layer");
					mobileSurfaceContext = getMobilePickerSurfaceContext(
						anchorEl,
						options,
						host,
					);
					panelHost = mobileSurfaceContext?.panelHost ?? host;
					visualViewport =
						mobileSurfaceContext || groupHost
							? hostWindow.visualViewport
							: null;
					Object.assign(positionOptions, {
						floatingHost: options.floatingHost,
						floatingScrollHost: options.floatingScrollHost,
						constrainToFloatingHost:
							options.constrainToFloatingHost,
					});
					panel.style.position =
						mobileSurfaceContext || !constrainToHost
							? "fixed"
							: "absolute";
					if (panel.parentElement !== panelHost)
						panelHost.appendChild(panel);
					if (followsTaskCard && rectAnchorOwnerEl)
						stopCardAnchor = observeTaskCardAnchor(
							rectAnchorOwnerEl,
							schedulePosition,
						);
					bindHost();
					if (focusPending) scheduleRetainedInputFocus();
				},
			) ?? null;
	};
	bindMigration();
	rafId = hostWindow.requestAnimationFrame(() => {
		rafId = 0;
		bindHost();
	});

	return { panel, close: cleanup };
}

export function focusFloatingInput(input: HTMLElement): void {
	input.focus({ preventScroll: true });
}

export function requestFloatingInputFocus(input: HTMLElement): void {
	const ownerWindow = getOwnerWindow(input);
	ownerWindow.requestAnimationFrame(() => {
		if (!input.isConnected) return;
		focusFloatingInput(input);
	});
}

export function scrollChildIntoView(
	container: HTMLElement,
	child: HTMLElement | null | undefined,
	margin = 4,
): void {
	if (!child?.isConnected || !container.contains(child)) return;

	const containerRect = container.getBoundingClientRect();
	const childRect = child.getBoundingClientRect();
	const topOverflow = childRect.top - containerRect.top - margin;
	const bottomOverflow = childRect.bottom - containerRect.bottom + margin;

	if (topOverflow < 0) {
		container.scrollTop += topOverflow;
	} else if (bottomOverflow > 0) {
		container.scrollTop += bottomOverflow;
	}
}

function containsNode(root: Node, target: Node | null | undefined): boolean {
	if (!target) return false;
	const rootWithContains = root as Node & {
		contains?: (other: Node | null) => boolean;
	};
	if (typeof rootWithContains.contains !== "function") return false;
	return rootWithContains.contains(target);
}

function floatingPanelBelongsToRoot(
	root: Node,
	record: FloatingPanelRecord,
): boolean {
	return (
		containsNode(root, record.panel) ||
		containsNode(root, record.getAnchorOwner())
	);
}

function hasDisconnectedAnchor(record: FloatingPanelRecord): boolean {
	return record.anchorEl != null && !record.anchorEl.isConnected;
}

function isTopMostFloatingPanel(record: FloatingPanelRecord): boolean {
	const records = Array.from(activeFloatingPanels);
	return records[records.length - 1] === record;
}

/** View virtualization must retain an anchor while its picker owns a draft. */
export function hasFloatingPanelForRoot(root: Node): boolean {
	for (const record of activeFloatingPanels) {
		if (containsNode(root, record.getAnchorOwner())) return true;
	}
	return false;
}

export function closeFloatingPanelsForRoot(root: ParentNode): boolean {
	const rootNode = root as Node;
	let closed = false;
	for (const record of Array.from(activeFloatingPanels)) {
		if (
			floatingPanelBelongsToRoot(rootNode, record) ||
			hasDisconnectedAnchor(record)
		) {
			record.close();
			closed = true;
		}
	}
	return closed;
}

export function requestFloatingPanelCloseForRoot(
	root: ParentNode,
	reason: FloatingPanelCloseReason,
	topmostOnly = false,
): boolean {
	const rootNode = root as Node;
	let handled = false;
	const records = Array.from(activeFloatingPanels);
	for (const record of topmostOnly ? records.reverse() : records) {
		if (floatingPanelBelongsToRoot(rootNode, record)) {
			handled = true;
			record.requestClose(reason);
			if (topmostOnly) break;
		} else if (hasDisconnectedAnchor(record)) {
			record.close();
		}
	}
	return handled;
}

export function isFloatingPanelTargetForRoot(
	root: ParentNode,
	target: EventTarget | null,
): boolean {
	if (!target || typeof (target as Node).nodeType !== "number") return false;
	const targetNode = target as Node;
	const rootNode = root as Node;
	for (const record of activeFloatingPanels) {
		if (
			containsNode(rootNode, record.anchorEl) &&
			containsNode(record.panel, targetNode)
		) {
			return true;
		}
	}
	return false;
}

export function createButton(
	label: string,
	className: string,
	owner?: Node | null,
): HTMLButtonElement {
	const button = createOwnerElement(owner, "button");
	button.type = "button";
	button.className = className;
	button.textContent = label;
	return button;
}

export function createChip(
	label: string,
	className: string,
	owner?: Node | null,
): HTMLElement {
	const chip = createOwnerElement(owner, "span");
	chip.className = className;
	chip.textContent = label;
	return chip;
}

/** An explicit reopening may move a shared editor to another instance of the same task. */
export function reanchorFloatingPanel(
	panel: HTMLElement,
	anchor: HTMLElement | DOMRect,
): void {
	for (const record of activeFloatingPanels)
		if (record.panel === panel) {
			record.reanchor(anchor);
			return;
		}
}

/** Canvas transforms move the anchor without a DOM scroll or resize event. */
export function repositionFloatingPanelsForAnchor(anchor: HTMLElement): void {
	for (const record of activeFloatingPanels)
		if (record.anchorEl === anchor) record.reanchor(anchor);
}

