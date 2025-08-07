import { CanvasFormTabsProvider } from '@kaoto/forms';
import { FunctionComponent, JSX, PropsWithChildren, ReactNode } from 'react';
import { BaseVisualCamelEntity } from '../../models/visualization/base-visual-entity';
import { ErrorBoundary } from '../ErrorBoundary';

import { CanvasFallback } from './CanvasFallback';
import { ContextToolbar } from './ContextToolbar/ContextToolbar';
import './Visualization.scss';
import { RFCanvas } from './ReactFlowCanvas/RFCanvas';

interface CanvasProps {
  className?: string;
  entities: BaseVisualCamelEntity[];
  fallback?: ReactNode;
  additionalToolbarControls?: JSX.Element[];
}

export const Visualization: FunctionComponent<PropsWithChildren<CanvasProps>> = (props) => {
  return (
    <div className={`canvas-surface ${props.className ?? ''}`}>
      <CanvasFormTabsProvider>
        <ErrorBoundary fallback={props.fallback ?? <CanvasFallback />}>
          <RFCanvas
            contextToolbar={<ContextToolbar additionalControls={props.additionalToolbarControls} />}
            entities={props.entities}
          />
        </ErrorBoundary>
      </CanvasFormTabsProvider>
    </div>
  );
};
