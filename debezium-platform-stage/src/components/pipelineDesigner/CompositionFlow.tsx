/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Edge,
  Node,
  Background,
  Position,
  Connection,
  addEdge,
  PanOnScrollMode,
} from "reactflow";
import { useData } from "../../appLayout/AppContext";
import DebeziumNode from "./DebeziumNode";
import { AppColors } from "@utils/constants";
import DataNode from "./DataNode";
import UnifiedCustomEdge from "./UnifiedCustomEdge";
import { Predicate, Transform } from "src/apis";
import TransformLinkNode from "./TransformLinkNode";
import TransformGroupNode from "./TransformGroupNode";
import TransformCollapsedNode from "./TransformCollapsedNode";
import UnifiedMultiEdge from "./UnifiedMultiEdge";

const nodeTypes = {
  addTransformation: DebeziumNode,
  dataNode: DataNode,
  transformLinkNode: TransformLinkNode,
  transformGroupNode: TransformGroupNode,
  transformCollapsedNode: TransformCollapsedNode,
};

const edgeTypes = {
  unifiedCustomEdge: UnifiedCustomEdge,
  unifiedMultiCustomEdge: UnifiedMultiEdge,
};

const proOptions = { hideAttribution: true };

interface CreationFlowProps {
  sourceName: string;
  sourceType: string;
  selectedTransform: Transform[];
  destinationName: string;
  destinationType: string;
}

