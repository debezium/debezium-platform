import PageHeader from "@components/PageHeader";
import { ActionGroup, Button, ButtonType, FormContextProvider, PageSection } from "@patternfly/react-core";
import * as React from "react";
import { useTranslation } from "react-i18next";
import style from "../../styles/createConnector.module.css"

export interface ICreateConnectionProps {

}

const CreateConnection:React.FunctionComponent<ICreateConnectionProps> = ({}) => {
    const { t } = useTranslation();
  return (
    <>
    <PageHeader
        title={"Create connection"}
        description={"Create connection by filling the form below"}
      />

    <FormContextProvider initialValues={{}}>
      {({ setValue, getValue, setError, values, errors }) => (
        <>
        
          <PageSection
            isWidthLimited={true}
            isCenterAligned
            isFilled
            className={`customPageSection ${style.createConnector_pageSection}`}
          >
          Connection form
          </PageSection>
          <PageSection className="pf-m-sticky-bottom" isFilled={false}>
            <ActionGroup className={style.createConnector_footer}>
              <Button
                variant="primary"
                // isLoading={isLoading}
                // isDisabled={isLoading || (editorSelected !== "form-editor" && codeAlert !== "")}
                type={ButtonType.submit}
                onClick={(e) => {
                  e.preventDefault();

                 console.log(values, errors);
                }}
              >
                {t("destination:create.title")}
              </Button>
              <Button
                  variant="link"
                  onClick={() => {}}
                >
                  {t("back")}
                </Button>
            </ActionGroup>
          </PageSection>
        </>
      )}
    </FormContextProvider>
  </>
  );
};

export { CreateConnection };