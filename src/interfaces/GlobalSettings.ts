import { BoardConfigs } from "./BoardConfigs";

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
	columnWidth: string;
	showHeader: boolean;
	showFooter:boolean;
}

// Define the interface for GlobalSettings based on your JSON structure
export interface PluginDataJson {
	version: string;
	data: {
		boardConfigs: BoardConfigs;
		globalSettings: globalSettingsData;
	};
}

export const DEFAULT_SETTINGS: PluginDataJson = {
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
			taskCompletionDateTimePattern: "yyyy-MM-DD/HH:mm",
			dailyNotesPluginComp: false,
			dueDateFormat: "",
			taskCompletionInLocalTime: true,
			taskCompletionShowUtcOffset: false,
			autoAddDue: false,
			scanVaultAtStartup: false,
			dayPlannerPlugin: false,
			realTimeScanning: false,
			columnWidth: "300px",
			showHeader: true,
			showFooter: true,
		},
	},
};
