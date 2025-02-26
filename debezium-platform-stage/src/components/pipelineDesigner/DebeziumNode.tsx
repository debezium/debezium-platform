import { Position } from "reactflow";
import "./DebeziumNode.css";

import dbz from "../../assets/debeziumNoText.png";
import { useData } from "../../appLayout/AppContext";
import { AppColors } from "@utils/constants";

interface DebeziumNodeProps {
  data: {
    label: string;
    sourcePosition: Position;
    targetPosition: Position;
    handleCollapsed: () => void;
  };
}

const DebeziumNode: React.FC<DebeziumNodeProps> = () => {
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
          {/* <Handle type="target" id="smt-input" position={data.targetPosition} /> */}
          <img
            src={dbz}
            alt={`Debezium icon`}
            style={{ maxHeight: "60px", padding: "5px" }}
          />
          {/* <Handle
            type="source"
            id="smt-output"
            position={data.sourcePosition}
          /> */}
        </div>
      </div>
      {/* <foreignObject>
        <div >
          <Button variant={"link"} size="sm" onClick={()=>{console.log('clicked')}}>Processor</Button>
        </div>
      </foreignObject> */}
    </>
  );
};

export default DebeziumNode;
