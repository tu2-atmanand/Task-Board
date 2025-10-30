import { memo } from 'react';
import { Handle, Position, NodeResizeControl, NodeProps } from '@xyflow/react';
import type TaskBoard from 'main';

const controlStyle = {
	background: 'transparent',
	border: '1px solid red',
};

interface dataProps extends React.ReactElement<unknown, string> {
	props: { plugin: TaskBoard };
}

interface CustomNodeProps {
	data: {
		label: dataProps;
		[key: string]: any;
	};
	// selected: boolean;
	// width: number | undefined;
	// height: number | undefined;
}

const CustomNode = ({ data, selected, width, height }: CustomNodeProps & NodeProps) => {
	console.log({ data, selected, width, height });
	return (
		<>
			<NodeResizeControl
				// style={controlStyle}
				minWidth={100}
				minHeight={50}
			// minHeight={ }
			// {/* <ResizeIcon /> */}
			>
				<Handle type="target" position={Position.Left} />
				<div>{data.label}</div>
				<Handle type="source" position={Position.Right} />
			</NodeResizeControl>

		</>
	);
};

function ResizeIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			strokeWidth="2"
			stroke="#ff0071"
			fill="none"
			strokeLinecap="round"
			strokeLinejoin="round"
			style={{ position: 'absolute', right: 5, bottom: 5 }}
		>
			<path stroke="none" d="M0 0h24v24H0z" fill="none" />
			<polyline points="16 20 20 20 20 16" />
			<line x1="14" y1="14" x2="20" y2="20" />
			<polyline points="8 4 4 4 4 8" />
			<line x1="4" y1="4" x2="10" y2="10" />
		</svg>
	);
}

export default memo(CustomNode);
