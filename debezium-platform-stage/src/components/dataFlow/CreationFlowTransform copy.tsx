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
  MiniMap,
  PanOnScrollMode,
} from "reactflow";
import TransformAdditionNode from "./TransformAdditionNode";

import DataNode from "./DataNode";

import { MdLogin, MdLogout } from "react-icons/md";
import DataSelectorNode from "./DataSelectorNode";
import { Button, Modal, ModalBody, ModalHeader } from "@patternfly/react-core";
import { Destination, Source, Transform, TransformData } from "../../apis/apis";
import { PlusIcon } from "@patternfly/react-icons";
import "./CreationFlow.css";
import SourcePipelineModel from "./SourcePipelineModel";
import DestinationPipelineModel from "./DestinationPipelineModel";
import CustomEdgeDestination from "./CustomEdgeDestination";
import CustomEdgeSource from "./CustomEdgeSource";
import { useData } from "../../appLayout/AppContext";
import { AppColors } from "@utils/constants";
import TransformLinkNode from "./TransformLinkNode";
import TransformPipelineModel from "./TransformPipelineModel";
import TransformGroupNode from "./TransformGroupNode";

import TransformSelectorNode from "./TransformSelectorNode";
import TransformSelectedNode from "./TransformSelectedNode";

const nodeTypes = {
  dataSelectorNode: DataSelectorNode,
  transformLinkNode: TransformLinkNode,
  addTransformNode: TransformAdditionNode,
  transformGroupNode: TransformGroupNode,
  transformSelectorNode: TransformSelectorNode,
  transformSelectedNode: TransformSelectedNode,
  dataNode: DataNode,
};

const edgeTypes = {
  customEdgeSource: CustomEdgeSource,
  customEdgeDestination: CustomEdgeDestination,
};

const proOptions = { hideAttribution: true };
interface CreationFlowTransformProps {
  updateIfSourceConfigured: (isConfigured: boolean) => void;
  updateIfDestinationConfigured: (isConfigured: boolean) => void;
  updateSelectedSource: (source: Source) => void;
  updateSelectedDestination: (destination: Destination) => void;
  updateSelectedTransform: (transform: Transform) => void;
  onToggleDrawer: () => void;
  selectedTransform: Transform[];
}

