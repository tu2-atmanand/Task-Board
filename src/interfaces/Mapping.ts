import { bugReporterManagerInsatance } from "../managers/BugReporter.js";
import { t } from "../utils/lang/helper.js";
import { defaultTaskStatuses } from "./Enums.js";
import { CustomStatus } from "./GlobalSettings.js";
import { taskItem } from "./TaskItem.js";

export const priorityEmojis: { [key: number]: string } = {
	0: "0",
	1: "🔺", // Highest
	2: "⏫", // High
	3: "🔼", // Medium
	4: "🔽", // Low
	5: "⏬", // Lowest
};

export interface statusDropDownOption {
	value: string;
	name: string;
	text: string;
}

export interface priorityDropDownOption {
	value: number;
	text: string;
}

// Helper function to get priority emoji
export const getPriorityEmoji = (priority: number): string => {
	return priorityEmojis[priority] || "";
};

// Priority Options - function to ensure translations are loaded
export const getPriorityOptionsForDropdown = (): priorityDropDownOption[] => [
	{ value: 0, text: "0 - " + t("none") },
	{ value: 1, text: "1 - " + t("highest") + " : 🔺" },
	{ value: 2, text: "2 - " + t("high") + " : ⏫" },
	{ value: 3, text: "3 - " + t("medium") + " : 🔼" },
	{ value: 4, text: "4 - " + t("low") + " : 🔽" },
	{ value: 5, text: "5 - " + t("lowest") + " : ⏬" },
];

// Legacy export for backward compatibility
export const priorityOptions = getPriorityOptionsForDropdown();

export interface StatusDropdownOption {
	value: string; // The symbol used as option value
	label: string; // Display text: "Name [symbol]"
	tooltip?: string; // Optional hover text
	group?: string; // Optional group/type for optgroup
	metadata?: CustomStatus; // Full status object for advanced use
}

export interface GroupedStatusOptions {
	type: string;
	label: string; // Human-readable group label
	options: StatusDropdownOption[];
}

export type StatusDropdownOutput =
	| { type: "flat"; options: StatusDropdownOption[] }
	| { type: "grouped"; groups: GroupedStatusOptions[] };

export interface GetCustomStatusOptionsConfig {
	mode?: "flat" | "grouped"; // Output format
	includePlaceholder?: boolean; // Add "Select..." option
	placeholderText?: string; // Custom placeholder text
	showTooltips?: boolean; // Include tooltip with next status
	formatLabel?: (status: CustomStatus) => string; // Custom label formatter
	groupLabelFormatter?: (type: string) => string; // Custom group label
	validateSymbols?: boolean; // Check for duplicate symbols
}

/**
 * Generates dropdown options from CustomStatus array with validation and grouping support.
 *
 * @param statusConfigs - Array of CustomStatus objects from settings
 * @param config - Optional configuration for output format and behavior
 * @returns Structured options ready for rendering in <select>
 */
