import React from "react";
import { MiniMap, Node } from "@xyflow/react";
import { TagColor } from "src/interfaces/GlobalSettings";
import { taskItem } from "src/interfaces/TaskItem";
import { matchTagsWithWildcards } from "src/utils/algorithms/ScanningFilterer";

export interface CustomNode extends Node {
	data: { label: { props: { task: taskItem } } }
}

export interface MapViewMinimapProps {
	tagColors: TagColor[];
}

// TODO: Would be nice to have better typing for node here
export const MapViewMinimap: React.FC<MapViewMinimapProps> = ({ tagColors }) => {

	function getCardBgBasedOnTag(node: Node): string {
		if (!Array.isArray(tagColors) || tagColors.length === 0) {
			return "var(--xy-minimap-node-background-color, var(--xy-minimap-node-background-color-default))";
		}

		const nodeTags = (node as CustomNode).data.label.props.task.tags;
		if (!Array.isArray(nodeTags)) return "var(--xy-minimap-node-background-color, var(--xy-minimap-node-background-color-default))";

		// Prepare a map for faster lookup
		const tagColorMap = new Map(tagColors.map((t) => [t.name, t]));

		let highestPriorityTag: { name: string; color: string; priority: number } | undefined = undefined;

		for (const rawTag of nodeTags) {
			const tagName = rawTag.replace('#', '');
			let tagData = tagColorMap.get(tagName);

			if (!tagData) {
				tagColorMap.forEach((tagColor, tagNameKey, mapValue) => {
					const result = matchTagsWithWildcards(tagNameKey, tagName || '');
					// Return the first match found
					if (result) tagData = tagColor;
				});
			}

			if (tagData) {
				if (
					!highestPriorityTag ||
					(tagData.priority) < (highestPriorityTag.priority)
				) {
					highestPriorityTag = tagData;
				}
			}
		}

		return highestPriorityTag?.color || "var(--xy-minimap-node-background-color, var(--xy-minimap-node-background-color-default))";
	}

	return (
		<MiniMap
			className="taskBoardMapViewContainerMinimap"
			bgColor="var(--background-modifier-border-focus)"
			nodeColor={(node) => getCardBgBasedOnTag(node)}
			pannable={true}
			zoomable={true}
			zoomStep={1}
		/>
	);
};
