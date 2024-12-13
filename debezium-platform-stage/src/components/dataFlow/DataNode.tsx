import {
  Card,
  CardBody,
  Bullseye,
  Stack,
  StackItem,
  Tooltip,
  Content,
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
    editAction: () => void;
    compositionFlow?: boolean;
  };
}

const DataNode: React.FC<DataNodeProps> = ({ data }) => {
  const { darkMode } = useData();

  return (
    <>
    {!data.compositionFlow  && (<div
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
      </div>)}
      
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
              <Bullseye>
                <Stack>
                  <StackItem
                    style={{
                      textAlign: "center",
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <Bullseye
                      style={
                        darkMode
                          ? {
                              background: AppColors.darkBlue,
                              padding: 10,
                              borderRadius: 10,
                            }
                          : {}
                      }
                    >
                      <ConnectorImage
                        connectorType={data.connectorType}
                        size={30}
                      />
                    </Bullseye>
                  </StackItem>
                  <StackItem
                    style={{
                      paddingTop: 5,
                      paddingInlineEnd: 5,
                      paddingInlineStart: 5,
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
              </Bullseye>
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
