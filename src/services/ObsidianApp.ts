import type { Editor, App } from "obsidian";
import { EditorView } from "@codemirror/view";
import { InternalPluginNameType } from "obsidian-typings";

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isUnknownFunction(
	value: unknown,
): value is (...args: unknown[]) => unknown {
	return typeof value === "function";
}

export function readString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

export function getAppLocale(app: App | null | undefined): string | undefined {
	if (!app) return undefined;
	const locale = (app as App & { locale?: unknown }).locale;
	return typeof locale === "string" ? locale : undefined;
}

export function getWindowApp(ownerWindow: Window = window): App | undefined {
	const app = (ownerWindow as Window & { app?: unknown }).app;
	return isRecord(app) ? (app as unknown as App) : undefined;
}

export function getEditorViewFromEditor(editor: Editor): EditorView | null {
	const cm = (editor as Editor & { cm?: unknown }).cm;
	return cm instanceof EditorView ? cm : null;
}

export function getCommunityPlugin(
	app: App | undefined,
	pluginId: string,
): unknown {
	if (!app) return null;
	const pluginsHost = (app as App & { plugins?: unknown }).plugins;
	if (!isRecord(pluginsHost)) return null;
	if (isUnknownFunction(pluginsHost.getPlugin)) {
		return pluginsHost.getPlugin(pluginId);
	}
	const plugins = pluginsHost.plugins;
	return isRecord(plugins) ? plugins[pluginId] : null;
}

export function getExternalModifiedTimeFrontmatterPropertyNames(
	app: App | undefined,
): string[] {
	const integrations = [
		{
			pluginId: "update-time-on-edit",
			settingName: "headerUpdated",
			isActive: (settings: Record<string, unknown>) =>
				(settings.dateFormat === "yyyy-MM-dd'T'HH:mm" ||
					settings.dateFormat === "yyyy-MM-dd'T'HH:mm:ss") &&
				settings.enableNumberProperties !== true,
		},
		{
			pluginId: "frontmatter-date-manager",
			settingName: "headerUpdated",
			isActive: (settings: Record<string, unknown>) =>
				settings.enableAutoUpdate === true &&
				settings.enableModifiedTime !== false &&
				(settings.dateFormat === "yyyy-MM-dd'T'HH:mm" ||
					settings.dateFormat === "yyyy-MM-dd'T'HH:mm:ss") &&
				settings.enableNumberProperties !== true &&
				(settings.timezone === undefined || settings.timezone === ""),
		},
		{
			pluginId: "update-time",
			settingName: "updatedPropertyName",
			isActive: () => true,
		},
	] as const;
	const propertyNames = integrations.flatMap(
		({ pluginId, settingName, isActive }) => {
			const plugin = getCommunityPlugin(app, pluginId);
			if (
				!isRecord(plugin) ||
				!isRecord(plugin.settings) ||
				!isActive(plugin.settings)
			)
				return [];
			const propertyName = plugin.settings[settingName];
			if (
				typeof propertyName !== "string" ||
				propertyName.trim() !== propertyName ||
				propertyName.length === 0 ||
				/[\r\n:]/u.test(propertyName)
			)
				return [];
			return [propertyName];
		},
	);
	return [...new Set(propertyNames)];
}

export function getInternalPlugin(app: App, pluginId: InternalPluginNameType): unknown {
	const internalPlugins = (app as App & { internalPlugins?: unknown })
		.internalPlugins;
	if (!isRecord(internalPlugins)) return null;
	const plugins = internalPlugins.plugins;
	const plugin = isRecord(plugins) ? plugins[pluginId] : null;
	if (plugin) return plugin;
	return isUnknownFunction(internalPlugins.getPluginById)
		? internalPlugins.getPluginById(pluginId)
		: null;
}

export function isPluginEnabled(plugin: unknown): boolean {
	return isRecord(plugin) && plugin.enabled === true;
}

export function isDailyNotesCoreAvailable(app: App): boolean {
	return isPluginEnabled(getInternalPlugin(app, "daily-notes"));
}
