import TaskBoard from "../../../main.js";
import { taskPropertiesNames, TagColorType } from "../../interfaces/Enums.js";
import { priorityEmojis } from "../../interfaces/Mapping.js";
import { taskItem } from "../../interfaces/TaskItem.js";
import { isTaskCompleted } from "../../utils/CheckBoxUtils.js";
import {
	isTaskNotePresentInTags,
	getStatusNameFromStatusSymbol,
} from "../../utils/taskNote/TaskNoteUtils.js";
import { updateRGBAOpacity } from "../../utils/UIHelpers.js";

/**
 * Creates an HTML DOM element to be rendered as a task card for the given taskitem data.
 * This DOM element has no interaction capabilities and should be only used for rendering purposes.
 * In functionalities where we simply want to show the tasks as card to select them as option.
 *
 * @param plugin - The plugin instance.
 * @param task - The task to be rendered as card.
 * @returns An HTML DOM element which looks exactly like the task card but without any interaction capabilities.
 */
export function createTaskCard(plugin: TaskBoard, task: taskItem): HTMLElement {
	const globalSettings = plugin.settings.data;
	const taskNoteIdentifierTag = plugin.settings.data.taskNoteIdentifierTag;
	const isTaskNote = isTaskNotePresentInTags(
		taskNoteIdentifierTag,
		task.tags,
	);
	const isThisTaskCompleted = isTaskNote
		? isTaskCompleted(task.status, true, plugin.settings)
		: isTaskCompleted(task.title, false, plugin.settings);

	const container = activeDocument.createElement("div");
	container.className = "taskItemContainer";

	const card = activeDocument.createElement("div");
	card.className = `taskItem${isThisTaskCompleted ? " completed" : ""}`;
	card.setAttribute("data-task-id", String(task.id));

	const colorIndicator = activeDocument.createElement("div");
	colorIndicator.className = "colorIndicator";
	card.appendChild(colorIndicator);

	const main = activeDocument.createElement("div");
	main.className = "taskItemMainContent";

	// Header
	const header = activeDocument.createElement("div");
	header.className = "taskItemHeader";

	if (
		globalSettings.visiblePropertiesList?.includes(
			taskPropertiesNames.FilePathInHeader,
		) &&
		task.filePath
	) {
		const topFile = activeDocument.createElement("div");
		topFile.className = "taskitemHeaderTopFilename";
		topFile.setAttribute("aria-label", task.filePath);
		const val = activeDocument.createElement("div");
		val.className = "taskitemHeaderTopFilenameValue";
		val.textContent = task.filePath.split("/").pop() || "";
		topFile.appendChild(val);
		header.appendChild(topFile);
	}

	const headerBottom = activeDocument.createElement("div");
	headerBottom.className = "taskItemHeaderBottom";

	const headerLeft = activeDocument.createElement("div");
	headerLeft.className = "taskItemHeaderLeft";

	if (
		globalSettings.visiblePropertiesList?.includes(
			taskPropertiesNames.Priority,
		) &&
		task.priority > 0
	) {
		const pr = activeDocument.createElement("div");
		pr.className = "taskItemPrio";
		pr.textContent = priorityEmojis[task.priority] || "";
		headerLeft.appendChild(pr);
	}

	if (
		globalSettings.visiblePropertiesList?.includes(
			taskPropertiesNames.Tags,
		) &&
		(task.tags.length > 0 || task.frontmatterTags.length > 0)
	) {
		const tagsDiv = activeDocument.createElement("div");
		tagsDiv.className = "taskItemTags";

		task.tags.forEach((tag) => {
			const tagEl = activeDocument.createElement("div");
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
			if (isTagBg && tagColor) tagEl.addClass("tb_color_white ");
			if (isTagBg) tagEl.style.backgroundColor = tagColor ?? "";
			else if (dimmedTagColor)
				tagEl.style.backgroundColor = dimmedTagColor;
			if (!isTagBg && tagColor) tagEl.style.color = tagColor;
			tagEl.textContent = tag;
			tagsDiv.appendChild(tagEl);
		});

		task.frontmatterTags.forEach((tag) => {
			const fm = activeDocument.createElement("div");
			fm.className = "taskItemTagFrontmatter";
			fm.title = "Tag from note's frontmatter (read-only)";
			fm.textContent = tag;
			tagsDiv.appendChild(fm);
		});

		headerLeft.appendChild(tagsDiv);
	}

	headerBottom.appendChild(headerLeft);

	const headerRight = activeDocument.createElement("div");
	headerRight.className = "taskItemHeaderRight";
	if (
		globalSettings.visiblePropertiesList?.includes(
			taskPropertiesNames.ID,
		) &&
		task.legacyId
	) {
		const idCont = activeDocument.createElement("div");
		idCont.className = "taskItemPropertyID";
		const label = activeDocument.createElement("div");
		label.className = "taskItemPropertyIDLabel";
		label.textContent = "ID";
		const value = activeDocument.createElement("div");
		value.className = "taskItemPropertyIDValue";
		value.textContent = String(task.legacyId);
		idCont.appendChild(label);
		idCont.appendChild(value);
		headerRight.appendChild(idCont);
	}

	headerBottom.appendChild(headerRight);
	header.appendChild(headerBottom);
	main.appendChild(header);

	// Body (title)
	const body = activeDocument.createElement("div");
	body.className = "taskItemMainBody";
	const titleWrap = activeDocument.createElement("div");
	titleWrap.className = "taskItemMainBodyTitleNsubTasks";

	if (
		globalSettings.visiblePropertiesList?.includes(
			taskPropertiesNames.Checkbox,
		)
	) {
		const cb = activeDocument.createElement("input");
		cb.type = "checkbox";
		cb.checked = task.status === " " ? false : true;
		cb.className = "taskItemCheckbox";
		cb.setAttribute("data-task", String(task.status));
		titleWrap.appendChild(cb);
	}

	const bodyContent = activeDocument.createElement("div");
	bodyContent.className = "taskItemBodyContent";
	const title = activeDocument.createElement("div");
	title.className = "taskItemTitle";
	title.textContent = task.title || "";
	bodyContent.appendChild(title);
	titleWrap.appendChild(bodyContent);
	body.appendChild(titleWrap);
	main.appendChild(body);

	// Footer
	const footer = activeDocument.createElement("div");
	footer.className = "taskItemFooter";
	if (
		globalSettings.visiblePropertiesList?.includes(
			taskPropertiesNames.Status,
		) &&
		task.status
	) {
		const stat = activeDocument.createElement("div");
		stat.className = "taskItemFooterPropertyContainerEmoji";
		const val = activeDocument.createElement("div");
		val.className = "taskItemFooterPropertyContainerValue";
		val.textContent = getStatusNameFromStatusSymbol(
			task.status,
			globalSettings.customStatuses,
		);
		stat.appendChild(val);
		footer.appendChild(stat);
	}
	if (
		globalSettings.visiblePropertiesList?.includes(
			taskPropertiesNames.FilePath,
		) &&
		task.filePath
	) {
		const fp = activeDocument.createElement("div");
		fp.className = "taskItemFooterPropertyContainerEmoji";
		const val = activeDocument.createElement("div");
		val.className = "taskItemFooterPropertyContainerValue";
		val.setAttribute("aria-label", task.filePath);
		val.textContent = task.filePath.split("/").pop() || "";
		fp.appendChild(val);
		footer.appendChild(fp);
	}

	main.appendChild(footer);

	card.appendChild(main);
	container.appendChild(card);
	return container;
}

export default createTaskCard;
