import { EdgeProps, getBezierPath, Position } from "reactflow";
import "./UnifiedCustomEdge.css";

const UnifiedCustomEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}) => {
  // Find the middle node position (transformation node)
  const midX = (sourceX + targetX) / 2;
  const midY = sourceY - 1;

  // Create a combined path through all three points
  const firstPath = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX: midX,
    targetY: midY,
    targetPosition: Position.Left,
  });

  const secondPath = getBezierPath({
    sourceX: midX,
    sourceY: midY,
    sourcePosition: Position.Right,
    targetX,
    targetY,
    targetPosition,
  });

  // Combine the paths
  const completePath = `${firstPath[0]} ${secondPath[0]}`;

  return (
    <>
      <svg>
        <defs>
          <linearGradient id="edge-gradient-unified">
            <stop offset="0%" stopColor="#a5c82d" />
            <stop offset="50%" stopColor="#7fc5a5" />
            <stop offset="100%" stopColor="#58b2da" />
          </linearGradient>
        </defs>
      </svg>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path react-flow__edge-path__unified"
        d={completePath}
        markerEnd={markerEnd}
      />
      <circle r="5" fill="#4394e5">
        <animateMotion dur="3s" repeatCount="indefinite" path={completePath} />
      </circle>
    </>
  );
};

export default UnifiedCustomEdge;