const CreationFlowTransform: React.FC<CreationFlowTransformProps> = ({
  updateIfSourceConfigured,
  updateIfDestinationConfigured,
  updateSelectedSource,
  updateSelectedDestination,
  updateSelectedTransform,
  onToggleDrawer,
  selectedTransform,
}) => {
  const { darkMode } = useData();
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isTransformModalOpen, setIsTransformModalOpen] = useState(false);
  const [isDestinationModalOpen, setIsDestinationModalOpen] = useState(false);

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
          style={{ paddingRight: 10, paddingLeft: 10, fontSize: ".8em" }}
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
        sourcePosition: "right",
        targetPosition: "left",
        action: cardButtonTransform(),
      },
      position: { x: 45, y: 37 },
      style: {
        zIndex: 10,
      },
      targetPosition: "left",
      type: "addTransformNode",
      parentId: "transform_group",
      extent: "parent",
    };
  }, [cardButtonTransform]);

  const transformSelectorNode = useMemo(() => {
    return {
      id: "transform_selector",
      data: {
        label: "Transformation",
        sourcePosition: "left",
        targetPosition: "right",
        action: cardButton("Transform"),
      },
      position: { x: 270, y: 50 },
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
      position: { x: 480, y: 80 },
      type: "dataSelectorNode",
      draggable: false,
    };
  }, [cardButton]);

  const initialNodes = [
    dataSelectorSourceNode,
    transformSelectorNode,
    dataSelectorDestinationNode,
  ];
  const initialEdges = [
    {
      id: "source_transform_selector",
      source: "source",
      target: "transform_selector",
      type: "customEdgeSource",
      sourceHandle: "a",
    },
    {
      id: "transform_selector-destination",
      source: "transform_selector",
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

  const createNewTransformNode = (
    id: string,
    xPosition: number,
    transformName: string
  ) => {
    return {
      id,
      data: {
        label: transformName,
        sourcePosition: "left",
        targetPosition: "right",
      },
      position: { x: xPosition, y: 30 },
      targetPosition: "left",
      style: {
        zIndex: 999,
      },
      type: "transformLinkNode",
      parentId: "transform_group",
      extent: "parent",
    };
  };

  const handleExpand = useCallback(() => {
    const linkTransforms = selectedTransform.map((transform, id) => {
      const newId = `transform_${id}`;
      const xPosition = 25 + (id - 1) * 150;
      const newTransformNode = createNewTransformNode(
        newId,
        xPosition,
        transform.name
      );
      return newTransformNode;
    });
    console.log(linkTransforms);
  }, [selectedTransform]);

  const TransformSelectedNode = useMemo(() => {
    return {
      id: "transform_selected",
      data: {
        label: "Transformation",
        sourcePosition: "right",
        targetPosition: "left",
        handleExpand: handleExpand,
      },
      position: { x: 270, y: 50 },
      targetPosition: "left",
      type: "transformSelectedNode",
      draggable: false,
    };
  }, [handleExpand, selectedTransform]);

  const handleCollapsed = useCallback(() => {
    setNodes((prevNodes: any) => {
      return [
        ...prevNodes.filter(
          (node: any) =>
            !node.id.includes("transform") || node.id === "destination"
        ),
        TransformSelectedNode,
        dataSelectorDestinationNode,
      ];
    });
    setEdges([
      {
        id: "source_transform_selected",
        source: "source",
        target: "transform_selected",
        type: "customEdgeSource",
        sourceHandle: "a",
      },
      {
        id: "transform_selected-destination",
        source: "transform_selected",
        target: "destination",
        type: "customEdgeDestination",
      },
    ]);
  }, [TransformSelectedNode, dataSelectorDestinationNode]);

  const transformGroupNode = useMemo(() => {
    return {
      id: "transform_group",
      data: {
        label: "Transform",
        sourcePosition: "right",
        targetPosition: "left",
        onToggleDrawer: onToggleDrawer,
        handleCollapsed: handleCollapsed,
      },
      position: { x: 260, y: 45 },
      style: {
        width: 100,
        height: 80,
        zIndex: 1,
      },
      type: "transformGroupNode",
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
    setEdges([
      {
        id: "source-add_transform",
        source: "source",
        target: "add_transform",
        type: "customEdgeSource",
        sourceHandle: "a",
      },
      {
        id: "add_transform-destination",
        source: "add_transform",
        target: "destination",
        type: "customEdgeDestination",
      },
    ]);
  }, [addTransformNode, transformGroupNode]);

  const handleAddTransform = useCallback(
    (transform: TransformData) => {
      let noOfTransformNodes = nodes.filter((node: any) => {
        return node.parentId === "transform_group";
      }).length;
      if (noOfTransformNodes === 0) {
        handleProcessor();
        noOfTransformNodes = 1;
      }
      const newId = `transform_${noOfTransformNodes}`;
      const xPosition = 25 + (noOfTransformNodes - 1) * 150;
      const newTransformNode = createNewTransformNode(
        newId,
        xPosition,
        transform.name
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
      let previousTransformId: string;
      let newEdge: {
        id: string;
        source: string;
        target: string;
        type: string;
      }[] = [];
      if (noOfTransformNodes > 1) {
        previousTransformId = `transform_${noOfTransformNodes - 1}`; // Previous node ID
        newEdge = [
          {
            id: `${previousTransformId}-${newId}`,
            source: previousTransformId,
            target: newId,
            type: "customEdgeDestination",
          },
          {
            id: `${newId}-add_transform`,
            source: newId,
            target: "add_transform",
            type: "customEdgeDestination",
          },
        ];
      } else {
        previousTransformId = `source`;
        newEdge = [
          {
            id: `${previousTransformId}-${newId}`,
            source: previousTransformId,
            target: newId,
            type: "customEdgeSource",
          },
          {
            id: `${newId}-add_transform`,
            source: newId,
            target: "add_transform",
            type: "customEdgeDestination",
          },
        ];
      }
      setEdges((prevEdges: any) => [
        ...prevEdges.filter(
          (edge: any) =>
            edge.id !== `${previousTransformId}-add_transform` &&
            edge.id !== `source-add_transform`
        ),
        ...newEdge,
      ]);
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
      };
      updateIfSourceConfigured(true);
      updateSelectedSource(source);

      setNodes((prevNodes: any) => {
        return [
          ...prevNodes.filter((node: any) => node.id !== "source"),
          selectedSourceNode,
        ];
      });

      handleSourceModalToggle();
    },
    [updateIfSourceConfigured, updateSelectedSource, handleSourceModalToggle]
  );

  const onDestinationSelection = useCallback(
    (destination: Destination) => {
      updateIfDestinationConfigured(true);
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
        };

        return [
          ...prevNodes.filter((node: any) => node.id !== "destination"),
          updatedDefaultDestinationNode,
        ];
      });

      handleDestinationModalToggle();
    },
    [
      updateIfDestinationConfigured,
      updateSelectedDestination,
      handleDestinationModalToggle,
    ]
  );
  return (
    <>
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
        maxZoom={1.3}
        minZoom={1.1}
        panOnDrag={true}
      >
        <MiniMap />
        {/* <Controls /> */}
        <Background
          style={{
            borderRadius: "5px",
            // backgroundColor: "#F2F9F9"
          }}
          gap={13}
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
          <SourcePipelineModel onSourceSelection={onSourceSelection} />
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
          <TransformPipelineModel onTransformSelection={handleAddTransform} />
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
          <DestinationPipelineModel
            onDestinationSelection={onDestinationSelection}
          />
        </ModalBody>
      </Modal>
    </>
  );
};

