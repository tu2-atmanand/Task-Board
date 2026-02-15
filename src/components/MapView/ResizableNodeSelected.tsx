import { memo, FC } from 'react';
import { Handle, Position, NodeResizer, NodeProps } from '@xyflow/react';
import { nodeSize } from './MapView';
import { NODE_SIZE_STORAGE_KEY } from 'src/interfaces/Constants';
import type TaskBoard from 'main';
import { mapViewNodeMapOrientation } from 'src/interfaces/Enums';
import { CircleArrowDownIcon, CircleArrowRightIcon } from 'lucide-react';
import { t } from 'src/utils/lang/helper';
import { bugReporterManagerInsatance } from 'src/managers/BugReporter';

interface dataProps extends React.ReactElement<unknown, string> {
	props: { plugin: TaskBoard };
}

interface ResizableNodeSelectedProps {
	data: { label: dataProps };
	selected: boolean;
}

const ResizableNodeSelected: FC<NodeProps & ResizableNodeSelectedProps> = ({ id, data, selected, width, height }) => {
	const mapViewSettings = data.label?.props?.plugin.settings.data.mapView;
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
							width: params.width ?? data.label.props.plugin.settings.data.columnWidth ?? 300
							// height: params.height ?? 30 
						};
						localStorage.setItem(NODE_SIZE_STORAGE_KEY, JSON.stringify(sizeData));
					} catch (e) {
						bugReporterManagerInsatance.addToLogs(
							127,
							String(e),
							"ResizableNodeSelected.tsx/return()",
						);
					}
				}}
			/>

			{orientationHorizontal && (
				<Handle type="target" position={Position.Left}>
					<CircleArrowRightIcon style={{ display: 'block' }} className='taskBoardMapViewContainerNodeHandleIconLeft' aria-label={t("connect-a-child")} />
				</Handle>
			)}
			{!orientationHorizontal && (
				<Handle type="target" position={Position.Top}>
					<CircleArrowDownIcon style={{ display: 'block' }} className='taskBoardMapViewContainerNodeHandleIconTop' aria-label={t("connect-a-child")} />
				</Handle>
			)}

			<div className={`taskBoardMapViewContainerNodeResizerTaskItem${selected ? '-selected' : ''}`}>{data.label}</div >

			{orientationHorizontal && (
				<Handle type="source" position={Position.Right}>
					<CircleArrowRightIcon style={{ display: 'block' }} className='taskBoardMapViewContainerNodeHandleIconRight' aria-label={t("connect-a-parent")} />
				</Handle>
			)}
			{!orientationHorizontal && (
				<Handle type="source" position={Position.Bottom}>
					<CircleArrowDownIcon style={{ display: 'block' }} className='taskBoardMapViewContainerNodeHandleIconBottom' aria-label={t("connect-a-parent")} />
				</Handle>
			)}
		</>
	);
};

export default memo(ResizableNodeSelected);
