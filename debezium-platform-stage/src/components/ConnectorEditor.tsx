// ConnectorEditor.tsx
import * as React from 'react';
import {
  PageSection,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import { PencilAltIcon, CodeIcon } from "@patternfly/react-icons";
import { CodeEditor, Language } from "@patternfly/react-code-editor";

interface ConnectorEditorProps {
  editorSelected: string;
  onEditorChange: (id: string) => void;
  code: any;
  onCodeChange: (code: any) => void;
  children?: React.ReactNode;
  alert?: React.ReactNode;
}

export const ConnectorEditor: React.FC<ConnectorEditorProps> = ({
  editorSelected,
  onEditorChange,
  code,
  onCodeChange,
  children,
  alert
}) => {
  const handleItemClick = (event: any) => {
    const id = event.currentTarget.id;
    onEditorChange(id);
  };

  return (
    <>
      <PageSection className="connector-toolbar">
        <Toolbar id="editor-toggle">
          <ToolbarContent>
            <ToolbarItem>
              <ToggleGroup aria-label="Toggle between form editor and smart editor">
                <ToggleGroupItem
                  icon={<PencilAltIcon />}
                  text="Form editor"
                  buttonId="form-editor"
                  isSelected={editorSelected === "form-editor"}
                  onChange={handleItemClick}
                />
                <ToggleGroupItem
                  icon={<CodeIcon />}
                  text="Smart editor"
                  buttonId="smart-editor"
                  isSelected={editorSelected === "smart-editor"}
                  onChange={handleItemClick}
                />
              </ToggleGroup>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
        {alert}
      </PageSection>

      <PageSection>
        {editorSelected === "form-editor" ? (
          children
        ) : (
          <CodeEditor
            isUploadEnabled
            isDownloadEnabled
            isCopyEnabled
            isLanguageLabelVisible
            isMinimapVisible
            language={Language.json}
            isFullHeight
            code={JSON.stringify(code, null, 2)}
            onChange={(value) => {
              try {
                onCodeChange(JSON.parse(value));
              } catch (error) {
                console.error("Invalid JSON:", error);
              }
            }}
          />
        )}
      </PageSection>
    </>
  );
};