import { MiniMap } from "@xyflow/react";


export const MapViewMinimap = () => {
	// TODO: Would be nice to have better typing for node here
	const getNodeColor = (node: { data?: { task?: { status?: string } } }) => {
		const status = node.data?.task?.status;
		switch (status) {
			case "done":
				return "var(--tasks-map-task-completed-green)";
			case "in_progress":
				return "var(--tasks-map-task-in-progress-blue)";
			case "canceled":
				return "var(--tasks-map-task-canceled-red)";
			default:
				return "var(--background-secondary)";
		}
	};

	return (
		<MiniMap
			className="taskBoardMapViewContainerMinimap"
			bgColor="var(--background-primary)"
			// nodeColor={getNodeColor}
			pannable
			zoomable
			zoomStep={1}
		/>
	);
};
