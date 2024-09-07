// Define the interface for GlobalSettings based on your JSON structure
export interface GlobalSettings {
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
	firstDayOfWeek: string;
	ignoreFileNameDates: boolean;
	taskCompletionFormat: string;
	taskCompletionInLocalTime: boolean;
	taskCompletionShowUtcOffset: boolean;
	autoAddDue: boolean;
	ScanVaultAtStartup: boolean;
}
