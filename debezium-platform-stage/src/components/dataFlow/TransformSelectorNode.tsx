import { Handle, Position } from "reactflow";
import "./DebeziumNode.css";

import { useData } from "../../appLayout/AppContext";
import { AppColors } from "@utils/constants";
import {
  Bullseye,
  Card,
  CardBody,
  Stack,
  StackItem,
} from "@patternfly/react-core";
import { DataProcessorIcon } from "@patternfly/react-icons";

interface TransformSelectorNodeProps {
  data: {
    label: string;
    sourcePosition: Position;
    targetPosition: Position;
    action: React.ReactNode;
  };
}

const TransformSelectorNode: React.FC<TransformSelectorNodeProps> = ({
  data,
}) => {
  const { darkMode } = useData();
  return (
    <>
      <div className="debeziumNodeWrapper debeziumNodeGradient">
        <div
          className="debeziumNodeInner"
          style={
            darkMode
              ? {
                  background: AppColors.dark,
                  cursor: "pointer",
                }
              : {
                  backgroundColor: AppColors.white,
                  cursor: "pointer",
                }
          }
        >
          <Handle type="target" id="smt-input" position={data.sourcePosition} />
          <Card
            ouiaId="BasicCard"
            isCompact
            isPlain
            className="pf-v5-u-box-shadow-md"
            style={{ cursor: "auto", width: 110 }}
          >
            <CardBody
              style={{ padding: "7px" }}
              className="pf-v5-u-box-shadow-md"
            >
              <Bullseye>
                <Stack>
                  <StackItem
                    style={{
                      textAlign: "center",
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <div>
                      <DataProcessorIcon style={{ fontSize: 18 }} />
                    </div>
                  </StackItem>
                  <StackItem>{data.action}</StackItem>
                </Stack>
              </Bullseye>
            </CardBody>
          </Card>
          <Handle
            type="source"
            id="smt-output"
            position={data.targetPosition}
          />
        </div>
      </div>
    </>
  );
};

export default TransformSelectorNode;
