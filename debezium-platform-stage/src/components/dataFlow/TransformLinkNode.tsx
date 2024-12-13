import {
  Card,
  CardBody,
  Bullseye,
  CardFooter,
  Content,
} from "@patternfly/react-core";
import { Handle, Position } from "reactflow";
import "./TransformLinkNode.css";

import { OptimizeIcon } from "@patternfly/react-icons";
import { useData } from "../../appLayout/AppContext";
import { AppColors } from "@utils/constants";

interface TransformLinkNodeProps {
  data: { label: string; sourcePosition: Position; targetPosition: Position };
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
                }
          }
        >
          <Handle type="target" id="smt-input" position={data.sourcePosition} />
          <Card ouiaId="BasicCard" isCompact isPlain>
            <CardBody
              style={{
                paddingTop: 8,
                paddingBottom: 2,
                paddingLeft: 10,
                paddingRight: 10,
              }}
            >
              <Bullseye>
                <div>
                  <OptimizeIcon style={{ fontSize: 15 }} />
                </div>
              </Bullseye>
            </CardBody>
            <CardFooter
              style={{ paddingLeft: 10, paddingRight: 10, paddingBottom: 5 }}
            >
                <Content
                type="p"
                style={{
                  fontSize: "8px",
                  fontWeight: "bold",
                  maxWidth: "100px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                >
                {data.label}
                </Content>
            </CardFooter>
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

export default TransformLinkNode;
