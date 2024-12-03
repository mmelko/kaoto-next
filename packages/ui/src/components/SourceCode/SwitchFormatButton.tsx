import { CodeEditorControl } from '@patternfly/react-code-editor';
import { FunctionComponent } from 'react';
import { CodeIcon } from '@patternfly/react-icons';

interface ISwitchFormatButton {
  isVisible: boolean;
  onClick: () => void;
}

export const SwitchFormatButton: FunctionComponent<ISwitchFormatButton> = (props) => {
  return (
    <CodeEditorControl
      key="switchFormatButton"
      icon={<CodeIcon />}
      aria-label="Undo change"
      data-testid="sourceCode--undoButton"
      onClick={props.onClick}
      tooltipProps={{ content: 'switch format', position: 'top' }}
      isVisible
    />
  );
};
