import { Card, CardBody, Stack, StackItem } from "@patternfly/react-core";
import { Handle, Position } from "reactflow";
import "./DataNode.css";
import { DataSinkIcon, DataSourceIcon } from "@patternfly/react-icons";
import { useData } from "../../appLayout/AppContext";
import { AppColors, AppStrings } from "@utils/constants";

interface DataSelectorNodeProps {
  data: {
    label: string;
    type: string;
    action: React.ReactNode;
    welcomeFlow?: boolean;
  };
}

const DataSelectorNode: React.FC<DataSelectorNodeProps> = ({ data }) => {
  const { darkMode } = useData();
  return (
    <>
      <div
        className={
          data.type === AppStrings.source
            ? `wrapperSource gradientSource`
            : `wrapperDestination gradientDestination`
        }
      >
        <div
          className="inner"
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
          {data.type === AppStrings.source && (
            <Handle type="source" position={Position.Right} id="smt-input" />
          )}
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
                  <div>
                    {data.type === AppStrings.source ? (
                      <div
                        className={darkMode ? "connectorImageWrapperDark" : "connectorImageWrapperLight"}
                      >
                        <DataSourceIcon style={{ fontSize: "15px" }} />
                      </div>
                    ) : (
                      <div
                        className={darkMode ? "connectorImageWrapperDark" : "connectorImageWrapperLight"}
                      >
                        <DataSinkIcon style={{ fontSize: 15 }} />
                      </div>
                    )}
                  </div>
                </StackItem>
                {data.welcomeFlow ? (
                  <StackItem>{data.label}</StackItem>
                ) : (
                  <StackItem
                    style={{
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    {data.action}
                  </StackItem>
                )}
              </Stack>
            </CardBody>
          </Card>
          {data.type === AppStrings.destination && (
            <Handle type="target" position={Position.Left} id="smt-output" />
          )}
        </div>
      </div>
    </>
  );
};

export default DataSelectorNode;