export const getCustomStatusOptionsForDropdown = (
	statusConfigs: CustomStatus[] | null | undefined,
	config: GetCustomStatusOptionsConfig = {},
): StatusDropdownOutput => {
	const {
		mode = "flat",
		includePlaceholder = false,
		placeholderText = t("select-status") || "Select a status...",
		showTooltips = true,
		formatLabel = (status) => `${status.name} [${status.symbol}]`,
		groupLabelFormatter = (type) => type,
		validateSymbols = true,
	} = config;

	// 🔒 Validation: Handle null/undefined/empty input
	if (
		!statusConfigs ||
		!Array.isArray(statusConfigs) ||
		statusConfigs.length === 0
	) {
		bugReporterManagerInsatance.addToLogs(
			189,
			"Empty or invalid statusConfigs provided",
			"Mapping.ts/getCustomStatusOptionsForDropdown",
		);
		return mode === "grouped"
			? { type: "grouped", groups: [] }
			: {
					type: "flat",
					options: includePlaceholder
						? [
								{
									value: " ",
									label: placeholderText,
									tooltip: undefined,
								},
							]
						: [],
				};
	}

	// 🔒 Validation: Filter out invalid status entries
	const validStatuses = statusConfigs.filter((status, index) => {
		const isValid =
			status &&
			typeof status.symbol === "string" &&
			typeof status.name === "string" &&
			status.name.trim() !== "" &&
			typeof status.type === "string";

		if (!isValid) {
			bugReporterManagerInsatance.addToLogs(
				190,
				`Invalid status at index ${index}: ${status}`,
				"Mapping.ts/getCustomStatusOptionsForDropdown",
			);
		}
		return isValid;
	});

	if (validStatuses.length === 0) {
		bugReporterManagerInsatance.addToLogs(
			197,
			`No valid statuses after filtering`,
			"Mapping.ts/getCustomStatusOptionsForDropdown",
		);
		return mode === "grouped"
			? { type: "grouped", groups: [] }
			: { type: "flat", options: [] };
	}

	// 🔒 Validation: Check for duplicate symbols (can cause select bugs)
	if (validateSymbols) {
		const symbolCounts = new Map<string, number>();
		validStatuses.forEach((s) => {
			symbolCounts.set(s.symbol, (symbolCounts.get(s.symbol) || 0) + 1);
		});

		const duplicates = Array.from(symbolCounts.entries())
			.filter(([_, count]) => count > 1)
			.map(([symbol]) => symbol);

		if (duplicates.length > 0) {
			bugReporterManagerInsatance.addToLogs(
				191,
				`Duplicate status symbols detected: ${duplicates.join(", ")}.\nThis may cause unexpected behavior in dropdown selection.`,
				"Mapping.ts/getCustomStatusOptionsForDropdown",
			);
			// Optional: Deduplicate by keeping first occurrence
			// validStatuses = Array.from(new Map(validStatuses.map(s => [s.symbol, s])).values());
		}
	}

	// 🔧 Transform statuses into dropdown options
	const createOption = (status: CustomStatus): StatusDropdownOption => ({
		value: status.symbol,
		label: formatLabel(status),
		tooltip: showTooltips
			? `${t("next")}: [${status.nextStatusSymbol}]`
			: undefined,
		group: status.type,
		metadata: status, // Keep full object for advanced use cases
	});

	const baseOptions = validStatuses.map(createOption);

	// 🎯 Return flat structure
	if (mode === "flat") {
		const options = includePlaceholder
			? [
					{ value: " ", label: placeholderText, tooltip: undefined },
					...baseOptions,
				]
			: baseOptions;

		return { type: "flat", options };
	}

	// 🎯 Return grouped structure
	const grouped = validStatuses.reduce(
		(acc, status) => {
			const existingGroup = acc.find((g) => g.type === status.type);
			if (existingGroup) {
				existingGroup.statuses.push(status);
			} else {
				acc.push({ type: status.type, statuses: [status] });
			}
			return acc;
		},
		[] as Array<{ type: string; statuses: CustomStatus[] }>,
	);

	const groups: GroupedStatusOptions[] = grouped.map((group) => ({
		type: group.type,
		label: groupLabelFormatter(group.type),
		options: group.statuses.map(createOption),
	}));

	// Sort groups alphabetically by label (optional)
	groups.sort((a, b) => a.label.localeCompare(b.label));

	return { type: "grouped", groups };
};

/**
 * @deprecated - Dont use the below array for dropdowns directly.
 * Use the "Custom statuses" setting configured by user.
 * only user configured statuses will be used by this plugin.
 */
