/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  useReactFlow,
  NodeTypes,
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

interface CreationFlowProps {
  sourceName: string;
  sourceType: string;
  selectedTransform: Transform[];
  destinationName: string;
  destinationType: string;
}

const CompositionFlow: React.FC<CreationFlowProps> = memo(
  ({
    sourceName,
    sourceType,
    destinationName,
    destinationType,
    selectedTransform,
  }) => {
    const { darkMode } = useData();
    const reactFlowInstance = useReactFlow();

    const nodeTypes = useMemo<NodeTypes>(() => ({
      debeziumNode: DebeziumNode,
      dataNode: DataNode,
      transformLinkNode: TransformLinkNode,
      transformGroupNode: TransformGroupNode,
      transformCollapsedNode: TransformCollapsedNode,
    }), []);

    const edgeTypes = useMemo(() => ({
      unifiedCustomEdge: UnifiedCustomEdge,
      unifiedMultiCustomEdge: UnifiedMultiEdge,
    }), []);

    const proOptions = useMemo(() => ({ hideAttribution: true }), []);

    const refitElements = useCallback(() => {
      const timeoutId = setTimeout(() => {
        if (reactFlowInstance) {
          reactFlowInstance.fitView({
            padding: 0.2,
            duration: 200,
          });
        }
      }, 50);

      return () => clearTimeout(timeoutId);
    }, [reactFlowInstance]);

    const reactFlowWrapper = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleResize = () => {
        refitElements();
      };
      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }, [refitElements]);

    const initialNodes: never[] = [];
    const initialEdges: never[] = [];
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

    const dataSourceNode = useMemo(
      () => ({
        id: "source",
        data: {
          connectorType: sourceType,
          label: sourceName,
          type: "source",
        },
        position: { x: 40, y: 40 },
        type: "dataNode",
        draggable: false,
      }),
      [sourceType, sourceName]
    );

    const createEdges = useMemo(() => {
      return [
        {
          id: "complete-flow-path",
          source: "source",
          target: "destination",
          type: "unifiedCustomEdge",
          data: { throughNodeNo: selectedTransform.length },
        },
      ];
    }, [selectedTransform.length]);

    useEffect(() => {
      refitElements();
    }, [edges, nodes, refitElements]);

    const selectedTransformRef = useRef(selectedTransform);
    selectedTransformRef.current = selectedTransform;

    const createNewTransformNode = useCallback((
      id: string,
      xPosition: number,
      transformName: string,
      transformPredicate?: Predicate
    ) => {
      return {
        id,
        data: {
          label: transformName,
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
    }, []);

    const transformCollapsedNodeConfig = useMemo(() => ({
      id: "transform_selected",
      data: {
        label: "Transformation",
        selectedTransform: selectedTransformRef,
        handleExpand: () => {},
      },
      position: { x: 280, y: 45 },
      targetPosition: "left",
      type: "transformCollapsedNode",
      draggable: false,
    }), [selectedTransformRef]);

    const handleCollapsed = useCallback(() => {
      setNodes((prevNodes: Node[]) => {
        const destinationNode = prevNodes.find(
          (node: Node) => node.id === "destination"
        );

        if (!destinationNode) return prevNodes;

        const updatedDestinationNode = {
          ...destinationNode,
          position: { x: 500, y: 40 },
        };

        return [
          ...prevNodes.filter(
            (node: Node) =>
              !node.id.includes("transform") && node.id !== "destination"
          ),
          transformCollapsedNodeConfig,
          updatedDestinationNode,
        ];
      });
    }, [transformCollapsedNodeConfig]);

    const handleExpand = useCallback(() => {
      const linkTransforms = selectedTransformRef.current.map(
        (transform, id) => {
          const newId = `transform_${id + 1}`;
          const xPosition = 25 + id * 150;
          const newTransformNode = createNewTransformNode(
            newId,
            xPosition,
            transform.name
          );
          return newTransformNode;
        }
      );
      const transformGroupNode = {
        id: "transform_group",
        data: {
          label: "Transform",
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

      setNodes((prevNodes: Node[]) => {
        const dataSelectorDestinationNode = prevNodes.find(
          (node: Node) => node.id === "destination"
        );

        if (!dataSelectorDestinationNode) return prevNodes;

        const updatedDataSelectorDestinationNode = {
          ...dataSelectorDestinationNode,
          position: {
            ...dataSelectorDestinationNode.position,
            x: 350 + 150 * selectedTransformRef.current.length,
          },
        };

        return [
          ...prevNodes.filter(
            (node: Node) =>
              node.id !== "transform_selected" && node.id !== "destination"
          ),
          transformGroupNode,
          ...linkTransforms,
          updatedDataSelectorDestinationNode,
        ];
      });

      setEdges([...createEdges]);
    }, [
      createNewTransformNode,
      selectedTransformRef,
      createEdges,
      handleCollapsed
    ]);

    useEffect(() => {
      transformCollapsedNodeConfig.data.handleExpand = handleExpand;
    }, [handleExpand, transformCollapsedNodeConfig]);

    useEffect(() => {
      if (selectedTransform.length > 0) {
        const linkTransforms = selectedTransform.map((transform, id) => {
          const newId = `transform_${id + 1}`;
          const xPosition = 25 + id * 150;
          return createNewTransformNode(newId, xPosition, transform.name);
        });

        const transformGroupNode = {
          id: "transform_group",
          data: {
            label: "Transform",
            handleCollapsed,
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

        setEdges([...createEdges]);
      } else {
        const defaultTransformationNode = {
          id: "add_transformation",
          data: {
            label: "Transformation",
          },
          position: { x: 300, y: 45 },
          targetPosition: Position.Left,
          type: "debeziumNode",
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
        setEdges([...createEdges]);
      }
    }, [
      createEdges,
      dataSourceNode,
      destinationName,
      destinationType,
      handleCollapsed,
      selectedTransform,
      createNewTransformNode,
    ]);

    const reactFlowProps = useMemo(() => ({
      nodes,
      edges,
      onNodesChange,
      onEdgesChange,
      nodeTypes,
      edgeTypes,
      proOptions,
      fitView: true,
      fitViewOptions: {
        padding: 0.2,
        includeHiddenNodes: false,
      },
      maxZoom: 1.4,
      minZoom: 1.4,
      onConnect,
      panOnScroll: true,
      panOnScrollMode: PanOnScrollMode.Horizontal,
      defaultViewport: { x: 0, y: 0, zoom: 1.4 },
      panOnDrag: true,
      onInit: (instance: any) => {
        instance.fitView({ padding: 0.2 });
      },
      snapToGrid: true,
      snapGrid: [20, 20] as [number, number],
      nodesDraggable: false,
    }), [nodes, edges, onNodesChange, onEdgesChange, nodeTypes, edgeTypes, proOptions, onConnect]);

    return (
      <div
        ref={reactFlowWrapper}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ReactFlow {...reactFlowProps}>
          <Background
            style={{
              borderRadius: "5px",
            }}
            gap={13}
            color={darkMode ? AppColors.dark : AppColors.white}
          />
        </ReactFlow>
      </div>
    );
  }
);

export default CompositionFlow;
