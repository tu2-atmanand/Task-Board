import { memo, ReactNode, FC } from 'react';
import { Handle, Position, NodeResizer, NodeProps } from '@xyflow/react';
import { nodeSize } from './MapView';
import { NODE_SIZE_STORAGE_KEY } from 'src/interfaces/Constants';
import type TaskBoard from 'main';
import { mapViewNodeMapOrientation } from 'src/interfaces/Enums';
import { CircleArrowDownIcon, CircleArrowRightIcon } from 'lucide-react';

interface dataProps extends React.ReactElement<unknown, string> {
	props: { plugin: TaskBoard };
}

interface ResizableNodeSelectedProps {
	data: { label: dataProps };
	selected: boolean;
}

const ResizableNodeSelected: FC<NodeProps & ResizableNodeSelectedProps> = ({ id, data, selected, width, height }) => {
	const mapViewSettings = data.label?.props?.plugin.settings.data.globalSettings.mapView;
	const orientationHorizontal = mapViewSettings.mapOrientation === mapViewNodeMapOrientation.horizontal;
	// console.log('Rendering ResizableNodeSelected for node:', id, { data, selected, width, height });

	return (
		<>
			<NodeResizer
				handleClassName='taskBoardMapViewContainerNodeResizerHandle'
				shouldResize={(position) => {
					// Should only be allowed to resize in horizontal (ie. width) direction.
					if (position.dy) return false; else return true;
				}}
				isVisible={selected}
				autoScale={true}
				onResizeEnd={(newSize, params) => {
					// console.log('Node resized to:', newSize, "\nparams:", params, "\nNode ID:", id);
					try {
						const sizeData: Record<string, nodeSize> = JSON.parse(localStorage.getItem(NODE_SIZE_STORAGE_KEY) || '{}');
						sizeData[id] = {
							width: params.width ?? 100
							// height: params.height ?? 30 
						};
						localStorage.setItem(NODE_SIZE_STORAGE_KEY, JSON.stringify(sizeData));
					} catch (e) {
						console.error('Failed to update node size in localStorage:', e);
					}
				}}
			/>
			{/* <Handle type="target" position={Position.Left} /> */}

			{orientationHorizontal && (
				<Handle type="target" position={Position.Left}>
					<CircleArrowRightIcon className='taskBoardMapViewContainerNodeHandleIconLeft' onClick={() => console.log("Dragging....")} />
				</Handle>
			)}
			{!orientationHorizontal && (
				<Handle type="target" position={Position.Top}>
					<CircleArrowDownIcon className='taskBoardMapViewContainerNodeHandleIconLeft' size={18} scale={10} />
				</Handle>
			)}
			<div className={`taskBoardMapViewContainerNodeResizerTaskItem${selected ? '-selected' : ''}`}>{data.label}</div >

			{/* <Handle type="source" position={Position.Right} /> */}

			{orientationHorizontal && (
				<Handle type="source" position={Position.Right}>
					<CircleArrowRightIcon className='taskBoardMapViewContainerNodeHandleIconRight' onClick={() => console.log("Dragging....")} />
				</Handle>
			)}
			{!orientationHorizontal && (
				<Handle type="source" position={Position.Bottom}>
					<CircleArrowDownIcon className='taskBoardMapViewContainerNodeHandleIconLeft' size={18} scale={10} />
				</Handle>
			)}
		</>
	);
};

export default memo(ResizableNodeSelected);
