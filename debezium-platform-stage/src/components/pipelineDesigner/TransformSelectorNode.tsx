import { useData } from "../../appLayout/AppContext";
import { AppColors } from "@utils/constants";
import { Card, CardBody, Stack, StackItem } from "@patternfly/react-core";
import { DataProcessorIcon } from "@patternfly/react-icons";

interface TransformSelectorNodeProps {
  data: {
    label: string;
    // sourcePosition: Position;
    // targetPosition: Position;
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
          {/* <Handle type="target" id="smt-input" position={data.sourcePosition} /> */}
          <Card
            ouiaId="BasicCard"
            isCompact
            isPlain
            className="pf-v5-u-box-shadow-md"
            style={{ cursor: "auto", width: 110 }}
          >
            <CardBody
              style={{
                paddingTop: "5px",
                paddingBottom: "2px",
                paddingLeft: "10px",
                paddingRight: "10px",
              }}
              className="pf-v5-u-box-shadow-md"
            >
              <Stack>
                <StackItem
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    paddingBottom: "5px",
                  }}
                >
                  <div
                    className={darkMode ? "connectorImageWrapperDark" : "connectorImageWrapperLight"}
                  >
                    <DataProcessorIcon style={{ fontSize: 15 }} />
                  </div>
                </StackItem>
                <StackItem
                  style={{
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  {data.action}
                </StackItem>
              </Stack>
            </CardBody>
          </Card>
          {/* <Handle
            type="source"
            id="smt-output"
            position={data.targetPosition}
          /> */}
        </div>
      </div>
    </>
  );
};

export default TransformSelectorNode;
