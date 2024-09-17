import { BoardConfig } from "./KanbanBoard";

export interface globalSettingsData {
			defaultColumnNames: {
				today: string;
				tomorrow: string;
				future: string;
				undated: string;
				otherTags: string;
				untagged: string;
				completed: string;
			};
			filters: string[];
			firstDayOfWeek?: string;
			ignoreFileNameDates: boolean;
			taskCompletionFormat: string;
			taskCompletionInLocalTime: boolean;
			taskCompletionShowUtcOffset: boolean;
			autoAddDue: boolean;
			scanVaultAtStartup: boolean;
			dayPlannerPlugin: boolean;
}

// Define the interface for GlobalSettings based on your JSON structure
export interface GlobalSettings {
	version: string;
	data: {
		boardConfigs: BoardConfig[];
		globalSettings: globalSettingsData;
	};
}

export const DEFAULT_SETTINGS: GlobalSettings = {
	version: "",
	data: {
		boardConfigs:[],
		globalSettings: {
			defaultColumnNames: {
				today: "",
				tomorrow: "",
				future: "",
				undated: "",
				otherTags: "",
				untagged: "",
				completed: "",
			},
			filters: [],
			firstDayOfWeek: "Mon",
			ignoreFileNameDates: false,
			taskCompletionFormat: "ObsidianTasks",
			taskCompletionInLocalTime: true,
			taskCompletionShowUtcOffset: true,
			autoAddDue: true,
			scanVaultAtStartup: false,
			dayPlannerPlugin: false,
		},
	},
};
