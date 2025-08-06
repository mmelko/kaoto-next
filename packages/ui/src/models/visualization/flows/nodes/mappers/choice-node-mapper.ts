import { ProcessorDefinition } from '@kaoto/camel-catalog/types';
import { NodeIconResolver, NodeIconType } from '../../../../../utils/node-icon-resolver';
import { VizNodesWithEdges } from '../../../base-visual-entity';
import { createVisualizationNode } from '../../../visualization-node';
import { CamelRouteVisualEntityData, ICamelElementLookupResult } from '../../support/camel-component-types';
import { BaseNodeMapper } from './base-node-mapper';
import { CanvasEdge } from '../../../../../components/Visualization/Canvas/canvas.models';

export class ChoiceNodeMapper extends BaseNodeMapper {
  getVizNodeFromProcessor(
    path: string,
    _componentLookup: ICamelElementLookupResult,
    entityDefinition: unknown,
  ): VizNodesWithEdges {
    const processorName: keyof ProcessorDefinition = 'choice';

    const data: CamelRouteVisualEntityData = {
      path,
      icon: NodeIconResolver.getIcon(processorName, NodeIconType.EIP),
      processorName,
      isGroup: false, // Choice is a node, not a group
    };

    const vizNode = createVisualizationNode(path, data);
    const edges: CanvasEdge[] = [];
    vizNode.setEndNodes([]);

    const { nodes: whenNodes, edges: whenEdges } = this.getChildrenFromArrayClause(`${path}.when`, entityDefinition);
    whenNodes.forEach((node) => {
      if (node.data.type === 'branch') {
        vizNode.addChild(node);
        vizNode.appendEndNodes(...node.getEndNodes());
        edges.push(ChoiceNodeMapper.getEdge(vizNode.id, node.id));
      }
    });

    const { nodes: otherwiseNodes, edges: otherwiseEdges } = this.getChildrenFromSingleClause(
      `${path}.otherwise`,
      entityDefinition,
    );
    if (otherwiseNodes.length > 0) {
      vizNode.addChild(otherwiseNodes[0]);
      vizNode.appendEndNodes(...otherwiseNodes[0].getEndNodes());
      edges.push(ChoiceNodeMapper.getEdge(vizNode.id, otherwiseNodes[0].id));
    }

    console.log('choiceEndNodes', vizNode.getEndNodes());
    return {
      nodes: [vizNode, ...whenNodes, ...otherwiseNodes],
      edges: [...edges, ...whenEdges, ...otherwiseEdges],
    };
  }
}
