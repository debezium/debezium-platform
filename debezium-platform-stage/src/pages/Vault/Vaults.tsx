import * as React from "react";
import { Button, PageSection } from "@patternfly/react-core";
import { PlusIcon } from "@patternfly/react-icons";
import EmptyStatus from "../../components/EmptyStatus";
import { useNavigate } from "react-router-dom";
import comingSoonImage from "../../assets/comingSoon.png";
import { useData } from "../../appLayout/AppContext";

export interface IVaultsProps {
  sampleProp?: string;
}

const Vaults: React.FunctionComponent<IVaultsProps> = () => {
  const navigate = useNavigate();

  const navigateTo = (url: string) => {
    navigate(url);
  };
  const { darkMode } = useData();

  return (
    <>
      <PageSection style={{ position: "relative" }} isFilled>
        <div
          className="transformation_overlay"
          style={darkMode ? { background: "rgba(41, 41, 41, 0.6)" } : {}}
        >
          <img src={comingSoonImage} alt="Coming Soon" />
        </div>
        <EmptyStatus
          heading="No vaults available"
          primaryMessage=' No vaults is configure for this cluster yet. To streams change
              events from a source database you can configure a source by click
              the "Add vaults" button.'
          secondaryMessage=""
          primaryAction={
            <Button variant="primary" icon={<PlusIcon />}>
              Add vaults
            </Button>
          }
          secondaryActions={
            <>
              <Button variant="link" onClick={() => navigateTo("/source")}>
                Go to source
              </Button>
              <Button variant="link" onClick={() => navigateTo("/destination")}>
                Go to destination
              </Button>
              <Button variant="link" onClick={() => navigateTo("/pipeline")}>
                Go to pipeline
              </Button>
            </>
          }
        />
      </PageSection>
    </>
  );
};

export { Vaults };
