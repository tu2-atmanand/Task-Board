import { t } from "src/utils/lang/helper";
import { taskStatuses } from "./Enums";
import { taskItem } from "./TaskItem";

export const priorityEmojis: { [key: number]: string } = {
	0: "0",
	1: "🔺", // Highest
	2: "⏫", // High
	3: "🔼", // Medium
	4: "🔽", // Low
	5: "⏬", // Lowest
};

// Helper function to get priority emoji
export const getPriorityEmoji = (priority: number): string => {
	return priorityEmojis[priority] || "";
};

// Priority Options
export const priorityOptions = [
	{ value: 0, text: t("none") },
	{ value: 1, text: t("highest") + " : 🔺" },
	{ value: 2, text: t("high") + " : ⏫" },
	{ value: 3, text: t("medium") + " : 🔼" },
	{ value: 4, text: t("low") + " : 🔽" },
	{ value: 5, text: t("lowest") + " : ⏬" },
];

// TODO : From the following values I am only going to display the ones that are selected by user in the tasks plugin settings.
export const taskStatusesDropdown = [
	{ value: taskStatuses.unchecked, text: "Unchecked [ ]" },
	{ value: taskStatuses.regular, text: "Regular [x]" },
	{ value: taskStatuses.checked, text: "Checked [X]" },
	{ value: taskStatuses.dropped, text: "Dropped [-]" },
	{ value: taskStatuses.forward, text: "Forward [>]" },
	{ value: taskStatuses.migrated, text: "Migrated [<]" },
	{ value: taskStatuses.date, text: "Date [D]" },
	{ value: taskStatuses.question, text: "Question [?]" },
	{ value: taskStatuses.halfDone, text: "In progress [/]" },
	{ value: taskStatuses.add, text: "Add [+]" },
	{ value: taskStatuses.research, text: "Research [R]" },
	{ value: taskStatuses.important, text: "Important [!]" },
	{ value: taskStatuses.idea, text: "Idea [i]" },
	{ value: taskStatuses.brainstorm, text: "Brainstorm [B]" },
	{ value: taskStatuses.pro, text: "Pro [P]" },
	{ value: taskStatuses.con, text: "Con [C]" },
	{ value: taskStatuses.quote, text: "Quote [Q]" },
	{ value: taskStatuses.note, text: "Note [N]" },
	{ value: taskStatuses.bookmark, text: "Bookmark [b]" },
	{ value: taskStatuses.information, text: "Information [I]" },
	{ value: taskStatuses.paraphrase, text: "Paraphrase [p]" },
	{ value: taskStatuses.location, text: "Location [L]" },
	{ value: taskStatuses.example, text: "Example [E]" },
	{ value: taskStatuses.answer, text: "Answer [A]" },
	{ value: taskStatuses.reward, text: "Reward [r]" },
	{ value: taskStatuses.choice, text: "Choice [c]" },
	{ value: taskStatuses.doing, text: "Doing [d]" },
	{ value: taskStatuses.time, text: "Time [T]" },
	{ value: taskStatuses.character, text: "Character [@]" },
	{ value: taskStatuses.talk, text: "Talk [t]" },
	{ value: taskStatuses.outline, text: "Outline [o]" },
	{ value: taskStatuses.conflict, text: "Conflict [~]" },
	{ value: taskStatuses.world, text: "World [W]" },
	{ value: taskStatuses.find, text: "Find [f]" },
	{ value: taskStatuses.foreshadow, text: "Foreshadow [F]" },
	{ value: taskStatuses.favorite, text: "Favorite [H]" },
	{ value: taskStatuses.symbolism, text: "Symbolism [&]" },
	{ value: taskStatuses.secret, text: "Secret [s]" },
];

export const taskItemEmpty: taskItem = {
	id: 0,
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
	status: taskStatuses.unchecked,
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
};
