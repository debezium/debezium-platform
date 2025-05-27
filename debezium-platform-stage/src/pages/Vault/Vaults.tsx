import * as React from "react";
import { Button, PageSection } from "@patternfly/react-core";
import { PlusIcon } from "@patternfly/react-icons";
import EmptyStatus from "../../components/EmptyStatus";
import { useNavigate } from "react-router-dom";
import comingSoonImage from "../../assets/comingSoon.png";
import { useData } from "../../appLayout/AppContext";
import { featureFlags } from "@utils/featureFlag";
import { useTranslation } from "react-i18next";
import "./Vaults.css"

export interface IVaultsProps {
  sampleProp?: string;
}

const Vaults: React.FunctionComponent<IVaultsProps> = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const navigateTo = (url: string) => {
    navigate(url);
  };
  const { darkMode } = useData();

  return (
    <>
      <PageSection style={{ position: "relative", minHeight: "100%", overflow: "hidden" }} isFilled>
        {!featureFlags.Vault && (
          <div
            className="transformation_overlay"
            style={darkMode ? { background: "rgba(41, 41, 41, 0.6)" } : {}}
          >
            <img src={comingSoonImage} alt="Coming Soon" />
          </div>
        )}

        <div className="vault_overlay">

          <EmptyStatus
            heading={t("emptyState.title", { val: t("vault:vault") })}
            primaryMessage={t("emptyState.description", { val: t("vault:vault") })}
            secondaryMessage=""
            primaryAction={
              <Button variant="primary" icon={<PlusIcon />}>
                {t("addButton", { val: t("vault:vault") })}
              </Button>
            }
            secondaryActions={
              <>
                <Button variant="link" onClick={() => navigateTo("/source")}>
                  {t("source")}
                </Button>
                <Button variant="link" onClick={() => navigateTo("/destination")}>
                  {t("destination")}
                </Button>
                <Button variant="link" onClick={() => navigateTo("/pipeline")}>
                  {t("pipeline")}
                </Button>
              </>
            }
          />

        </div>
      </PageSection>
    </>
  );
};

export { Vaults };
