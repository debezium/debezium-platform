import {
  Card,
  CardBody,
  Stack,
  StackItem,
  Tooltip,
  Content,
  Divider,
} from "@patternfly/react-core";
import { Handle, Position } from "reactflow";
import ConnectorImage from "../ComponentImage";
import "./DataNode.css";
import { PencilAltIcon } from "@patternfly/react-icons";
import { useData } from "../../appLayout/AppContext";
import { AppColors, AppStrings } from "../../utils/constants";

interface DataNodeProps {
  data: {
    connectorType: string;
    label: string;
    type: string;
    editAction?: () => void;
  };
}

const DataNode: React.FC<DataNodeProps> = ({ data }) => {
  const { darkMode } = useData();

  return (
    <>
      {data.editAction && (
        <div
          onClick={data.editAction}
          className={
            data.type === AppStrings.source
              ? "gradientSource editDataNodeSource"
              : "gradientDestination editDataNodeDestination"
          }
        >
          <Tooltip content={<div>Change pipeline {data.type}.</div>}>
            <div
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
              <PencilAltIcon />
            </div>
          </Tooltip>
        </div>
      )}

      <div
        className={
          data.type === AppStrings.source
            ? "wrapperSource gradientSource"
            : "wrapperDestination gradientDestination"
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
            isPlain
            isCompact
            className="pf-v5-u-box-shadow-md"
            style={{ cursor: "auto", minWidth: 110 }}
          >
            <CardBody style={{ padding: 7 }} className="pf-v5-u-box-shadow-md">
              <Stack>
                <StackItem
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    paddingBottom: 5,
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      justifyContent: "center",
                      alignItems: "center",
                      backgroundColor:
                        "var(--pf-global--palette--black-200, #f5f5f5)",
                      borderRadius: "5px",
                      width: "35px",
                      height: "35px",
                      padding: "5px",
                    }}
                  >
                    <ConnectorImage
                      connectorType={data.connectorType}
                      designerComponent={true}
                      size={30}
                    />
                  </div>
                </StackItem>
                <Divider />
                <StackItem
                  style={{
                    paddingTop: 3,
                    textAlign: "center",
                  }}
                >
                  <Content
                    type="p"
                    style={{ fontSize: "10px", fontWeight: "bold" }}
                  >
                    {data.label}
                  </Content>
                </StackItem>
              </Stack>
            </CardBody>
          </Card>
          {data.type === "destination" && (
            <Handle type="target" position={Position.Left} id="smt-output" />
          )}
        </div>
      </div>
    </>
  );
};

export default DataNode;
