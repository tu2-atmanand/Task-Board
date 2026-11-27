let accessibleLabelCounter = 0;

const RESTRICTED_LABEL_HOST_TAGS = new Set([
	"AREA",
	"BASE",
	"BR",
	"COL",
	"EMBED",
	"HR",
	"IMG",
	"INPUT",
	"LINK",
	"META",
	"PARAM",
	"SELECT",
	"SOURCE",
	"TABLE",
	"TBODY",
	"TD",
	"TEXTAREA",
	"TFOOT",
	"TH",
	"THEAD",
	"TR",
	"TRACK",
	"WBR",
]);

export function setAccessibleLabelWithoutTooltip(
	target: HTMLElement,
	label: string,
	labelHost?: HTMLElement,
): HTMLElement {
	target.removeAttribute("title");
	target.removeAttribute("aria-label");

	const canHostLabel =
		labelHost == null &&
		!RESTRICTED_LABEL_HOST_TAGS.has(target.tagName.toUpperCase());
	let labelEl = canHostLabel
		? target.querySelector<HTMLElement>(
				':scope > [data-task-board-accessible-label="true"]',
			)
		: null;
	const existingLabelId = target.dataset.taskBoardAccessibleLabelId;
	if (!labelEl && existingLabelId) {
		labelEl = target.ownerDocument.getElementById(existingLabelId);
	}
	if (!labelEl) {
		labelEl = target.ownerDocument.win.createSpan();
		labelEl.dataset.taskBoardAccessibleLabel = "true";
		labelEl.className = "task-board-sr-only";
		if (labelHost) {
			labelHost.appendChild(labelEl);
		} else if (canHostLabel) {
			target.appendChild(labelEl);
		} else {
			target.insertAdjacentElement("afterend", labelEl);
		}
	}

	if (!labelEl.id) {
		accessibleLabelCounter += 1;
		labelEl.id = `task-board-accessible-label-${accessibleLabelCounter}`;
	}
	target.dataset.taskBoardAccessibleLabelId = labelEl.id;

	const normalizedLabel = label.trim();
	labelEl.textContent = normalizedLabel;
	if (normalizedLabel) {
		target.setAttribute("aria-labelledby", labelEl.id);
	} else {
		target.removeAttribute("aria-labelledby");
	}

	return labelEl;
}
