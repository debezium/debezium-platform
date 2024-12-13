/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo, useState } from "react";
import ReactFlow, {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  NodeChange,
  Node,
  EdgeChange,
  Edge,
  Connection,
  Background,
} from "reactflow";

import DataNode from "./DataNode";

import { MdLogin, MdLogout } from "react-icons/md";
import DataNodeSelector from "./DataSelectorNode";
import "./CreationFlow.css";
import CustomEdgeDestination from "./CustomEdgeDestination";
import CustomEdgeSource from "./CustomEdgeSource";
import { useData } from "../../appLayout/AppContext";
import { AppColors } from "@utils/constants";
import DebeziumNode from "./DebeziumNode";

const nodeTypes = {
  dataNodeSelector: DataNodeSelector,
  addTransformation: DebeziumNode,
  dataNode: DataNode,
};

const edgeTypes = {
  customEdgeSource: CustomEdgeSource,
  customEdgeDestination: CustomEdgeDestination,
};

const proOptions = { hideAttribution: true };

interface WelcomeFlowProps {}

const WelcomeFlow: React.FC<WelcomeFlowProps> = () => {
  const { darkMode } = useData();

  const defaultSourceNode = useMemo(() => {
    return {
      id: "source",
      data: {
        icon: MdLogout,
        label: "Source",
        type: "source",
        action: () => {},
        welcomeFlow: true,
      },
      position: { x: 100, y: 150 },
      type: "dataNodeSelector",
      draggable: false,
    };
  }, []);

  const defaultTransformationNode = useMemo(() => {
    return {
      id: "add_transformation",
      data: {
        label: "Transformation",
        sourcePosition: "right",
        targetPosition: "left",
      },
      position: { x: 330, y: 130 },
      targetPosition: "left",
      type: "addTransformation",
      draggable: false,
    };
  }, []);

  const defaultDestinationNode = useMemo(() => {
    return {
      id: "destination",
      data: {
        icon: MdLogin,
        label: "Destination",
        type: "destination",
        action: () => {},
        welcomeFlow: true,
      },
      position: { x: 500, y: 150 },
      type: "dataNodeSelector",
      draggable: false,
    };
  }, []);

  const initialNodes = [
    defaultSourceNode,
    defaultTransformationNode,
    defaultDestinationNode,
  ];

  const initialEdges = [
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
  ];

  const [nodes, setNodes] = useState<any>(initialNodes);
  const [edges, setEdges] = useState<any>(initialEdges);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds: Node[]) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((eds: Edge[]) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds: Edge[]) => addEdge(connection, eds));
    },
    [setEdges]
  );

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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

export default WelcomeFlow;
