import TaskBoard from "../../../../main.js";
import {
	DEFAULT_TASK_CACHE_KEYS,
	TagColorType,
} from "../../../interfaces/Enums.js";
import { priorityEmojis } from "../../../interfaces/Mapping.js";
import { taskItem } from "../../../interfaces/TaskItem.js";
import { isTaskCompleted } from "../../../utils/CheckBoxUtils.js";
import { cleanTaskTitleLegacy } from "../../../utils/task_line/TaskContentFormatter.js";
import { isTaskNotePresentInTags } from "../../../utils/task_note/TaskNoteUtils.js";
import {
	getStatusNameFromStatusSymbol,
	normalizeTaskItem,
} from "../../../utils/TaskItemUtils.js";
import { updateRGBAOpacity } from "../../../utils/UIHelpers.js";

/**
 * Creates an HTML DOM element to be rendered as a task card for the given taskitem data.
 * This DOM element has no interaction capabilities and should be only used for rendering purposes.
 * In functionalities where we simply want to show the tasks as card to select them as option.
 * This will allow an efficient rendering of huge number of tasks as cards without consuming much
 * rendering resources and creating unnecessary hooks and event listeners.
 *
 * @param plugin - The plugin instance.
 * @param task - The task to be rendered as card.
 * @returns An HTML DOM element which looks exactly like the task card but without any interaction capabilities.
 */
