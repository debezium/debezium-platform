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
  useReactFlow,
} from "reactflow";
import { useData } from "../../appLayout/AppContext";
import { AppColors } from "@utils/constants";
import DataNode from "./DataNode";
import { Predicate, Transform, TransformData } from "src/apis";
import TransformLinkNode from "./TransformLinkNode";
import TransformGroupNode from "./TransformGroupNode";
import TransformCollapsedNode from "./TransformCollapsedNode";
import { Modal, ModalHeader, ModalBody, Button } from "@patternfly/react-core";
import PipelineTransformModel from "./PipelineTransformModel";
import { PlusIcon } from "@patternfly/react-icons";
import TransformAdditionNode from "./TransformAdditionNode";
import TransformSelectorNode from "./TransformSelectorNode";
import EditUnifiedCustomEdge from "./EditUnifiedCustomEdge";

const nodeTypes = {
  dataNode: DataNode,
  transformLinkNode: TransformLinkNode,
  transformGroupNode: TransformGroupNode,
  transformCollapsedNode: TransformCollapsedNode,
  addTransformNode: TransformAdditionNode,
  transformSelectorNode: TransformSelectorNode,
};

const edgeTypes = {
  editUnifiedCustomEdge: EditUnifiedCustomEdge,
};

const proOptions = { hideAttribution: true };

interface PipelineEditFlowProps {
  sourceName: string;
  sourceType: string;
  selectedTransform: Transform[];
  updateSelectedTransform: (transform: Transform[]) => void;
  destinationName: string;
  destinationType: string;
  openTransformDrawer: () => void;
}

