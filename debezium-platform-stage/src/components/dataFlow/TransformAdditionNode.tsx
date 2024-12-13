import {
  Button,
} from "@patternfly/react-core";
import { Handle, Position } from "reactflow";
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
          <Handle type="target" id="smt-input" position={data.targetPosition} />
          {/* <Card ouiaId="BasicCard" isCompact isPlain>
            <CardBody
              style={{
                paddingTop: 8,
                paddingBottom: 2,
                paddingLeft: 5,
                paddingRight: 5,
              }}
            >
              <Bullseye>
                <div>
                  <OptimizeIcon style={{ fontSize: 15 }} />
                </div>
              </Bullseye>
            </CardBody>
            <CardFooter
              style={{ paddingLeft: 10, paddingRight: 10, paddingBottom: 4 }}
            >
              {data.action ? (
                data.action
              ) : (
                <Button
                  variant="link"
                  style={{ paddingRight: 5, paddingLeft: 5, fontSize: ".7em" }}
                  size="sm"
                  icon={<PlusIcon />}
                  onClick={() => {}}
                >
                  {data.label}
                </Button>
              )}
            </CardFooter>
          </Card> */}
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
          <Handle
            type="source"
            id="smt-output"
            position={data.sourcePosition}
          />
        </div>
      </div>
    </>
  );
};

export default TransformAdditionNode;