export default CreationFlowTransform;



// const handleExpand = useCallback(() => {
//   const linkTransforms = selectedTransform.map((transform, id) => {
//     const newId = `transform_${id}`;
//     const xPosition = 25 + (id - 1) * 150;
//     const newTransformNode = createNewTransformNode(
//       newId,
//       xPosition,
//       transform.name
//     );
//     return newTransformNode;
//   });
//   console.log(linkTransforms);
//   // setNodes((prevNodes: any) => {
//   //   const dataSelectorDestinationNode = prevNodes.find(
//   //     (node: any) => node.id === "destination"
//   //   );

//   //   // const updatedAddTransformNode = {
//   //   //   ...addTransformNode,
//   //   //   position: {
//   //   //     ...addTransformNode.position,
//   //   //     x: addTransformNode.position.x + 150 * selectedTransform.length,
//   //   //   },
//   //   // };
//   //   const updatedDataSelectorDestinationNode = {
//   //     ...dataSelectorDestinationNode,
//   //     position: {
//   //       ...dataSelectorDestinationNode.position,
//   //       x:
//   //         dataSelectorDestinationNode.position.x +
//   //         150 * selectedTransform.length,
//   //     },
//   //   };
//   //   // const updatedTransformGroupNode = {
//   //   //   ...transformGroupNode,
//   //   //   style: {
//   //   //     ...transformGroupNode.style,
//   //   //     width:
//   //   //       transformGroupNode.style.width + 150 * selectedTransform.length,
//   //   //   },
//   //   // };
//   //   return [
//   //     ...prevNodes.filter(
//   //       (node: any) =>
//   //         node.id === "transform_selected" || node.id === "destination"
//   //     ),
//   //     // updatedAddTransformNode,
//   //     // updatedTransformGroupNode,
//   //     ...linkTransforms,
//   //     updatedDataSelectorDestinationNode,
//   //   ];
//   // });

//   // const newEdge: {
//   //   id: string;
//   //   source: string;
//   //   target: string;
//   //   type: string;
//   // }[] = [];
//   // selectedTransform.map((_transform, id) => {
//   //   const newId = `transform_${id + 1}`;
//   //   if (id === 0) {
//   //     newEdge.push({
//   //       id: `source-transform_${id + 1}`,
//   //       source: "source",
//   //       target: newId,
//   //       type: "customEdgeSource",
//   //     });
//   //   }
//   //   newEdge.push({
//   //     id: `transform_${id}--add_transform`,
//   //     source: `transform_${id}`,
//   //     target: "add_transform",
//   //     type: "customEdgeDestination",
//   //   });
//   // });

//   // newEdge.push({
//   //   id: `transform_${selectedTransform.length}-destination`,
//   //   source: `transform_${selectedTransform.length}`,
//   //   target: "destination",
//   //   type: "customEdgeDestination",
//   // });

//   // setEdges([...newEdge]);
// }, [selectedTransform]);
