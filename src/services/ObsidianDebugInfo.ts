// Originally from the PDF++ plugin (https://github.com/RyotaUshio/obsidian-pdf-plus)

/**
 * A util function to extract various system and application related information for building debug logs.
 *
 * This code has been inspired from the obsidian-pdf-plus project by RyotaUshio.
 * @see https://github.com/RyotaUshio/obsidian-pdf-plus
 */

import { App, Platform, apiVersion } from "obsidian";

/** Selected subset of the "Show debug info" command's result with some additional entries. */
export async function getObsidianDebugInfo(app: App) {
	// This is an empty string if it's the default theme
	const themeName = app.customCss.theme;
	const themeManifest = app.customCss.themes[themeName];
	const numSnippets = app.customCss.snippets.filter((snippet: any) =>
		app.customCss.enabledSnippets.has(snippet)
	).length;
	const plugins = app.plugins.plugins;

	return {
		...(await getSystemInfo()),
		// This entry is not in Obsidian's built-in "Show debug info" command
		"Use [[Wikilinks]]": !app.vault.getConfig("useMarkdownLinks"),
		// This entry is not in Obsidian's built-in "Show debug info" command.
		// It replaces the "Base theme" entry for identifying the color scheme even if it's set to be "adapt to system"
		"Base color scheme": document.body.hasClass("theme-dark")
			? "dark"
			: "light",
		// This entry is not in Obsidian's built-in "Show debug info" command
		// 'PDF "Adapt to theme"': !!app.loadLocalStorage("pdfjs-is-themed"),
		"Community theme": themeName
			? `${themeName} v${themeManifest.version}`
			: "none",
		"Snippets enabled": numSnippets,
		"Plugins installed": Object.keys(app.plugins.manifests).length,
		"Plugins enabled": Object.values(plugins).map(
			(plugin) => `${plugin!.manifest.name} v${plugin!.manifest.version}`
		),
	};
}

export async function getWebViewVersion() {
	if (!Platform.isMobileApp) {
		return null;
	}

	const deviceInfo = await window.Capacitor.Plugins.Device.getInfo();
	return deviceInfo.webViewVersion;
}

/**
 * Get the information about the Obsidian app and the system.
 * This is the same as the "SYSTEM INFO" section in the result of the "Show debug info" command.
 */
export async function getSystemInfo(): Promise<any> {
	if (window.electron) {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const os = require("os") as typeof import("os");
		return {
			"Obsidian version": window.electron.ipcRenderer.sendSync("version"),
			// @ts-ignore
			"Installer version": window.electron.remote.app.getVersion(),
			"Operating system": os.version() + " " + os.release(),
		};
	}

	const appInfo = await window.Capacitor.Plugins.App.getInfo();
	const deviceInfo = await window.Capacitor.Plugins.Device.getInfo();
	const info: any = {
		"Obsidian version": `${appInfo.version} (${appInfo.build})`,
		"API version": apiVersion,
		"Operating system": `${deviceInfo.platform} ${deviceInfo.osVersion} (${deviceInfo.manufacturer} ${deviceInfo.model})`,
	};
	const webViewVersion = await getWebViewVersion();
	if (webViewVersion) {
		info["WebView version"] = webViewVersion;
	}
	return info;
}
