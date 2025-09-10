import { t } from "src/utils/lang/helper";

export interface taskLocation {
	startLine: number; // The line number where the task starts
	startCharIndex: number; // The character position where the task starts
	endLine: number; // The line number where the task ends
	endCharIndex: number; // The character position where the task ends
}

export interface taskItem {
	id: number;
	legacyId: string; // Legacy ID to support Tasks plugin id property
	title: string;
	body: string[];
	createdDate: string;
	startDate: string;
	scheduledDate: string;
	due: string;
	tags: string[];
	frontmatterTags: string[]; // Tags extracted from frontmatter
	time: string;
	priority: number;
	status: string;
	filePath: string;
	taskLocation: taskLocation;
	dependsOn?: string[]; // Array of task IDs that this task depends on
	reminder?: string; // A date-time value.
	completion?: string;
	cancelledDate?: string;
}

export interface noteItem {
	filePath: string;
	frontmatter: any; // The frontmatter of the note
	reminder: string; // A date-time value.
}

export interface jsonCacheData {
	VaultName: string; // Name of the vault
	Modified_at: string; // Last modified date of the JSON file
	Pending: {
		[filePath: string]: taskItem[]; // Maps file paths to arrays of pending tasks
	};
	Completed: {
		[filePath: string]: taskItem[]; // Maps file paths to arrays of completed tasks
	};
	Notes: noteItem[];
}

export interface tasksJsonData {
	Pending: {
		[filePath: string]: taskItem[]; // Maps file paths to arrays of pending tasks
	};
	Completed: {
		[filePath: string]: taskItem[]; // Maps file paths to arrays of completed tasks
	};
}

export interface taskJsonMerged {
	Pending: taskItem[];
	Completed: taskItem[];
}

export const priorityEmojis: { [key: number]: string } = {
	0: "0",
	1: "🔺",
	2: "⏫",
	3: "🔼",
	4: "🔽",
	5: "⏬",
};

// Helper function to get priority emoji
export const getPriorityEmoji = (priority: number): string => {
	const priorityEmojis: { [key: number]: string } = {
		1: "🔺", // Highest
		2: "⏫", // High
		3: "🔼", // Medium
		4: "🔽", // Low
		5: "⏬", // Lowest
	};
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

export enum taskStatuses {
	unchecked = " ",
	regular = "x",
	checked = "X",
	dropped = "-",
	forward = ">",
	migrated = "<",
	date = "D",
	question = "?",
	halfDone = "/",
	"In progress" = "/",
	add = "+",
	research = "R",
	important = "!",
	idea = "i",
	brainstorm = "B",
	pro = "P",
	con = "C",
	quote = "Q",
	note = "N",
	bookmark = "b",
	information = "I",
	paraphrase = "p",
	location = "L",
	example = "E",
	answer = "A",
	reward = "r",
	choice = "c",
	doing = "d",
	time = "T",
	character = "@",
	talk = "t",
	outline = "O",
	conflict = "~",
	world = "W",
	find = "f",
	foreshadow = "F",
	favorite = "H",
	symbolism = "&",
	secret = "s",
}

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
	{ value: taskStatuses.halfDone, text: "Half-done [/]" },
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
