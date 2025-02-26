import { Button } from "@patternfly/react-core";
import { Position } from "reactflow";
import "./TransformAdditionNode.css";

import { PlusIcon } from "@patternfly/react-icons";
import { useData } from "../../appLayout/AppContext";
import { AppColors } from "@utils/constants";

interface TransformAdditionNodeProps {
  data: {
    label: string;
    sourcePosition: Position;
    targetPosition: Position;
    action: React.ReactNode;
  };
}

const TransformAdditionNode: React.FC<TransformAdditionNodeProps> = ({
  data,
}) => {
  const { darkMode } = useData();
  return (
    <>
      <div className="transformationAdditionWrapper transformationGradient">
        <div
          className="transformationAdditionInner"
          style={
            darkMode
              ? {
                  background: AppColors.dark,
                }
              : {
                  backgroundColor: AppColors.white,
                }
          }
        >
          {/* <Handle type="target" id="smt-input" position={data.targetPosition} /> */}
          {data.action ? (
            data.action
          ) : (
            <Button
              variant="plain"
              style={{ paddingRight: 5, paddingLeft: 5, fontSize: ".7em" }}
              size="sm"
              icon={<PlusIcon />}
              onClick={() => {}}
            />
          )}
          {/* <Handle
            type="source"
            id="smt-output"
            position={data.sourcePosition}
          /> */}
        </div>
      </div>
    </>
  );
};

export default TransformAdditionNode;
