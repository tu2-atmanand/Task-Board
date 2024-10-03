import { BoardConfig } from "./KanbanBoard";

export interface globalSettingsData {
	scanFilters: {
		files: {
			polarity: string;
			values: string[];
		};
		folders: {
			polarity: string;
			values: string[];
		};
		tags: {
			polarity: string;
			values: string[];
		};
	};
	firstDayOfWeek?: string;
	ignoreFileNameDates: boolean;
	taskCompletionFormat: string;
	taskCompletionInLocalTime: boolean;
	taskCompletionShowUtcOffset: boolean;
	autoAddDue: boolean;
	scanVaultAtStartup: boolean;
	dayPlannerPlugin: boolean;
	realTimeScanning: boolean;
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
		boardConfigs: [],
		globalSettings: {
			scanFilters: {
				files: {
					polarity: "",
					values: "",
				},
				folders: {
					polarity: "",
					values: "",
				},
				tags: {
					polarity: "",
					values: "",
				},
			},
			firstDayOfWeek: "Mon",
			ignoreFileNameDates: false,
			taskCompletionFormat: "ObsidianTasks",
			taskCompletionInLocalTime: true,
			taskCompletionShowUtcOffset: false,
			autoAddDue: false,
			scanVaultAtStartup: false,
			dayPlannerPlugin: false,
			realTimeScanning: false,
		},
	},
};