const PipelineEditFlow: React.FC<PipelineEditFlowProps> = ({
  sourceName,
  sourceType,
  destinationName,
  destinationType,
  selectedTransform,
  updateSelectedTransform,
  openTransformDrawer,
}) => {
  const { darkMode } = useData();

  const reactFlowInstance = useReactFlow();

  const refitElements = useCallback(() => {
    setTimeout(() => {
      reactFlowInstance.fitView({
        padding: 0.2, // 20% padding
        duration: 200, // 200ms
      });
    }, 50);
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

  const [isTransformModalOpen, setIsTransformModalOpen] = useState(false);

  const handleTransformModalToggle = useCallback(() => {
    setIsTransformModalOpen(true);
  }, []);

  const cardButtonTransform = useCallback((): JSX.Element => {
    return (
      <Button
        variant="link"
        onClick={handleTransformModalToggle}
        style={{ padding: "5px 9px" }}
        icon={<PlusIcon />}
        size="sm"
      />
    );
  }, [handleTransformModalToggle]);

  const initialNodes: never[] = [];
  const initialEdges = [
    {
      id: "complete-flow-path-edit",
      source: "source",
      target: "destination",
      type: "editUnifiedCustomEdge",
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

  useEffect(() => {
    refitElements();
  }, [edges, nodes, refitElements]);

  const handleProcessor = useCallback(() => {
    const transformGroupNode = {
      id: "transform_group",
      data: {
        label: "Transform",
        onToggleDrawer: openTransformDrawer,
        handleCollapsed: handleCollapsed,
      },
      position: { x: 260, y: 25 },
      style: {
        width: 100 + 150 * selectedTransformRef.current.length - 10,
        height: 80,
        zIndex: 1,
      },
      type: "transformGroupNode",
      draggable: false,
    };

    const addTransformNode = {
      id: "add_transform",
      data: {
        label: "SMT2",
        action: cardButtonTransform(),
      },
      position: { x: 25 + selectedTransformRef.current.length * 150, y: 33 },
      style: {
        zIndex: 10,
      },
      targetPosition: "left",
      type: "addTransformNode",
      draggable: false,
      parentId: "transform_group",
      extent: "parent",
    };
    setNodes((prevNodes: any) => {
      return [
        ...prevNodes.filter((node: any) => node.id !== "transform_selector"),
        addTransformNode,
        transformGroupNode,
      ];
    });
  }, [cardButtonTransform, openTransformDrawer]);

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
        onToggleDrawer: openTransformDrawer,
        handleCollapsed: handleCollapsed,
      },
      position: { x: 260, y: 25 },
      style: {
        width: 100 + 150 * selectedTransformRef.current.length - 10,
        height: 80,
        zIndex: 1,
      },
      type: "transformGroupNode",
      draggable: false,
    };

    const addTransformNode = {
      id: "add_transform",
      data: {
        label: "SMT2",
        action: cardButtonTransform(),
      },
      position: { x: 25 + selectedTransformRef.current.length * 150, y: 33 },
      style: {
        zIndex: 10,
      },
      targetPosition: "left",
      type: "addTransformNode",
      draggable: false,
      parentId: "transform_group",
      extent: "parent",
    };

    setNodes((prevNodes: any) => {
      const dataSelectorDestinationNode = prevNodes.find(
        (node: any) => node.id === "destination"
      );

      const updatedDataSelectorDestinationNode = {
        ...dataSelectorDestinationNode,
        position: {
          ...dataSelectorDestinationNode.position,
          x: 450 + 150 * selectedTransformRef.current.length,
        },
      };

      return [
        ...prevNodes.filter(
          (node: any) =>
            node.id !== "transform_selected" && node.id !== "destination"
        ),

        transformGroupNode,
        ...linkTransforms,
        addTransformNode,
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
        type: "editUnifiedCustomEdge",
        data: { throughNodeNo: selectedTransformRef.current.length },
      },
    ];

    setEdges([...newEdge]);
  }, [destinationName, destinationType, selectedTransformRef.current.length]);

  const TransformCollapsedNode = useMemo(() => {
    return {
      id: "transform_selected",
      data: {
        label: "Transformation",
        handleExpand: handleExpand,
        selectedTransform: selectedTransformRef,
      },
      position: { x: 280, y: 44 },
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

  // const handleAddTransform = useCallback(
  //   (transform: TransformData) => {
  //     const transformNode = nodes.filter((node: any) => {
  //       return node.parentId === "transform_group";
  //     });
  //     let noOfTransformNodes = transformNode.length;
  //     if (noOfTransformNodes === 0) {
  //       handleProcessor();
  //       noOfTransformNodes = 1;
  //     }
  //     const transformLinkNode = transformNode.filter((node: any) => {
  //       return node.id !== "add_transform";
  //     });
  //     const transformID =
  //       noOfTransformNodes === 1
  //         ? 1
  //         : +transformLinkNode[transformLinkNode.length - 1].id.split("_")[1] +
  //           1;

  //     const newId = `transform_${transformID}`;
  //     const xPosition = 25 + (noOfTransformNodes - 1) * 150;

  //     const newTransformNode = createNewTransformNode(
  //       newId,
  //       xPosition,
  //       transform.name,
  //       transform.predicate
  //     );

  //     setNodes((prevNodes: any) => {
  //       const addTransformNode = prevNodes.find(
  //         (node: any) => node.id === "add_transform"
  //       );
  //       const transformGroupNode = prevNodes.find(
  //         (node: any) => node.id === "transform_group"
  //       );
  //       const dataSelectorDestinationNode = prevNodes.find(
  //         (node: any) => node.id === "destination"
  //       );

  //       const updatedAddTransformNode = {
  //         ...addTransformNode,
  //         position: {
  //           ...addTransformNode.position,
  //           x: addTransformNode.position.x + 150,
  //         },
  //       };
  //       const updatedDataSelectorDestinationNode = {
  //         ...dataSelectorDestinationNode,
  //         position: {
  //           ...dataSelectorDestinationNode.position,
  //           x: dataSelectorDestinationNode.position.x + 150,
  //         },
  //       };
  //       const updatedTransformGroupNode = {
  //         ...transformGroupNode,
  //         style: {
  //           ...transformGroupNode.style,
  //           width: transformGroupNode.style.width + 150,
  //         },
  //       };

  //       return [
  //         ...prevNodes.filter(
  //           (node: any) =>
  //             node.id !== "add_transform" &&
  //             node.id !== "transform_group" &&
  //             node.id !== "destination"
  //         ),
  //         newTransformNode,
  //         updatedAddTransformNode,
  //         updatedTransformGroupNode,
  //         updatedDataSelectorDestinationNode,
  //       ];
  //     });
  //     let newEdge: {
  //       id: string;
  //       source: string;
  //       target: string;
  //       data: { throughNodeNo: number };
  //       type: string;
  //     }[] = [];

  //     newEdge = [
  //       {
  //         id: "complete-multi-flow-path",
  //         source: "source",
  //         target: "destination",
  //         type: "editUnifiedCustomEdge",
  //         data: { throughNodeNo: noOfTransformNodes },
  //       },
  //     ];

  //     setEdges([...newEdge]);
  //     updateSelectedTransform({ name: transform.name, id: transform.id });
  //     setIsTransformModalOpen(false);
  //   },
  //   [nodes, updateSelectedTransform, handleProcessor]
  // );

  const handleAddTransform = useCallback(
    (transforms: TransformData[]) => {
      const transformNode = nodes.filter((node: any) => {
        return node.parentId === "transform_group";
      });
      let noOfTransformNodes = transformNode.length;
      if (noOfTransformNodes === 0) {
        handleProcessor();
        noOfTransformNodes = 1;
      }
      const transformLinkNode = transformNode.filter((node: any) => {
        return node.id !== "add_transform";
      });
      const transformID =
        noOfTransformNodes === 1
          ? 1
          : +transformLinkNode[transformLinkNode.length - 1].id.split("_")[1] +
          1;

      const newTransformNode: any[] = [];

      transforms.forEach((transform, index) => {
        const newId = `transform_${transformID + index}`;
        const xPosition = 25 + (noOfTransformNodes + index - 1) * 150;

        newTransformNode.push(
          createNewTransformNode(
            newId,
            xPosition,
            transform.name,
            transform.predicate
          )
        );
      });

      setNodes((prevNodes: any) => {
        const addTransformNode = prevNodes.find(
          (node: any) => node.id === "add_transform"
        );
        const transformGroupNode = prevNodes.find(
          (node: any) => node.id === "transform_group"
        );
        const dataSelectorDestinationNode = prevNodes.find(
          (node: any) => node.id === "destination"
        );

        const updatedAddTransformNode = {
          ...addTransformNode,
          position: {
            ...addTransformNode.position,
            x: addTransformNode.position.x + 150 * transforms.length,
          },
        };
        const updatedDataSelectorDestinationNode = {
          ...dataSelectorDestinationNode,
          position: {
            ...dataSelectorDestinationNode.position,
            x: dataSelectorDestinationNode.position.x + 150 * transforms.length,
          },
        };
        const updatedTransformGroupNode = {
          ...transformGroupNode,
          style: {
            ...transformGroupNode.style,
            width: transformGroupNode.style.width + 150 * transforms.length,
          },
        };

        return [
          ...prevNodes.filter(
            (node: any) =>
              node.id !== "add_transform" &&
              node.id !== "transform_group" &&
              node.id !== "destination"
          ),
          ...newTransformNode,
          updatedAddTransformNode,
          updatedTransformGroupNode,
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
          type: "unifiedCustomEdge",
          data: { throughNodeNo: noOfTransformNodes },
        },
      ];

      const updatedTransforms = transforms.map((transform) => ({
        name: transform.name,
        id: transform.id
      }));

      setEdges([...newEdge]);
      updateSelectedTransform(updatedTransforms);
      setIsTransformModalOpen(false);
    },
    [nodes, updateSelectedTransform, handleProcessor]
  );

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
          // transform.predicate
        );
        return newTransformNode;
      });

      const addTransformNode = {
        id: "add_transform",
        data: {
          label: "SMT2",
          action: cardButtonTransform(),
        },
        position: { x: 25 + selectedTransform.length * 150, y: 33 },
        style: {
          zIndex: 10,
        },
        targetPosition: "left",
        type: "addTransformNode",
        draggable: false,
        parentId: "transform_group",
        extent: "parent",
      };
      const transformGroupNode = {
        id: "transform_group",
        data: {
          label: "Transform",
          onToggleDrawer: openTransformDrawer,
          handleCollapsed: handleCollapsed,
        },
        position: { x: 260, y: 25 },
        style: {
          width: 100 + 150 * selectedTransform.length - 10,
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
        position: { x: 450 + 150 * selectedTransform.length, y: 40 },
        type: "dataNode",
        draggable: false,
      };

      setNodes([
        dataSourceNode,
        transformGroupNode,
        ...linkTransforms,
        addTransformNode,
        dataDestinationNode,
      ]);
    } else {
      const transformSelectorNode = {
        id: "transform_selector",
        data: {
          label: "Transformation",
          action: (
            <Button
              variant="link"
              onClick={handleTransformModalToggle}
              style={{ paddingRight: 5, paddingLeft: 5, fontSize: ".8em" }}
              icon={<PlusIcon />}
              size="sm"
            >
              Transform
            </Button>
          ),
        },
        position: { x: 280, y: 45 },
        targetPosition: Position.Left,
        type: "transformSelectorNode",
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
      setNodes([dataSourceNode, transformSelectorNode, dataDestinationNode]);
    }
    setEdges([
      {
        id: "complete-flow-path-edit",
        source: "source",
        target: "destination",
        type: "editUnifiedCustomEdge",
        data: { throughNode: "add_transformation" },
        sourceHandle: "a",
      },
    ]);
  }, [
    openTransformDrawer,
    destinationName,
    destinationType,
    handleCollapsed,
    selectedTransform,
    setNodes,
    sourceName,
    sourceType,
    cardButtonTransform,
    handleTransformModalToggle,
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
    maxZoom: 1.4,
    minZoom: 1.4,
    onConnect,
    panOnScroll: true,
    panOnScrollMode: PanOnScrollMode.Horizontal,
    panOnDrag: true,
    onInit: (instance: any) => {
      instance.fitView({ padding: 0.2 });
    },
  }), [nodes, edges, onNodesChange, onEdgesChange, nodeTypes, edgeTypes, proOptions, onConnect]);

  const backgroundProps = useMemo(() => ({
    style: {
      borderRadius: "5px",
    },
    gap: 13,
    color: darkMode ? AppColors.dark : AppColors.white,
  }), [darkMode]);

  const gradientDefs = useMemo(() => (
    <defs>
      <linearGradient id="edge-gradient-edit">
        <stop offset="0%" stopColor="#a5c82d" />
        <stop offset="50%" stopColor="#7fc5a5" />
        <stop offset="100%" stopColor="#58b2da" />
      </linearGradient>
    </defs>
  ), []);

  return (
    <>
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
          <Background {...backgroundProps} />
          <svg>
            {gradientDefs}
          </svg>
        </ReactFlow>
      </div>
      <Modal
        isOpen={isTransformModalOpen}
        onClose={() => setIsTransformModalOpen(false)}
        aria-labelledby="modal-transform-body-with-description"
        aria-describedby="modal-transform-body-with-description"
      >
        <ModalHeader
          title="Pipeline transform"
          className="pipeline_flow-modal_header"
          labelId="modal-with-transform-description-title"
          description="Select a source to be used in pipeline from the list of already configured source listed below or configure a new source by selecting create a new source radio card."
        />
        <ModalBody tabIndex={0} id="modal-transform-body-with-description">
          <PipelineTransformModel onTransformSelection={handleAddTransform} />
        </ModalBody>
      </Modal>
    </>
  );
};

export default PipelineEditFlow;
