import { BoardConfig } from "./KanbanBoard";

export interface globalSettingsData {
	scanFilters: {
		files: {
			polarity: number;
			values: string[];
		};
		folders: {
			polarity: number;
			values: string[];
		};
		tags: {
			polarity: number;
			values: string[];
		};
	};
	firstDayOfWeek?: string;
	ignoreFileNameDates: boolean;
	taskCompletionFormat: string;
	taskCompletionDateTimePattern: string;
	dailyNotesPluginComp: boolean;
	dueDateFormat: string;
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
					polarity: 0,
					values: [],
				},
				folders: {
					polarity: 0,
					values: [],
				},
				tags: {
					polarity: 0,
					values: [],
				},
			},
			firstDayOfWeek: "Mon",
			ignoreFileNameDates: false,
			taskCompletionFormat: "",
			taskCompletionDateTimePattern: "",
			dailyNotesPluginComp: false,
			dueDateFormat: "",
			taskCompletionInLocalTime: true,
			taskCompletionShowUtcOffset: false,
			autoAddDue: false,
			scanVaultAtStartup: false,
			dayPlannerPlugin: false,
			realTimeScanning: false,
		},
	},
};
