import { memo, ReactNode, FC } from 'react';
import { Handle, Position, NodeResizer, NodeProps } from '@xyflow/react';
import { nodeSize } from './MapView';
import { NODE_SIZE_STORAGE_KEY } from 'src/interfaces/Constants';
import type TaskBoard from 'main';
import { mapViewNodeHandlePosition } from 'src/interfaces/Enums';

interface dataProps extends React.ReactElement<unknown, string> {
	props: { plugin: TaskBoard };
}

interface ResizableNodeSelectedProps {
	data: { label: dataProps };
	selected: boolean;
}

const ResizableNodeSelected: FC<NodeProps & ResizableNodeSelectedProps> = ({ id, data, selected, width, height }) => {
	const mapViewSettings = data.label?.props?.plugin.settings.data.globalSettings.mapView;
	const targetPosition = mapViewSettings.handlePosition;
	const arrowForward = mapViewSettings.arrowForward;
	// console.log('Rendering ResizableNodeSelected for node:', id, { mapViewSettings, selected, width, height });

	return (
		<>
			<NodeResizer
				handleClassName='taskBoardMapViewContainerNodeResizerHandle'
				isVisible={selected}
				autoScale={true}
				onResizeEnd={(newSize, params) => {
					// console.log('Node resized to:', newSize, "\nparams:", params, "\nNode ID:", id);
					try {
						const sizeData: Record<string, nodeSize> = JSON.parse(localStorage.getItem(NODE_SIZE_STORAGE_KEY) || '{}');
						sizeData[id] = {
							width: params.width ?? 100,
							// height: params.height ?? 30 
						};
						localStorage.setItem(NODE_SIZE_STORAGE_KEY, JSON.stringify(sizeData));
					} catch (e) {
						console.error('Failed to update node size in localStorage:', e);
					}
				}}
			/>
			{targetPosition === mapViewNodeHandlePosition.horizontal && arrowForward && (
				<Handle type="target" position={Position.Top} />
			)}
			{targetPosition === mapViewNodeHandlePosition.horizontal && !arrowForward && (
				<Handle type="source" position={Position.Top} />
			)}
			{targetPosition === mapViewNodeHandlePosition.vertical && arrowForward && (
				<Handle type="target" position={Position.Left} />
			)}
			{targetPosition === mapViewNodeHandlePosition.vertical && !arrowForward && (
				<Handle type="source" position={Position.Left} />
			)}
			<div className='taskBoardMapViewContainerNodeResizerTaskItemConatiner'>{data.label}</div >
			{targetPosition === mapViewNodeHandlePosition.horizontal && arrowForward && (
				<Handle type="source" position={Position.Bottom} />
			)
			}
			{
				targetPosition === mapViewNodeHandlePosition.horizontal && !arrowForward && (
					<Handle type="target" position={Position.Bottom} />
				)
			}
			{
				targetPosition === mapViewNodeHandlePosition.vertical && arrowForward && (
					<Handle type="source" position={Position.Right} />
				)
			}
			{
				targetPosition === mapViewNodeHandlePosition.vertical && !arrowForward && (
					<Handle type="target" position={Position.Right} />
				)
			}

			{/* for both
			{arrowForward ? (
				<>
					{targetPosition === mapViewNodeHandlePosition.both && (
						<Handle type="target" position={Position.Top} />
					)}
					{targetPosition === mapViewNodeHandlePosition.both && (
						<Handle type="target" position={Position.Left} />
					)}
					{targetPosition === mapViewNodeHandlePosition.both && (
						<Handle type="source" position={Position.Bottom} />
					)}
					{targetPosition === mapViewNodeHandlePosition.both && (
						<Handle type="source" position={Position.Right} />
					)}
				</>
			) : (
				<>
					{targetPosition === mapViewNodeHandlePosition.both && (
						<Handle type="source" position={Position.Top} />
					)}
					{targetPosition === mapViewNodeHandlePosition.both && (
						<Handle type="source" position={Position.Left} />
					)}
					{targetPosition === mapViewNodeHandlePosition.both && (
						<Handle type="target" position={Position.Bottom} />
					)}
					{targetPosition === mapViewNodeHandlePosition.both && (
						<Handle type="target" position={Position.Right} />
					)}
				</>
			)
			} */}
		</>
	);
};

export default memo(ResizableNodeSelected);
