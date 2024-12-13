import {
  Card,
  CardBody,
  Bullseye,
  Stack,
  StackItem,
} from "@patternfly/react-core";
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
                      {data.type === AppStrings.source ? (
                        <DataSourceIcon style={{ fontSize: 18 }} />
                      ) : (
                        <DataSinkIcon style={{ fontSize: 18 }} />
                      )}
                    </div>
                  </StackItem>
                  {data.welcomeFlow ? (<StackItem>{data.type}</StackItem>): (<StackItem>{data.action}</StackItem>)}
                  
                </Stack>
              </Bullseye>
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
