import React from "react";

import { EdgeProps, getBezierPath } from "reactflow";
import "./CustomEdgeSource.css";
import { BrandColors } from "@utils/constants";

const CustomEdgeSource: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd
}: EdgeProps) => {
  const xEqual = sourceX === targetX;
  const yEqual = sourceY === targetY;

  const [edgePath] = getBezierPath({
    // display the gradient for a straight line
    sourceX: xEqual ? sourceX + 0.0001 : sourceX,
    sourceY: yEqual ? sourceY + 0.0001 : sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path react-flow__edge-path__Source"
        d={edgePath}
        markerEnd={markerEnd}
      />
      <circle r="5" fill={BrandColors.green}>
        <animateMotion dur="2.5s" repeatCount="indefinite" path={edgePath} />
      </circle>
    </>
  );
};

export default CustomEdgeSource;
