import * as React from "react";
import { Button, PageSection } from "@patternfly/react-core";
import { PlusIcon } from "@patternfly/react-icons";
import EmptyStatus from "../../components/EmptyStatus";
import { useNavigate } from "react-router-dom";
import comingSoonImage from "../../assets/comingSoon.png";
import { useData } from "../../appLayout/AppContext";
import { featureFlags } from "@utils/featureFlag";
import { useTranslation } from "react-i18next";


export interface IConnectionsProps {
  sampleProp?: string;
}

const Connections: React.FunctionComponent<IConnectionsProps> = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const navigateTo = (url: string) => {
    navigate(url);
  };
  const { darkMode } = useData();

  return (
    <>
      <PageSection style={{ position: "relative", minHeight: "100%", overflow: "hidden" }} isFilled>
        {!featureFlags.Connection && (
          <div
            className="transformation_overlay"
            style={darkMode ? { background: "rgba(41, 41, 41, 0.6)" } : {}}
          >
            <img src={comingSoonImage} alt="Coming Soon" />
          </div>
        )}

        <div className="vault_overlay">

          <EmptyStatus
            heading={"No Connection available"}
            primaryMessage={"No connections is configured yet. Configure a one by selecting 'Add Connection' option below."}
            secondaryMessage=""
            primaryAction={
              <Button variant="primary" icon={<PlusIcon />}>
               Add connection
              </Button>
            }
            secondaryActions={
              <>
               <Button variant="link" onClick={() => navigateTo("/pipeline")}>
                  {t("pipeline")}
                </Button>
                <Button variant="link" onClick={() => navigateTo("/source")}>
                  {t("source")}
                </Button>
                <Button variant="link" onClick={() => navigateTo("/destination")}>
                  {t("destination")}
                </Button>
               
              </>
            }
          />

        </div>
      </PageSection>
    </>
  );
};

export { Connections };
