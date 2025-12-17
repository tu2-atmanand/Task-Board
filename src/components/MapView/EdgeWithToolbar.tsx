// /src/components/MapView/EdgeWithToolbar.tsx

import React from 'react';
import {
	EdgeLabelRenderer,
	getBezierPath,
	BaseEdge,
	EdgeProps,
	useReactFlow,
} from '@xyflow/react';
import { Trash2, Palette, Sparkles } from 'lucide-react';
import TaskBoard from 'main';
import { taskItem } from 'src/interfaces/TaskItem';
import { updateTaskInFile } from 'src/utils/taskLine/TaskItemUtils';
import { sanitizeDependsOn } from 'src/utils/taskLine/TaskContentFormatter';

// interface EdgeWithToolbarProps extends EdgeProps {
// 	plugin: TaskBoard;
// 	allTasks: taskItem[];
// }

/**
 * EdgeWithToolbar - Custom edge component with interactive toolbar for map view
 * 
 * Displays a toolbar when an edge is selected, providing controls for:
 * - Deleting the edge (removes dependency relationship between tasks)
 * - Changing edge color (placeholder for future implementation)
 * - Toggling edge animation (placeholder for future implementation)
 * 
 * The toolbar appears with a fade-in animation when the edge is selected
 * and automatically disappears when clicking elsewhere or selecting another element.
 * 
 * @param props.plugin - TaskBoard plugin instance for accessing settings and methods
 * @param props.allTasks - Array of all tasks to find the target task for dependency removal
 * @param props...edgeProps - Standard ReactFlow EdgeProps including source, target, selected state, etc.
 */
export function EdgeWithToolbar(props: EdgeProps) {
	console.log("Edge :", props);
	// const { plugin, allTasks, ...edgeProps } = props;
	const edgeProps = props;
	const [edgePath, labelX, labelY] = getBezierPath(edgeProps);
	const { deleteElements, getEdges } = useReactFlow();

	const deleteEdge = async () => {
		console.log("Edge pressed :", edgeProps);

		// // Find the edge
		// const edge = getEdges().find((e) => e.id === edgeProps.id);
		// if (!edge) return;

		// // Extract source and target IDs from edge
		// const sourceId = edge.source; // This is the parent task (dependsOn)
		// const targetId = edge.target; // This is the child task that depends on parent

		// // Find the target task (the one that has dependsOn property)
		// const targetTask = allTasks.find(
		// 	(t) => t.legacyId === targetId || String(t.id) === targetId
		// );

		// if (!targetTask) {
		// 	console.warn('Target task not found for edge deletion');
		// 	return;
		// }

		// // Create updated task with the dependency removed
		// const updatedTargetTask = {
		// 	...targetTask,
		// 	dependsOn: Array.isArray(targetTask.dependsOn)
		// 		? targetTask.dependsOn.filter((depId) => depId !== sourceId)
		// 		: [],
		// };

		// // Update the task title to reflect the removed dependency
		// const updatedTaskTitle = sanitizeDependsOn(
		// 	plugin.settings.data.globalSettings,
		// 	updatedTargetTask.title,
		// 	updatedTargetTask.dependsOn
		// );
		// updatedTargetTask.title = updatedTaskTitle;

		// // Update the task in the file
		// await updateTaskInFile(plugin, updatedTargetTask, targetTask);

		// // Trigger real-time scanning to update the UI
		// plugin.realTimeScanning.processAllUpdatedFiles(updatedTargetTask.filePath);

		// // Delete the edge from the graph
		// deleteElements({ edges: [edge] });
	};

	const handleColorChange = () => {
		// Placeholder for future implementation
		console.log('Color change feature - to be implemented');
	};

	const handleAnimationToggle = () => {
		// Placeholder for future implementation
		console.log('Animation toggle feature - to be implemented');
	};

	return (
		<>
			<BaseEdge
				id={edgeProps.id}
				path={edgePath}
				style={{
					...edgeProps.style,
					cursor: 'pointer',
				}}
			/>
			<EdgeLabelRenderer>
				<div
					className="edge-toolbar-container"
					style={{
						position: 'absolute',
						transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
						pointerEvents: 'all',
					}}
				>
					<button
						className="edge-toolbar-button edge-toolbar-delete"
						onClick={deleteEdge}
						title="Delete connection"
						aria-label="Delete edge"
					>
						<Trash2 size={16} />
					</button>
					<button
						className="edge-toolbar-button edge-toolbar-color"
						onClick={handleColorChange}
						title="Change color (coming soon)"
						aria-label="Change edge color"
					>
						<Palette size={16} />
					</button>
					<button
						className="edge-toolbar-button edge-toolbar-animation"
						onClick={handleAnimationToggle}
						title="Toggle animation (coming soon)"
						aria-label="Toggle edge animation"
					>
						<Sparkles size={16} />
					</button>
				</div>
			</EdgeLabelRenderer>
		</>
	);
}
