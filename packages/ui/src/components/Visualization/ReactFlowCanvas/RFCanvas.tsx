import { BaseVisualCamelEntity } from '../../../models';
import { FunctionComponent, PropsWithChildren, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Edge,
  MarkerType,
  Node,
  NodeMouseHandler,
  NodeTypes,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  Position,
  ReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FlowService } from '../Canvas/flow.service';
import { RFCustomNode } from './RFCustomNode';
import ELK, { ElkNode, LayoutOptions } from 'elkjs/lib/elk.bundled.js';
import { ErrorBoundary } from '../../ErrorBoundary';
import { FilteredFieldProvider } from '@kaoto/forms';
import { CanvasForm } from '../Canvas/Form/CanvasForm';
import { Drawer, DrawerContent, DrawerContentBody, DrawerPanelContent } from '@patternfly/react-core';
import { VisibleFlowsContext } from '../../../providers';
import { RFCustomGroup } from './RFCustomGroup';
import { CanvasNode } from '../Canvas';
import { IVisualizationNode } from '../../../models';

// Definícia typu pre dáta uzlov
interface NodeData {
  label?: string;
  vizNode?: IVisualizationNode;
  sourcePosition?: Position;
  targetPosition?: Position;
  [key: string]: unknown; // pre ďalšie vlastnosti
}

type RFElkNode = Node<NodeData> & CanvasNode & ElkNode & { layoutOptions?: LayoutOptions };

interface CanvasProps {
  entities: BaseVisualCamelEntity[];
  contextToolbar?: ReactNode;
}

const isHorizontal = false;
const PADDING = { top: 50, right: 20, bottom: 10, left: 20 };
const NODE_LABEL_HEIGHT = 20;

function getElkLayoutedElements(nodes: Node<NodeData>[], edges: Edge[]) {
  const rootNodes = nodes
    .filter((node) => node.type === 'cgroup' && node.parentId === undefined)
    .map((node) => getElkNode({ ...node, type: 'route' }, nodes));

  const elk = new ELK();
  const elkEdges = edges.map((edge) => ({
    ...edge,
    sources: [edge.source],
    targets: [edge.target],
  }));

  const elkGraph: ElkNode = {
    id: 'g1',
    layoutOptions: {
      'elk.padding': `[left=${PADDING.left}, top=${PADDING.top}, right=${PADDING.right}, bottom=${PADDING.bottom}]`,
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '80',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    },
    children: rootNodes as ElkNode[],
    edges: elkEdges,
  };

  return elk.layout(elkGraph).then((layoutedGraph) => {
    return flattenElkNodes(layoutedGraph.children as RFElkNode[]);
  });
}

function flattenElkNodes(elkNodes: RFElkNode[] = []): Node<NodeData>[] {
  return elkNodes.flatMap((node) => {
    const { children, ...nodeProps } = node;

    // Vytvorí aktuálny uzol s pozíciou priamo z ELK.
    const currentNode: Node<NodeData> = {
      ...nodeProps,
      position: { x: node.x ?? 0, y: node.y ?? 0 },
      style: { width: node.width, height: node.height },
      data: {
        ...node.data,
        label: node.data?.vizNode?.getNodeLabel(),
      } as NodeData,
    };

    // Rekurzívne sploští potomkov a spojí ich s aktuálnym uzlom.
    const childNodes = children ? flattenElkNodes(children as unknown as RFElkNode[]) : [];

    return [currentNode, ...childNodes];
  });
}

function getElkNode(node: Node<NodeData>, allNodes: Node<NodeData>[]): RFElkNode {
  const children = allNodes.filter((child) => child.parentId === node.id).map((child) => getElkNode(child, allNodes));

  // Predvolené pozície handle-ov (pre uzly v hlavnej route)
  const sourcePosition = isHorizontal ? Position.Right : Position.Bottom;
  const targetPosition = isHorizontal ? Position.Left : Position.Top;

  const elkNode: RFElkNode = { ...(node as RFElkNode) };
  let layoutOptions: LayoutOptions = {
    'elk.padding': `[left=${PADDING.left}, top=${PADDING.top}, right=${PADDING.right}, bottom=${PADDING.bottom}]`,
    'elk.algorithm': 'layered',
    'elk.direction': isHorizontal ? 'RIGHT' : 'DOWN',
  };

  if (node.type === 'cgroup') {
    layoutOptions = {
      'elk.padding': `[left=${PADDING.left}, top=${PADDING.top}, right=${PADDING.right}, bottom=${PADDING.bottom}]`,
      'elk.algorithm': 'layered',
      'elk.direction': isHorizontal ? 'RIGHT' : 'DOWN',
    };
  } else {
    elkNode.height = (elkNode.height ?? 0) + NODE_LABEL_HEIGHT;
  }

  return {
    ...elkNode,
    data: {
      ...elkNode.data,
      sourcePosition,
      targetPosition,
    } as NodeData,
    children: children as unknown as string[] & ElkNode[],
    layoutOptions,
  };
}

export const RFCanvas: FunctionComponent<PropsWithChildren<CanvasProps>> = ({ entities, contextToolbar }) => {
  const [nodes, setNodes] = useState<Node<NodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const { visibleFlows } = useContext(VisibleFlowsContext)!;

  const [selectedNode, setSelectedNode] = useState<CanvasNode | undefined>(undefined);
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(false);

  const nodeTypes: NodeTypes = {
    node: RFCustomNode,
    cgroup: RFCustomGroup,
    route: RFCustomGroup,
  };

  useEffect(() => {
    setSelectedNode(undefined);
    const allNodes: Node<NodeData>[] = [];
    let allEdges: Edge[] = [];

    entities.forEach((entity) => {
      if (visibleFlows[entity.id]) {
        const { nodes: entityNodes, edges: childEdges } = FlowService.getFlowDiagram(entity.id, entity.toVizNode());

        entityNodes.forEach((node) => {
          allNodes.push({
            ...node,
            position: { x: 0, y: 0 },
            id: node.id,
            data: {
              ...node.data,
              label: node.label,
            } as NodeData,
            parentId: node.parentNode,
            type: node.group ? 'cgroup' : 'node',
          });
        });

        allEdges = allEdges.concat(childEdges.map((edge) => ({ ...edge, type: 'smoothstep' })));
      }
    });

    getElkLayoutedElements(allNodes, allEdges).then((layoutedNodes) => {
      setNodes(layoutedNodes);
      setEdges(allEdges);
    });
  }, [entities, visibleFlows]);

  const onNodesChange: OnNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange: OnEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect: OnConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), []);

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNode(node as CanvasNode);
    setIsDrawerExpanded(true);
  }, []);

  const sidePanelContent = (
    <DrawerPanelContent>
      <ErrorBoundary fallback={<p>Something did not work as expected</p>}>
        {selectedNode && (
          <FilteredFieldProvider>
            <CanvasForm selectedNode={selectedNode} onClose={() => setIsDrawerExpanded(false)} />
          </FilteredFieldProvider>
        )}
      </ErrorBoundary>
    </DrawerPanelContent>
  );

  return (
    <Drawer isExpanded={isDrawerExpanded}>
      <DrawerContent panelContent={sidePanelContent}>
        <DrawerContentBody>
          {contextToolbar}
          <div style={{ width: '100vw', height: '100vh' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              defaultEdgeOptions={{ animated: true, type: 'default', markerEnd: { type: MarkerType.ArrowClosed } }}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              fitView
            >
              {/*<Background />*/}
            </ReactFlow>
          </div>
        </DrawerContentBody>
      </DrawerContent>
    </Drawer>
  );
};