export const taskStatusesDropdown = [
	{ value: defaultTaskStatuses.unchecked, text: "Unchecked [ ]" },
	{ value: defaultTaskStatuses.regular, text: "Regular [x]" },
	{ value: defaultTaskStatuses.checked, text: "Checked [X]" },
	{ value: defaultTaskStatuses.dropped, text: "Dropped [-]" },
	{ value: defaultTaskStatuses.forward, text: "Forward [>]" },
	{ value: defaultTaskStatuses.migrated, text: "Migrated [<]" },
	{ value: defaultTaskStatuses.date, text: "Date [D]" },
	{ value: defaultTaskStatuses.question, text: "Question [?]" },
	{ value: defaultTaskStatuses.halfDone, text: "In progress [/]" },
	{ value: defaultTaskStatuses.add, text: "Add [+]" },
	{ value: defaultTaskStatuses.research, text: "Research [R]" },
	{ value: defaultTaskStatuses.important, text: "Important [!]" },
	{ value: defaultTaskStatuses.idea, text: "Idea [i]" },
	{ value: defaultTaskStatuses.brainstorm, text: "Brainstorm [B]" },
	{ value: defaultTaskStatuses.pro, text: "Pro [P]" },
	{ value: defaultTaskStatuses.con, text: "Con [C]" },
	{ value: defaultTaskStatuses.quote, text: "Quote [Q]" },
	{ value: defaultTaskStatuses.note, text: "Note [N]" },
	{ value: defaultTaskStatuses.bookmark, text: "Bookmark [b]" },
	{ value: defaultTaskStatuses.information, text: "Information [I]" },
	{ value: defaultTaskStatuses.paraphrase, text: "Paraphrase [p]" },
	{ value: defaultTaskStatuses.location, text: "Location [L]" },
	{ value: defaultTaskStatuses.example, text: "Example [E]" },
	{ value: defaultTaskStatuses.answer, text: "Answer [A]" },
	{ value: defaultTaskStatuses.reward, text: "Reward [r]" },
	{ value: defaultTaskStatuses.choice, text: "Choice [c]" },
	{ value: defaultTaskStatuses.doing, text: "Doing [d]" },
	{ value: defaultTaskStatuses.time, text: "Time [T]" },
	{ value: defaultTaskStatuses.character, text: "Character [@]" },
	{ value: defaultTaskStatuses.talk, text: "Talk [t]" },
	{ value: defaultTaskStatuses.outline, text: "Outline [o]" },
	{ value: defaultTaskStatuses.conflict, text: "Conflict [~]" },
	{ value: defaultTaskStatuses.world, text: "World [W]" },
	{ value: defaultTaskStatuses.find, text: "Find [f]" },
	{ value: defaultTaskStatuses.foreshadow, text: "Foreshadow [F]" },
	{ value: defaultTaskStatuses.favorite, text: "Favorite [H]" },
	{ value: defaultTaskStatuses.symbolism, text: "Symbolism [&]" },
	{ value: defaultTaskStatuses.secret, text: "Secret [s]" },
];

export const taskItemEmpty: taskItem = {
	id: "",
	legacyId: "",
	title: "",
	body: [],
	createdDate: "",
	startDate: "",
	scheduledDate: "",
	due: "",
	tags: [],
	frontmatterTags: [],
	time: "",
	priority: 0,
	reminder: "",
	completion: "",
	cancelledDate: "",
	filePath: "",
	taskLocation: {
		startLine: 0,
		startCharIndex: 0,
		endLine: 0,
		endCharIndex: 0,
	},
	status: defaultTaskStatuses.unchecked,
};

export const taskItemKeyToNameMapping: { [key: string]: string } = {
	id: "ID",
	title: "Title",
	body: "Body",
	status: "Status",
	priority: "Priority",
	tags: "Tags",
	time: "Time",
	reminder: "Reminder",
	createdDate: "Created date",
	startDate: "Start date",
	scheduledDate: "Scheduled date",
	due: "Due date",
	dependsOn: "Depends on",
	frontmatterTags: "Frontmatter tags",
	completion: "Completed date",
	cancelledDate: "Cancelled date",
	filePath: "Source file",
	taskLocation: "Task location",
	dateModified: "Last modified",
};

export const columnTypeAndNameMapping: { [key: string]: string } = {
	undated: "Undated",
	dated: "Dated",
	namedTag: "Tagged",
	untagged: "Untagged",
	otherTags: "Other Tags",
	taskStatus: "Status",
	taskPriority: "Priority",
	pathFiltered: "Path filtered",
	completed: "Completed",
	allPending: "All pending tasks",
};
