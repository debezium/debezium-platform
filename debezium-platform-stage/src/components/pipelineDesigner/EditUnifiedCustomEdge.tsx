import { EdgeProps, getBezierPath, Position } from "reactflow";
import "./EditUnifiedCustomEdge.css";

interface EditUnifiedCustomEdgeProps extends EdgeProps {}

const EditUnifiedCustomEdge: React.FC<EditUnifiedCustomEdgeProps> = ({
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
      
      <path
        id={id}
        style={style}
        className="edge-path__unified-edit"
        d={completePath}
        markerEnd={markerEnd}
      />
      <circle r="5" fill="#4394e5">
        <animateMotion dur="3s" repeatCount="indefinite" path={completePath} />
      </circle>
    </>
  );
};

export default EditUnifiedCustomEdge;
