import {
  DrawerActions,
  DrawerCloseButton,
  DrawerHead,
  DrawerPanelBody,
  DrawerPanelContent,
  Title,
  Button,
  Flex,
  FlexItem,
} from "@patternfly/react-core";
import { ExternalLinkAltIcon } from "@patternfly/react-icons";
import { useDocDrawer } from "./DocDrawerContext";
import { useTranslation } from "react-i18next";
import "./DocDrawerPanel.css";

const DocDrawerPanel: React.FC = () => {
  const { url, title, closeDoc } = useDocDrawer();
  const { t } = useTranslation();

  return (
    <DrawerPanelContent
      className="doc-drawer-panel"
      defaultSize="35%"
      minSize="300px"
      isResizable
    >
      <DrawerHead>
        <Flex
          justifyContent={{ default: "justifyContentSpaceBetween" }}
          alignItems={{ default: "alignItemsCenter" }}
          className="doc-drawer-header"
        >
          <FlexItem>
            <Title headingLevel="h3" size="lg">
              {title}
            </Title>
          </FlexItem>
          <FlexItem>
            <Button
              variant="link"
              component="a"
              href={url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              icon={<ExternalLinkAltIcon />}
              iconPosition="end"
              isSmall
            >
              {t("helpTopic.openInNewTab")}
            </Button>
          </FlexItem>
        </Flex>
        <DrawerActions>
          <DrawerCloseButton onClick={closeDoc} />
        </DrawerActions>
      </DrawerHead>
      <DrawerPanelBody className="doc-drawer-body" hasNoPadding>
        {url && (
          <iframe
            src={url}
            title={title || "Documentation"}
            className="doc-drawer-iframe"
          />
        )}
      </DrawerPanelBody>
    </DrawerPanelContent>
  );
};

export default DocDrawerPanel;
