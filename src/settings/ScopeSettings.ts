import type { SettingDefinitionItem } from "obsidian";

/** Ownership only: this class must never carry visual declarations of its own. */
export const SETTINGS_SCOPE_CLASS = "task-board-settings-scope";

export function isSettingsScope(origin: Element | null | undefined): boolean {
	return !!origin?.closest("." + SETTINGS_SCOPE_CLASS);
}

export function setSettingsScope(target: HTMLElement, enabled: boolean): void {
	target.classList.toggle(SETTINGS_SCOPE_CLASS, enabled);
}

/** Tag before opening; never move the modal or infer ownership from the active window. */
export function scopeSettingsModal<T extends { modalEl: HTMLElement }>(
	modal: T,
	origin: boolean | Element | null,
): T {
	setSettingsScope(
		modal.modalEl,
		typeof origin === "boolean" ? origin : isSettingsScope(origin),
	);
	return modal;
}

/** Classify custom rows once after rendering, without observing DOM mutations. */
export function markSettingsRowLayout(root: HTMLElement): void {
	const rows = root.matches(".setting-item") ? [root] : [];
	rows.push(
		...Array.from(root.querySelectorAll<HTMLElement>(".setting-item")),
	);
	for (const row of rows) {
		const control = Array.from(row.children).find((child) =>
			child.classList.contains("setting-item-control"),
		);
		const hasInfo = Array.from(row.children).some((child) =>
			child.classList.contains("setting-item-info"),
		);
		const standard =
			hasInfo &&
			!!control &&
			Array.from(control.children).some((child) =>
				child.matches("input, select, button, .checkbox-container"),
			) &&
			!control.querySelector("textarea");
		row.classList.toggle("task-board-settings-nonstandard-row", !standard);
	}
}

/** Decorate only fresh definitions; retain native controls and renderer cleanup results. */
export function scopeSettingsDefinitions(
	items: SettingDefinitionItem[],
): SettingDefinitionItem[] {
	for (const item of items) {
		if ("type" in item) {
			if (item.type === "group" || item.type === "list") {
				const classes = new Set(
					(item.cls ?? "").split(/\s+/).filter(Boolean),
				);
				classes.add(SETTINGS_SCOPE_CLASS);
				item.cls = [...classes].join(" ");
			}
			if (item.items) scopeSettingsDefinitions(item.items);
		} else if (item.render) {
			const render = item.render;
			item.render = (setting, context) => {
				setSettingsScope(setting.settingEl, true);
				const cleanup = render(setting, context);
				markSettingsRowLayout(setting.settingEl);
				return cleanup;
			};
		}
	}
	return items;
}
