import { ProcessorDefinition } from '@kaoto/camel-catalog/types';
import { NodeIconResolver, NodeIconType } from '../../../../../utils/node-icon-resolver';
import { VizNodesWithEdges } from '../../../base-visual-entity';
import { createVisualizationNode } from '../../../visualization-node';
import { CamelRouteVisualEntityData, ICamelElementLookupResult } from '../../support/camel-component-types';
import { BaseNodeMapper } from './base-node-mapper';

export class WhenNodeMapper extends BaseNodeMapper {
  getVizNodeFromProcessor(
    path: string,
    _componentLookup: ICamelElementLookupResult,
    entityDefinition: unknown,
  ): VizNodesWithEdges {
    const processorName = 'when' as keyof ProcessorDefinition;

    const data: CamelRouteVisualEntityData = {
      path,
      icon: NodeIconResolver.getIcon(processorName, NodeIconType.EIP),
      processorName,
      isGroup: false,
      type: 'branch',
    };

    const vizNode = createVisualizationNode(path, data);

    const { nodes, edges } = this.getChildrenFromBranch(`${path}.steps`, entityDefinition);
    nodes.forEach((child) => {
      vizNode.addChild(child);
    });

    const lastIndex = nodes.length - 1;
    vizNode.setEndNodes([nodes[lastIndex]]);
    edges.push(BaseNodeMapper.getEdge(vizNode.id, nodes[0].id));

    return { nodes: [vizNode, ...nodes], edges };
  }
}
