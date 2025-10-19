export enum taskPropertyFormatOptions {
	default = "1",
	tasksPlugin = "2",
	dataviewPlugin = "3",
	obsidianNative = "4",
}

export enum EditButtonMode {
	None = "none",
	Modal = "popUp",
	View = "view",
	TasksPluginModal = "tasksPluginModal",
	NoteInTab = "noteInTab",
	NoteInSplit = "noteInSplit",
	NoteInWindow = "noteInWindow",
	NoteInHover = "noteInHover",
}

export enum UniversalDateOptions {
	startDate = "startDate",
	scheduledDate = "scheduledDate",
	dueDate = "due",
}

export enum universalDateOptionsNames {
	startDate = "Start Date",
	scheduledDate = "Scheduled Date",
	dueDate = "Due Date",
}

export enum TagColorType {
	Text = "text",
	Background = "background",
}

export enum NotificationService {
	None = "none",
	ReminderPlugin = "reminderPlugin",
	NotifianApp = "notifianApp",
	ObsidApp = "obsiApp",
}

export enum cardSectionsVisibilityOptions {
	showSubTasksOnly = "showSubTasksOnly",
	showDescriptionOnly = "showDescriptionOnly",
	showBoth = "showBoth",
	hideBoth = "hideBoth",
}

export enum HideableTaskProperty {
	ID = "id",
	Tags = "tags",
	CreatedDate = "createdDate",
	StartDate = "startDate",
	ScheduledDate = "scheduledDate",
	DueDate = "dueDate",
	CompletionDate = "completionDate",
	CancelledDate = "cancelledDate",
	OnCompletion = "on-completion",
	Priority = "priority",
	Recurring = "recurring",
	Time = "time",
	Dependencies = "dependencies",
	Reminder = "reminder",
}

export enum viewTypeNames {
	kanban = "kanban",
	map = "map",
}

export enum taskStatuses {
	unchecked = " ",
	incomplete = " ",
	pending = " ",
	regular = "x",
	checked = "X",
	dropped = "-",
	forward = ">",
	migrated = "<",
	date = "D",
	question = "?",
	halfDone = "/",
	inProgress = "/",
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

export enum colType {
	undated = "undated",
	dated = "dated",
	namedTag = "namedTag",
	untagged = "untagged",
	otherTags = "otherTags",
	taskStatus = "taskStatus",
	taskPriority = "taskPriority",
	pathFiltered = "pathFiltered",
	completed = "completed",
}
