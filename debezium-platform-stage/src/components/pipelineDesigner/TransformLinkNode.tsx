import {
  Card,
  CardBody,
  Content,
  Tooltip,
  Icon,
  Divider,
  Stack,
  StackItem,
} from "@patternfly/react-core";
import { Position } from "reactflow";
import "./TransformLinkNode.css";

import { DataProcessorIcon, FilterIcon } from "@patternfly/react-icons";
import { useData } from "../../appLayout/AppContext";
import { AppColors } from "@utils/constants";

type Predicate = {
  label: string;
  negate: boolean;
};

interface TransformLinkNodeProps {
  data: {
    label: string;
    sourcePosition: Position;
    targetPosition: Position;
    predicate?: Predicate;
  };
}

const TransformLinkNode: React.FC<TransformLinkNodeProps> = ({ data }) => {
  const { darkMode } = useData();

  return (
    <>
      <div className="transformationWrapper transformationGradient">
        <div
          className="transformationInner"
          style={
            darkMode
              ? {
                  background: AppColors.dark,
                }
              : {
                  backgroundColor: AppColors.white,
                  cursor: "unset",
                }
          }
        >
          {/* <Handle type="target" id="smt-input" position={data.sourcePosition} /> */}
          <Card
            ouiaId="BasicCard"
            isCompact
            isPlain
            style={{ position: "relative" }}
          >
            {data.predicate && (
              <div
                style={{
                  cursor: "pointer",
                  position: "absolute",
                  top: -4,
                  right: 5,
                  zIndex: 1,
                }}
              >
                <Tooltip content={data.predicate.label}>
                  <Icon status="info">
                    <FilterIcon style={{ fontSize: 8 }} />
                  </Icon>
                </Tooltip>
              </div>
            )}

            <CardBody
              style={{
                paddingTop: "5px",
                paddingBottom: "2px",
                paddingLeft: "5px",
                paddingRight: "5px",
              }}
            >
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
                      borderRadius: "4px",
                      width: "25px",
                      height: "25px",
                    }}
                  >
                    <DataProcessorIcon style={{ fontSize: 15 }} />
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
                    style={{
                      fontSize: "9px",
                      fontWeight: "bold",
                      maxWidth: "100px",
                      minWidth: "60px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      textAlign: "center",
                    }}
                  >
                    {data.label}
                  </Content>
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

export default TransformLinkNode;
