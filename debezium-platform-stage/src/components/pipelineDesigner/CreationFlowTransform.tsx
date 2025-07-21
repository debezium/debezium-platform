/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  MiniMap,
  PanOnScrollMode,
  useReactFlow,
  Panel,
} from "reactflow";
import TransformAdditionNode from "./TransformAdditionNode";

import DataNode from "./DataNode";

import { MdLogin, MdLogout } from "react-icons/md";
import DataSelectorNode from "./DataSelectorNode";
import { Button, Modal, ModalBody, ModalHeader, Tooltip } from "@patternfly/react-core";
import {
  Destination,
  Predicate,
  Source,
  Transform,
  TransformData,
} from "../../apis/apis";
import { PlusIcon, UploadIcon } from "@patternfly/react-icons";
import "./CreationFlow.css";
import PipelineSourceModel from "./PipelineSourceModel";
import PipelineDestinationModel from "./PipelineDestinationModel";
import { useData } from "../../appLayout/AppContext";
import { AppColors } from "@utils/constants";
import TransformLinkNode from "./TransformLinkNode";
import PipelineTransformModel from "./PipelineTransformModel";
import TransformGroupNode from "./TransformGroupNode";

import TransformSelectorNode from "./TransformSelectorNode";
import TransformCollapsedNode from "./TransformCollapsedNode";
import UnifiedCustomEdge from "./UnifiedCustomEdge";
import { selectedDestinationAtom, selectedSourceAtom, selectedTransformAtom } from "@pipelinePage/PipelineDesigner";
import { useAtom } from "jotai/react";
import ServerConfigModal from "@components/ServerConfigModal";

const nodeTypes = {
  dataSelectorNode: DataSelectorNode,
  transformLinkNode: TransformLinkNode,
  addTransformNode: TransformAdditionNode,
  transformGroupNode: TransformGroupNode,
  transformSelectorNode: TransformSelectorNode,
  transformCollapsedNode: TransformCollapsedNode,
  dataNode: DataNode,
};

const edgeTypes = {
  unifiedCustomEdge: UnifiedCustomEdge,
};

const proOptions = { hideAttribution: true };
interface CreationFlowTransformProps {
  updateSelectedSource: (source: Source) => void;
  updateSelectedDestination: (destination: Destination) => void;
  updateSelectedTransform: (transform: Transform) => void;
  onToggleDrawer: () => void;
}

