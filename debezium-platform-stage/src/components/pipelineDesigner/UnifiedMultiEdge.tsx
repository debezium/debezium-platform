/* eslint-disable @typescript-eslint/no-unused-vars */
import { EdgeProps, getBezierPath } from "reactflow";
import "./UnifiedCustomEdge.css";

interface UnifiedMultiEdgeProps extends EdgeProps {
  data?: {
    throughNodeNo?: number;
  };
}

const UnifiedMultiEdge: React.FC<UnifiedMultiEdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  style = {},
  markerEnd,
}) => {
  const midY = sourceY - 1; // Slightly above the direct line

  const firstTransformX = sourceX + 200;
  const lastTransformX = targetX - 220;

  // Create a combined path through all three points
  const firstPath = getBezierPath({
    sourceX,
    sourceY,
    targetX: firstTransformX,
    targetY: midY,
  });

  const middlePath = getBezierPath({
    sourceX: firstTransformX,
    sourceY: midY,
    targetX: lastTransformX,
    targetY: midY,
  });

  const secondPath = getBezierPath({
    sourceX: lastTransformX,
    sourceY: midY,
    targetX,
    targetY,
  });

  // Combine the paths
  const completePath = `${firstPath[0]} ${middlePath[0]}  ${secondPath[0]}`;
  const duration = data?.throughNodeNo ? 3 + data.throughNodeNo : 3;

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path react-flow__edge-path__unified"
        d={completePath}
        markerEnd={markerEnd}
      />
      <circle r="5" fill="#4394e5">
        <animateMotion
          dur={`${duration}s`}
          repeatCount="indefinite"
          path={completePath}
        />
      </circle>
    </>
  );
};

export default UnifiedMultiEdge;