const CompositionFlow: React.FC<CreationFlowProps> = ({
  sourceName,
  sourceType,
  destinationName,
  destinationType,
  selectedTransform,
}) => {
  const { darkMode } = useData();

  const initialNodes: never[] = [];
  const initialEdges = [
    {
      id: "complete-flow-path",
      source: "source",
      target: "destination",
      type: "unifiedCustomEdge",
      data: { throughNode: "add_transformation" },
      sourceHandle: "a",
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

  const selectedTransformRef = useRef(selectedTransform);
  selectedTransformRef.current = selectedTransform;

  const handleExpand = useCallback(() => {
    const linkTransforms = selectedTransformRef.current.map((transform, id) => {
      const newId = `transform_${id + 1}`;
      const xPosition = 25 + id * 150;
      const newTransformNode = createNewTransformNode(
        newId,
        xPosition,
        transform.name
      );
      return newTransformNode;
    });
    const transformGroupNode = {
      id: "transform_group",
      data: {
        label: "Transform",
        sourcePosition: "right",
        targetPosition: "left",
        handleCollapsed: handleCollapsed,
      },
      position: { x: 260, y: 25 },
      style: {
        width: +150 * selectedTransformRef.current.length - 10,
        height: 80,
        zIndex: 1,
      },
      type: "transformGroupNode",
      draggable: false,
    };

    

    setNodes((prevNodes: any) => {

      const dataSelectorDestinationNode = prevNodes.find(
        (node: any) => node.id === "destination"
      );

      const updatedDataSelectorDestinationNode = {
        ...dataSelectorDestinationNode,
        position: {
          ...dataSelectorDestinationNode.position,
          x:
          350 +
            150 * selectedTransformRef.current.length,
        },
      };

      return [
        ...prevNodes.filter(
          (node: any) =>
            node.id !== "transform_selected" && node.id !== "destination"
        ),

        transformGroupNode,
        ...linkTransforms,
        updatedDataSelectorDestinationNode,
      ];
    });

    let newEdge: {
      id: string;
      source: string;
      target: string;
      data: { throughNodeNo: number };
      type: string;
    }[] = [];
    newEdge = [
      {
        id: "complete-multi-flow-path",
        source: "source",
        target: "destination",
        type: "unifiedMultiCustomEdge",
        data: { throughNodeNo: selectedTransformRef.current.length },
      },
    ];

    setEdges([...newEdge]);
  }, [destinationName, destinationType, selectedTransform.length]);

  const TransformCollapsedNode = useMemo(() => {
    return {
      id: "transform_selected",
      data: {
        label: "Transformation",
        sourcePosition: "right",
        targetPosition: "left",
        handleExpand: handleExpand,
        selectedTransform: selectedTransformRef,
      },
      position: { x: 300, y: 45 },
      targetPosition: "left",
      type: "transformCollapsedNode",
      draggable: false,
    };
  }, [selectedTransformRef]);

  const createNewTransformNode = (
    id: string,
    xPosition: number,
    transformName: string,
    transformPredicate?: Predicate
  ) => {
    return {
      id,
      data: {
        label: transformName,
        sourcePosition: "left",
        targetPosition: "right",
        ...(transformPredicate?.type && {
          predicate: {
            label: transformPredicate.type.split(".").pop(),
            negate: transformPredicate.negate,
          },
        }),
      },
      position: { x: xPosition, y: 24 },
      targetPosition: "left",
      style: {
        zIndex: 999,
      },
      type: "transformLinkNode",
      parentId: "transform_group",
      extent: "parent",
      draggable: false,
    };
  };

  const handleCollapsed = useCallback(() => {
    setNodes((prevNodes: any) => {
      const destinationNode = prevNodes.find(
        (node: any) => node.id === "destination"
      );

      const updatedDestinationNode = {
        ...destinationNode,
        position: { x: 500, y: 40 },
      };

      return [
        ...prevNodes.filter(
          (node: any) =>
            !node.id.includes("transform") && node.id !== "destination"
        ),
        TransformCollapsedNode,
        updatedDestinationNode,
      ];
    });
  }, [TransformCollapsedNode]);

  useEffect(() => {
    const dataSourceNode = {
      id: "source",
      data: {
        connectorType: sourceType,
        label: sourceName,
        type: "source",
      },
      position: { x: 40, y: 40 },
      type: "dataNode",
      draggable: false,
    };
    if (selectedTransform.length > 0) {
      const linkTransforms = selectedTransform.map((transform, id) => {
        const newId = `transform_${id + 1}`;
        const xPosition = 25 + id * 150;
        const newTransformNode = createNewTransformNode(
          newId,
          xPosition,
          transform.name
        );
        return newTransformNode;
      });
      const transformGroupNode = {
        id: "transform_group",
        data: {
          label: "Transform",
          sourcePosition: "right",
          targetPosition: "left",
          handleCollapsed: handleCollapsed,
        },
        position: { x: 260, y: 25 },
        style: {
          width: +150 * selectedTransform.length - 10,
          height: 80,
          zIndex: 1,
        },
        type: "transformGroupNode",
        draggable: false,
      };
      const dataDestinationNode = {
        id: "destination",
        data: {
          connectorType: destinationType,
          label: destinationName,
          type: "destination",
        },
        position: { x: 350 + 150 * selectedTransform.length, y: 40 },
        type: "dataNode",
        draggable: false,
      };

      setNodes([
        dataSourceNode,
        transformGroupNode,
        ...linkTransforms,
        dataDestinationNode,
      ]);
    } else {
      const defaultTransformationNode = {
        id: "add_transformation",
        data: {
          label: "Transformation",
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        },
        position: { x: 300, y: 45 },
        targetPosition: Position.Left,
        type: "addTransformation",
        draggable: false,
      };

      const dataDestinationNode = {
        id: "destination",
        data: {
          connectorType: destinationType,
          label: destinationName,
          type: "destination",
        },
        position: { x: 500, y: 40 },
        type: "dataNode",
        draggable: false,
      };
      setNodes([
        dataSourceNode,
        defaultTransformationNode,
        dataDestinationNode,
      ]);
    }
  }, [
    destinationName,
    destinationType,
    handleCollapsed,
    selectedTransform,
    setNodes,
    sourceName,
    sourceType,
  ]);

  return (
    <>
      <ReactFlow
        key={nodes.length}
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
        onConnect={onConnect}
        panOnScroll={true}
        panOnScrollMode={PanOnScrollMode.Horizontal}
        panOnDrag={true}
        onInit={(instance) => {
          instance.fitView({ padding: 0.2 });
        }}
      >
        <Background
          style={{
            borderRadius: "5px",
          }}
          gap={13}
          color={darkMode ? AppColors.dark : AppColors.white}
        />
        <svg>
          <defs>
            <linearGradient id="edge-gradient-unified">
              <stop offset="0%" stopColor="#a5c82d" />
              <stop offset="50%" stopColor="#7fc5a5" />
              <stop offset="100%" stopColor="#58b2da" />
            </linearGradient>
          </defs>
        </svg>
      </ReactFlow>
    </>
  );
};

export default CompositionFlow;
