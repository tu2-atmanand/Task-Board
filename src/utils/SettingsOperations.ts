import fs from "fs";
import path from "path";

// Load globalSettings to check for dayPlannerPlugin value
export const loadGlobalSettings = () => {
	const basePath = (window as any).app.vault.adapter.basePath;
	const settingsPath = path.join(
		basePath,
		".obsidian",
		"plugins",
		"Task-Board",
		"data.json"
	);

	try {
		const settingsData = fs.readFileSync(settingsPath, "utf8");
		return JSON.parse(settingsData);
	} catch (error) {
		console.error("Error loading globalSettings:", error);
		return {};
	}
};
