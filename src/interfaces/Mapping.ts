import { t } from "src/utils/lang/helper";
import { defaultTaskStatuses } from "./Enums";
import { taskItem } from "./TaskItem";
import { CustomStatus } from "./GlobalSettings";

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

export const getCustomStatusOptionsForDropdown = (
	statusConfigs: CustomStatus[],
): statusDropDownOption[] => {
	return statusConfigs.map(({ symbol, name }) => ({
		value: symbol,
		name: name,
		text: `${name} : [${symbol}]`,
	}));
};

// NOTE : Dont use the below array for dropdowns directly. Use it from the settings configured by the user.
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