const CreationFlowTransform: React.FC<CreationFlowTransformProps> = ({
  updateSelectedSource,
  updateSelectedDestination,
  updateSelectedTransform,
  onToggleDrawer,
}) => {
  const { darkMode } = useData();

  const reactFlowInstance = useReactFlow();

  const [selectedTransform] = useAtom(selectedTransformAtom);
  const [selectedSource] = useAtom(selectedSourceAtom);
  const [selectedDestination] = useAtom(selectedDestinationAtom);


  const refitElements = () => {
    setTimeout(() => {
      reactFlowInstance.fitView({
        padding: 0.2, // 20% padding
        duration: 200, // 200ms
      });
    }, 50);
  };

  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      refitElements();
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isTransformModalOpen, setIsTransformModalOpen] = useState(false);
  const [isDestinationModalOpen, setIsDestinationModalOpen] = useState(false);

  const [isDbzServerConfigModalOpen, setIsDbzServerConfigModalOpen] = useState(false);

  const handleSourceModalToggle = useCallback(() => {
    setIsSourceModalOpen(!isSourceModalOpen);
  }, [isSourceModalOpen]);

  const handleTransformModalToggle = useCallback(() => {
    setIsTransformModalOpen(true);
  }, []);

  const handleDestinationModalToggle = useCallback(() => {
    setIsDestinationModalOpen(!isDestinationModalOpen);
  }, [isDestinationModalOpen]);

  const cardButton = useCallback(
    (buttonText: string): JSX.Element => {
      return (
        <Button
          variant="link"
          onClick={
            buttonText === "Source"
              ? handleSourceModalToggle
              : buttonText === "Destination"
                ? handleDestinationModalToggle
                : handleTransformModalToggle
          }
          style={{ paddingRight: 5, paddingLeft: 5, fontSize: ".8em" }}
          icon={<PlusIcon />}
          size="sm"
        >
          {buttonText}
        </Button>
      );
    },
    [
      handleSourceModalToggle,
      handleDestinationModalToggle,
      handleTransformModalToggle,
    ]
  );

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

  const addTransformNode = useMemo(() => {
    return {
      id: "add_transform",
      data: {
        label: "SMT2",
        action: cardButtonTransform(),
      },
      position: { x: 45, y: 40 },
      style: {
        zIndex: 10,
      },
      targetPosition: "left",
      type: "addTransformNode",
      draggable: false,
      parentId: "transform_group",
      extent: "parent",
    };
  }, [cardButtonTransform]);

  const transformSelectorNode = useMemo(() => {
    return {
      id: "transform_selector",
      data: {
        label: "Transformation",
        action: cardButton("Transform"),
      },
      position: { x: 269, y: 79 },
      targetPosition: "left",
      type: "transformSelectorNode",
      draggable: false,
    };
  }, [cardButton]);

  const dataSelectorSourceNode = useMemo(() => {
    return {
      id: "source",
      data: {
        icon: MdLogout,
        label: "Source",
        type: "source",
        action: cardButton("Source"),
      },
      position: { x: 50, y: 80 },
      type: "dataSelectorNode",
      draggable: false,
    };
  }, [cardButton]);

  const dataSelectorDestinationNode = useMemo(() => {
    return {
      id: "destination",
      data: {
        icon: MdLogin,
        label: "Destination",
        type: "destination",
        action: cardButton("Destination"),
      },
      position: { x: 480, y: 78 },
      type: "dataSelectorNode",
      draggable: false,
    };
  }, [cardButton]);

  useEffect(() => {
    if (selectedTransform.length > 0) {
      console.log("transform are selected", selectedTransform);

      const dataSourceNode = {
        id: "source",
        data: {
          connectorType: selectedSource?.type,
          label: selectedSource?.name || "Source",
          type: "source",
          editAction: () => setIsSourceModalOpen(true),
        },
        position: { x: 50, y: 80 },
        type: "dataNode",
        draggable: false,
      };

      const linkTransforms = selectedTransform.map((transform, id) => {
        const newId = `transform_${id + 1}`;
        const xPosition = 25 + id * 150;
        const newTransformNode = createNewTransformNode(
          newId,
          xPosition,
          transform.name,
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
        position: { x: 25 + selectedTransform.length * 150, y: 40 },
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
          onToggleDrawer: onToggleDrawer,
          handleCollapsed: handleCollapsed,
        },
        position: { x: 260, y: 57 },
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
          connectorType: selectedDestination?.type,
          label: selectedDestination?.name || "Destination",
          type: "destination",
          editAction: () => setIsDestinationModalOpen(true),
        },
        position: { x: 450 + 150 * selectedTransform.length, y: 80 },
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
      if (selectedSource) {
        onSourceSelection(selectedSource);
      }
      if (selectedDestination) {
        onDestinationSelection(selectedDestination);
      }
    }
  }, [
  ]);

  const initialNodes = [
    dataSelectorSourceNode,
    transformSelectorNode,
    dataSelectorDestinationNode,
  ];
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
      position: { x: xPosition, y: 31 },
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

  const selectedTransformRef = useRef(selectedTransform);
  selectedTransformRef.current = selectedTransform;

  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      // Skip on the initial load
      hasMounted.current = true;
      return;
    }
    const transformLinkNodes = nodes.filter(
      (node: any) => node.type === "transformLinkNode"
    );
    const filteredTransformLinkNode = transformLinkNodes.filter((node: any) => {
      return selectedTransformRef.current.some(
        (transform: Transform) => transform.name === node.data.label
      );
    });
    let updatedTransformLinkNodes: never[] = [];
    if (filteredTransformLinkNode.length === 0) {
      setNodes((prevNodes: any) => {
        const defaultDestinationNode = prevNodes.find(
          (node: any) => node.id === "destination"
        );

        const updatedDefaultDestinationNode = {
          ...defaultDestinationNode,
          position: { x: 480, y: 78 },
        };
        return [
          ...prevNodes.filter(
            (node: any) =>
              !node.id.includes("transform") || node.id === "destination"
          ),
          transformSelectorNode,
          updatedDefaultDestinationNode,
        ];
      });
      return;
    } else if (filteredTransformLinkNode.length < transformLinkNodes.length) {
      updatedTransformLinkNodes = filteredTransformLinkNode.map(
        (node: any, index: number) => {
          const matchingNode = filteredTransformLinkNode.find(
            (filteredNode: any) =>
              filteredNode.data.label === selectedTransformRef.current[index]?.name
          );
          return {
            ...node,
            data: {
              ...node.data,
              label: selectedTransformRef.current[index]?.name,
              ...(matchingNode?.data.predicate && {
                predicate: {
                  ...matchingNode.data.predicate,
                },
              }),
            },
            position: {
              ...node.position,
              x: 25 + index * 150,
            },
          };
        }
      );
      const updateAddTransformNode = nodes.filter(
        (node: any) => node.type === "addTransformNode"
      );
      const updateTransformGroupNode = nodes.filter(
        (node: any) => node.id === "transform_group"
      );
      const updateDataDestinationNode = nodes.filter(
        (node: any) => node.id === "destination"
      );
      const updatedAddTransformNode = [
        {
          ...updateAddTransformNode[0],
          position: {
            ...updateAddTransformNode[0].position,
            x: 45 + selectedTransformRef.current.length * 150,
          },
        },
      ];
      const updatedTransformGroupNode = [
        {
          ...updateTransformGroupNode[0],
          style: {
            ...updateTransformGroupNode[0].style,
            width: 100 + +150 * selectedTransformRef.current.length,
          },
        },
      ];
      const updatedDataDestinationNode = [
        {
          ...updateDataDestinationNode[0],
          position: {
            ...updateDataDestinationNode[0].position,
            x: 480 + selectedTransformRef.current.length * 150,
          },
        },
      ];
      setNodes((prevNodes: any) => {
        return [
          ...prevNodes.filter(
            (node: any) =>
              node.id === "source" || node.id === "transform_selector"
          ),
          ...updatedTransformLinkNodes,
          ...updatedAddTransformNode,
          ...updatedTransformGroupNode,
          ...updatedDataDestinationNode,
        ];
      });
      return;
    } else if (filteredTransformLinkNode.length === transformLinkNodes.length) {
      updatedTransformLinkNodes = filteredTransformLinkNode.map(
        (node: any, index: number) => {
          const matchingNode = filteredTransformLinkNode.find(
            (filteredNode: any) =>
              filteredNode.data.label === selectedTransformRef.current[index]?.name
          );
          return {
            ...node,
            data: {
              label: selectedTransformRef.current[index]?.name,
              ...(matchingNode?.data.predicate && {
                predicate: {
                  ...matchingNode.data.predicate,
                },
              }),
            },
          }
        }
      );

    }
    setNodes((prevNodes: any) => {
      return [
        ...prevNodes.filter((node: any) => node.type !== "transformLinkNode"),
        ...updatedTransformLinkNodes,
      ];
    });
  }, [
    selectedTransform,
    setNodes,
  ]);


  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      hasMounted.current = false;
    }
  }, []);

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
        onToggleDrawer: onToggleDrawer,
        handleCollapsed: handleCollapsed,
      },
      position: { x: 260, y: 57 },
      style: {
        width: 100 + +150 * selectedTransformRef.current.length,
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
      position: { x: 45 + selectedTransformRef.current.length * 150, y: 36 },
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
          x:
            dataSelectorDestinationNode.position.x +
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
        type: "unifiedCustomEdge",
        data: { throughNodeNo: selectedTransformRef.current.length },
      },
    ];

    setEdges([...newEdge]);
  }, [cardButtonTransform, onToggleDrawer]);

  const TransformCollapsedNode = useMemo(() => {
    return {
      id: "transform_selected",
      data: {
        label: "Transformation",
        handleExpand: handleExpand,
        selectedTransform: selectedTransformRef,
      },
      position: { x: 270, y: 78 },
      targetPosition: "left",
      type: "transformCollapsedNode",
      draggable: false,
    };
  }, [handleExpand]);

  const handleCollapsed = useCallback(() => {
    setNodes((prevNodes: any) => {
      const destinationNode = prevNodes.find(
        (node: any) => node.id === "destination"
      );

      const updatedDestinationNode = {
        ...destinationNode,
        position: {
          ...dataSelectorDestinationNode.position,
          x: 480,
        },
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
    setEdges([
      {
        id: "complete-flow-path",
        source: "source",
        target: "destination",
        type: "unifiedCustomEdge",
        data: { throughNode: "add_transformation" },
        sourceHandle: "a",
      },
    ]);
  }, [
    TransformCollapsedNode,
    dataSelectorDestinationNode
  ]);

  const transformGroupNode = useMemo(() => {
    return {
      id: "transform_group",
      data: {
        label: "Transform",
        onToggleDrawer: onToggleDrawer,
        handleCollapsed: handleCollapsed,
      },
      position: { x: 260, y: 57 },
      style: {
        width: 100,
        height: 80,
        zIndex: 1,
      },
      type: "transformGroupNode",
      draggable: false,
    };
  }, [handleCollapsed, onToggleDrawer]);

  const handleProcessor = useCallback(() => {
    setNodes((prevNodes: any) => {
      return [
        ...prevNodes.filter((node: any) => node.id !== "transform_selector"),
        addTransformNode,
        transformGroupNode,
      ];
    });
  }, [addTransformNode, transformGroupNode]);

  const handleAddTransform = useCallback(
    (transform: TransformData) => {
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

      const newId = `transform_${transformID}`;
      const xPosition = 25 + (noOfTransformNodes - 1) * 150;

      const newTransformNode = createNewTransformNode(
        newId,
        xPosition,
        transform.name,
        transform.predicate
      );

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
            x: addTransformNode.position.x + 150,
          },
        };
        const updatedDataSelectorDestinationNode = {
          ...dataSelectorDestinationNode,
          position: {
            ...dataSelectorDestinationNode.position,
            x: dataSelectorDestinationNode.position.x + 150,
          },
        };
        const updatedTransformGroupNode = {
          ...transformGroupNode,
          style: {
            ...transformGroupNode.style,
            width: transformGroupNode.style.width + 150,
          },
        };

        return [
          ...prevNodes.filter(
            (node: any) =>
              node.id !== "add_transform" &&
              node.id !== "transform_group" &&
              node.id !== "destination"
          ),
          newTransformNode,
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

      setEdges([...newEdge]);
      updateSelectedTransform({ name: transform.name, id: transform.id });
      setIsTransformModalOpen(false);
    },
    [nodes, updateSelectedTransform, handleProcessor]
  );

  const onSourceSelection = useCallback(
    (source: Source) => {
      const selectedSourceNode = {
        id: "source",
        data: {
          connectorType: source.type,
          label: source.name,
          type: "source",
          editAction: () => setIsSourceModalOpen(true),
        },
        position: { x: 50, y: 80 },
        type: "dataNode",
        draggable: false,
      };
      updateSelectedSource(source);

      setNodes((prevNodes: any) => {
        return [
          ...prevNodes.filter((node: any) => node.id !== "source"),
          selectedSourceNode,
        ];
      });

      setIsSourceModalOpen(false);
    },
    [updateSelectedSource]
  );

  const onDestinationSelection = useCallback(
    (destination: Destination) => {
      updateSelectedDestination(destination);

      setNodes((prevNodes: any) => {
        const defaultDestinationNode = prevNodes.find(
          (node: any) => node.id === "destination"
        );

        const updatedDefaultDestinationNode = {
          ...defaultDestinationNode,
          data: {
            connectorType: destination.type,
            label: destination.name,
            type: "destination",
            editAction: () => setIsDestinationModalOpen(true),
          },
          type: "dataNode",
          draggable: false,
        };

        return [
          ...prevNodes.filter((node: any) => node.id !== "destination"),
          updatedDefaultDestinationNode,
        ];
      });

      setIsDestinationModalOpen(false);
    },
    [
      updateSelectedDestination,
    ]
  );
  return (
    <>
      <div ref={reactFlowWrapper} style={{ width: "100%", height: "100%" }}>
        <ReactFlow
          key={nodes.length} // Forces re-render when nodes change
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          proOptions={proOptions}
          fitView
          panOnScroll={true}
          panOnScrollMode={PanOnScrollMode.Horizontal}
          maxZoom={1.4}
          minZoom={1.1}
          panOnDrag={true}
          onInit={(instance) => {
            instance.fitView({ padding: 0.2 });
          }}
        >
          <Panel position="top-right">
            <Tooltip
              content={
                <div>
                  Upload the DBZ server config to create new source, transformations and destination for a pipeline.
                  <br />
                </div>
              }>
              <Button variant="secondary" icon={<UploadIcon />} onClick={() => setIsDbzServerConfigModalOpen(!isDbzServerConfigModalOpen)}>
                DBZ server config
              </Button>
            </Tooltip>
          </Panel>
          <MiniMap />
          <Background
            style={{
              borderRadius: "5px",
              // backgroundColor: "#F2F9F9"
            }}
            gap={13}
            color={darkMode ? AppColors.dark : AppColors.white}
          />
        </ReactFlow>
      </div>

      <Modal
        isOpen={isSourceModalOpen}
        onClose={handleSourceModalToggle}
        aria-labelledby="modal-source-body-with-description"
        aria-describedby="modal-source-body-with-description"
      >
        <ModalHeader
          title="Pipeline source"
          className="pipeline_flow-modal_header"
          labelId="modal-with-source-description-title"
          description="Select a source to be used in pipeline from the list of already configured source listed below or configure a new source by selecting create a new source radio card."
        />
        <ModalBody tabIndex={0} id="modal-source-body-with-description">
          <PipelineSourceModel onSourceSelection={onSourceSelection} />
        </ModalBody>
      </Modal>
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
      <Modal
        isOpen={isDestinationModalOpen}
        onClose={handleDestinationModalToggle}
        aria-labelledby="modal-with-description-title"
        aria-describedby="modal-box-body-destination-with-description"
      >
        <ModalHeader
          title="Pipeline destination"
          className="pipeline_flow-modal_header"
          labelId="modal-with-destination-description-title"
          description="Select a destination to be used in pipeline from the list of already configured destination listed below or configure a new destination by selecting create a new destination radio card."
        />
        <ModalBody
          tabIndex={0}
          id="modal-box-body-destination-with-description"
        >
          <PipelineDestinationModel
            onDestinationSelection={onDestinationSelection}
          />
        </ModalBody>
      </Modal>
      <ServerConfigModal
        isModalOpen={isDbzServerConfigModalOpen}
        toggleModal={() => setIsDbzServerConfigModalOpen(!isDbzServerConfigModalOpen)}
        updateSelectedSource={onSourceSelection}
        updateSelectedDestination={onDestinationSelection}
        updateSelectedTransform={updateSelectedTransform}
      />

    </>
  );
};

export default CreationFlowTransform;