export function createTaskCard(
	plugin: TaskBoard,
	taskItemValue: taskItem,
	propertiesVisibleInUI: string[],
): HTMLElement {
	const task = normalizeTaskItem(taskItemValue);
	const globalSettings = plugin.settings.data;
	const taskNoteIdentifierTag = plugin.settings.data.taskNoteIdentifierTag;
	const isTaskNote = isTaskNotePresentInTags(
		taskNoteIdentifierTag,
		task[DEFAULT_TASK_CACHE_KEYS.Tags],
	);
	const isThisTaskCompleted = isTaskNote
		? isTaskCompleted(
				task[DEFAULT_TASK_CACHE_KEYS.Status],
				true,
				plugin.settings,
			)
		: isTaskCompleted(
				task[DEFAULT_TASK_CACHE_KEYS.Title],
				false,
				plugin.settings,
			);

	const container = createDiv("div");
	container.className = "taskItemContainer";

	const card = createDiv("div");
	card.className = `taskItem${isThisTaskCompleted ? " completed" : ""}`;
	card.setAttribute("data-task-id", String(task[DEFAULT_TASK_CACHE_KEYS.ID]));

	const colorIndicator = createDiv("div");
	colorIndicator.className = "colorIndicator";
	card.appendChild(colorIndicator);

	const main = createDiv("div");
	main.className = "taskItemMainContent";

	// Header
	const header = createDiv("div");
	header.className = "taskItemHeader";

	// if (
	// 	propertiesVisibleInUI.includes(
	// 		DEFAULT_TASK_CACHE_KEYS.FilePathInHeader,
	// 	) &&
	// 	task[DEFAULT_TASK_CACHE_KEYS.FilePath]
	// ) {
	// 	const topFile = createDiv("div");
	// 	topFile.className = "taskitemHeaderTopFilename";
	// 	topFile.setAttribute(
	// 		"aria-label",
	// 		task[DEFAULT_TASK_CACHE_KEYS.FilePath],
	// 	);
	// 	const val = createDiv("div");
	// 	val.className = "taskitemHeaderTopFilenameValue";
	// 	val.textContent =
	// 		task[DEFAULT_TASK_CACHE_KEYS.FilePath].split("/").pop() || "";
	// 	topFile.appendChild(val);
	// 	header.appendChild(topFile);
	// }

	const headerBottom = createDiv("div");
	headerBottom.className = "taskItemHeaderBottom";

	const headerLeft = createDiv("div");
	headerLeft.className = "taskItemHeaderLeft";

	if (
		propertiesVisibleInUI.includes(DEFAULT_TASK_CACHE_KEYS.Priority) &&
		task[DEFAULT_TASK_CACHE_KEYS.Priority] > 0
	) {
		const pr = createDiv("div");
		pr.className = "taskItemPrio";
		pr.textContent =
			priorityEmojis[task[DEFAULT_TASK_CACHE_KEYS.Priority]] || "";
		headerLeft.appendChild(pr);
	}

	if (
		propertiesVisibleInUI.includes(DEFAULT_TASK_CACHE_KEYS.Tags) &&
		(task[DEFAULT_TASK_CACHE_KEYS.Tags].length > 0 ||
			task[DEFAULT_TASK_CACHE_KEYS.FrontMatterTags].length > 0)
	) {
		const tagsDiv = createDiv("div");
		tagsDiv.className = "taskItemTags";

		task[DEFAULT_TASK_CACHE_KEYS.Tags].forEach((tag) => {
			const tagEl = createDiv("div");
			tagEl.className = "taskItemTag";
			const isTagBg = globalSettings.tagColorsType === TagColorType.TagBg;
			const isCardBg =
				globalSettings.tagColorsType === TagColorType.CardBg;
			const taskTag = tag.replace("#", "").toLowerCase();
			const customTag = isCardBg
				? undefined
				: globalSettings.tagColors.find(
						(t) =>
							t.name.replace("#", "").toLowerCase() === taskTag,
					);
			const tagColor = customTag?.color;
			const dimmedTagColor = customTag
				? updateRGBAOpacity(customTag.color, 0.1)
				: undefined;
			if (isTagBg && tagColor) tagEl.addClass("tb_color_white");
			if (isTagBg) tagEl.style.backgroundColor = tagColor ?? "";
			else if (dimmedTagColor)
				tagEl.style.backgroundColor = dimmedTagColor;
			if (!isTagBg && tagColor) tagEl.style.color = tagColor;
			tagEl.textContent = tag;
			tagsDiv.appendChild(tagEl);
		});

		task[DEFAULT_TASK_CACHE_KEYS.FrontMatterTags].forEach((tag) => {
			const fm = createDiv("div");
			fm.className = "taskItemTagFrontmatter";
			fm.title = "Tag from note's frontmatter (read-only)";
			fm.textContent = tag;
			tagsDiv.appendChild(fm);
		});

		headerLeft.appendChild(tagsDiv);
	}

	headerBottom.appendChild(headerLeft);

	const headerRight = createDiv("div");
	headerRight.className = "taskItemHeaderRight";
	if (
		propertiesVisibleInUI.includes(DEFAULT_TASK_CACHE_KEYS.ID) &&
		task[DEFAULT_TASK_CACHE_KEYS.LegacyID]
	) {
		const idCont = createDiv("div");
		idCont.className = "taskItemPropertyID";
		const label = createDiv("div");
		label.className = "taskItemPropertyIDLabel";
		label.textContent = "ID";
		const value = createDiv("div");
		value.className = "taskItemPropertyIDValue";
		value.textContent = String(task[DEFAULT_TASK_CACHE_KEYS.LegacyID]);
		idCont.appendChild(label);
		idCont.appendChild(value);
		headerRight.appendChild(idCont);
	}

	headerBottom.appendChild(headerRight);
	header.appendChild(headerBottom);
	main.appendChild(header);

	// Body (title)
	const body = createDiv("div");
	body.className = "taskItemMainBody";
	const titleWrap = createDiv("div");
	titleWrap.className = "taskItemMainBodyTitleNsubTasks";

	if (propertiesVisibleInUI.includes(DEFAULT_TASK_CACHE_KEYS.Checkbox)) {
		const cb = createEl("input");
		cb.type = "checkbox";
		cb.checked =
			task[DEFAULT_TASK_CACHE_KEYS.Status] === " " ? false : true;
		cb.className = "taskItemCheckbox";
		cb.setAttribute(
			"data-task",
			String(task[DEFAULT_TASK_CACHE_KEYS.Status]),
		);
		titleWrap.appendChild(cb);
	}

	const bodyContent = createDiv("div");
	bodyContent.className = "taskItemBodyContent";
	const title = createDiv("div");
	title.className = "taskItemTitle";
	title.textContent =
		cleanTaskTitleLegacy(task, false, globalSettings) || "";
	bodyContent.appendChild(title);
	titleWrap.appendChild(bodyContent);
	body.appendChild(titleWrap);
	main.appendChild(body);

	// Footer
	const footer = createDiv("div");
	footer.className = "taskItemFooter";
	if (
		propertiesVisibleInUI.includes(DEFAULT_TASK_CACHE_KEYS.Status) &&
		task[DEFAULT_TASK_CACHE_KEYS.Status]
	) {
		const stat = createDiv("div");
		stat.className = "taskItemFooterPropertyContainer_EmojiStyle";
		const val = createDiv("div");
		val.className = "taskItemFooterPropertyContainerValue";
		val.textContent = getStatusNameFromStatusSymbol(
			task[DEFAULT_TASK_CACHE_KEYS.Status],
			globalSettings.customStatuses,
		);
		stat.appendChild(val);
		footer.appendChild(stat);
	}
	if (
		propertiesVisibleInUI.includes(DEFAULT_TASK_CACHE_KEYS.FilePath) &&
		task[DEFAULT_TASK_CACHE_KEYS.FilePath]
	) {
		const fp = createDiv("div");
		fp.className = "taskItemFooterPropertyContainer_EmojiStyle";
		const val = createDiv("div");
		val.className = "taskItemFooterPropertyContainerValue";
		val.setAttribute("aria-label", task[DEFAULT_TASK_CACHE_KEYS.FilePath]);
		val.textContent =
			task[DEFAULT_TASK_CACHE_KEYS.FilePath].split("/").pop() || "";
		fp.appendChild(val);
		footer.appendChild(fp);
	}

	main.appendChild(footer);

	card.appendChild(main);
	container.appendChild(card);
	return container;
}

export default createTaskCard;
