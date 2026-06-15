import * as React from "react";
import { Button, PageSection } from "@patternfly/react-core";
import { PlusIcon } from "@patternfly/react-icons";
import EmptyStatus from "../../components/EmptyStatus";
import { useNavigate } from "react-router-dom";
import { FeatureGate } from "../../components/FeatureGate";
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

  return (
    <>
      <PageSection style={{ position: "relative", minHeight: "calc(100vh - 200px)", overflow: "hidden" }} isFilled>
        <FeatureGate flag="Vault">
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
        </FeatureGate>
      </PageSection>
    </>
  );
};

export { Vaults };
