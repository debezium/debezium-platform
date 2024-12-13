/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo, useState } from "react";
import ReactFlow, {
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Edge,
  Node,
  Background,
  Position,
} from "reactflow";
import { useData } from "../../appLayout/AppContext";
import DebeziumNode from "./DebeziumNode";
import CustomEdgeSource from "./CustomEdgeSource";
import CustomEdgeDestination from "./CustomEdgeDestination";
import { AppColors } from "@utils/constants";
import DataNode from "./DataNode";

const nodeTypes = {
  addTransformation: DebeziumNode,
  dataNode: DataNode,
};

const edgeTypes = {
  customEdgeSource: CustomEdgeSource,
  customEdgeDestination: CustomEdgeDestination,
};

const proOptions = { hideAttribution: true };

interface CreationFlowProps {
  sourceName: string;
  sourceType: string;
  destinationName: string;
  destinationType: string;
}

const CompositionFlow: React.FC<CreationFlowProps> = ({
  sourceName,
  sourceType,
  destinationName,
  destinationType,
}) => {
  const { darkMode } = useData();

  const dataSourceNode = useMemo(
    () => ({
      id: "source",
      data: {
        connectorType: sourceType,
        label: sourceName,
        type: "source",
        editAction: () => {},
        compositionFlow: true,
      },
      position: { x: 40, y: 40 },
      type: "dataNode",
      draggable: false,
    }),
    [sourceName, sourceType]
  );

  const defaultTransformationNode = useMemo((): Node => {
    return {
      id: "add_transformation",
      data: {
        label: "Transformation",
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      },
      position: { x: 225, y: 30 },
      targetPosition: Position.Left,
      type: "addTransformation",
      draggable: false,
    };
  }, []);

  const dataDestinationNode = useMemo(
    () => ({
      id: "destination",
      data: {
        connectorType: destinationType,
        label: destinationName,
        type: "destination",
        editAction: () => {},
        compositionFlow: true,
      },
      position: { x: 350, y: 40 },
      type: "dataNode",
      draggable: false,
    }),
    [destinationName, destinationType]
  );

  const initialNodes: Node[] = useMemo(
    () => [dataSourceNode, defaultTransformationNode, dataDestinationNode],
    [dataSourceNode, defaultTransformationNode, dataDestinationNode]
  );

  const initialEdges: Edge[] = useMemo(
    () => [
      {
        id: "source-add_transformation",
        source: "source",
        target: "add_transformation",
        type: "customEdgeSource",
        sourceHandle: "a",
      },
      {
        id: "add_transformation-destination",
        source: "add_transformation",
        target: "destination",
        type: "customEdgeDestination",
      },
    ],
    []
  );

  const [nodeChanges, setNodeChanges] = useState<NodeChange[]>([]);
  const [edgeChanges, setEdgeChanges] = useState<EdgeChange[]>([]);

  const nodes = useMemo(
    () => applyNodeChanges(nodeChanges, initialNodes),
    [nodeChanges, initialNodes]
  );

  const edges = useMemo(
    () => applyEdgeChanges(edgeChanges, initialEdges),
    [edgeChanges, initialEdges]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodeChanges((prev) => [...prev, ...changes]),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdgeChanges((prev) => [...prev, ...changes]),
    []
  );

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        proOptions={proOptions}
        fitView
        maxZoom={1.4}
        minZoom={1.4}
        panOnDrag={false}
      >
        <Background
          style={{
            borderRadius: "5px",
          }}
          gap={15}
          color={darkMode ? AppColors.dark : AppColors.white}
        />
        <svg>
          <defs>
            <linearGradient id="edge-gradient-source">
              <stop offset="0%" stopColor="#a5c82d" />
              <stop offset="100%" stopColor="#7fc5a5" />
            </linearGradient>
            <linearGradient id="edge-gradient-destination">
              <stop offset="0%" stopColor="#7fc5a5" />
              <stop offset="100%" stopColor="#58b2da" />
            </linearGradient>
          </defs>
        </svg>
      </ReactFlow>
    </>
  );
};

export default CompositionFlow;
