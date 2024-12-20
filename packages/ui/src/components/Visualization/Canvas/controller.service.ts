import {
  BreadthFirstLayout,
  ColaGroupsLayout,
  ColaLayout,
  ComponentFactory,
  ConcentricLayout,
  DagreGroupsLayout,
  DefaultEdge,
  ForceLayout,
  Graph,
  GraphComponent,
  GraphElement,
  GridLayout,
  Layout,
  LEFT_TO_RIGHT,
  ModelKind,
  TOP_TO_BOTTOM,
  Visualization,
  withPanZoom,
} from '@patternfly/react-topology';
import { CustomGroupWithSelection, CustomNodeWithSelection, NoBendpointsEdge, EdgeEndWithButton } from '../Custom';
import { LayoutType } from './canvas.models';

export class ControllerService {
  static createController(): Visualization {
    const newController = new Visualization();

    newController.registerLayoutFactory(this.baselineLayoutFactory);
    newController.registerComponentFactory(this.baselineComponentFactory);
    newController.registerElementFactory(this.baselineElementFactory);
    newController.setFitToScreenOnLayout(true, 80);
    newController.fromModel({
      graph: {
        id: 'g1',
        type: 'graph',
      },
    });

    return newController;
  }

  // ### dagre algo options, uses default value on undefined ###
  // nodeSep: undefined, // the separation between adjacent nodes in the same rank
  // edgeSep: undefined, // the separation between adjacent edges in the same rank
  // rankSep: undefined, // the separation between each rank in the layout
  // rankDir: undefined, // 'TB' for top to bottom flow, 'LR' for left to right,
  // align: undefined,  // alignment for rank nodes. Can be 'UL', 'UR', 'DL', or 'DR', where U = up, D = down, L = left, and R = right
  // acyclicer: undefined, // If set to 'greedy', uses a greedy heuristic for finding a feedback arc set for a graph.
  // A feedback arc set is a set of edges that can be removed to make a graph acyclic.
  // ranker: undefined, // Type of algorithm to assign a rank to each node in the input graph. Possible values: 'network-simplex', 'tight-tree' or 'longest-path'
  // minLen: function( edge ){ return 1; }, // number of ranks to keep between the source and target of the edge
  // edgeWeight: function( edge ){ return 1; }, // higher weight edges are generally made shorter and straighter than lower weight edges

  // ### general layout options ###
  // fit: true, // whether to fit to viewport
  // padding: 30, // fit padding
  // spacingFactor: undefined, // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
  // nodeDimensionsIncludeLabels: false, // whether labels should be included in determining the space used by a node
  // animate: false, // whether to transition the node positions
  // animateFilter: function( node, i ){ return true; }, // whether to animate specific nodes when animation is on; non-animated nodes immediately go to their final positions
  // animationDuration: 500, // duration of animation in ms if enabled
  // animationEasing: undefined, // easing of animation if enabled
  // boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  // transform: function( node, pos ){ return pos; }, // a function that applies a transform to the final node position
  // ready: function(){}, // on layoutready
  // sort: undefined, // a sorting function to order the nodes and edges; e.g. function(a, b){ return a.data('weight') - b.data('weight') }
  // because cytoscape dagre creates a directed graph, and directed graphs use the node order as a tie breaker when
  // defining the topology of a graph, this sort function can help ensure the correct order of the nodes/edges.
  // this feature is most useful when adding and removing the same nodes and edges multiple times in a graph.
  // stop: function(){} // on layoutstop
  static baselineLayoutFactory(type: string, graph: Graph): Layout | undefined {
    switch (type) {
      case LayoutType.BreadthFirst:
        return new BreadthFirstLayout(graph);
      case LayoutType.Cola:
        return new ColaLayout(graph);
      case LayoutType.ColaNoForce:
        return new ColaLayout(graph, { layoutOnDrag: false });
      case LayoutType.Concentric:
        return new ConcentricLayout(graph);
      case LayoutType.DagreVertical:
        return new DagreGroupsLayout(graph, {
          rankdir: TOP_TO_BOTTOM,
          ranker: 'network-simplex',
          nodesep: 20,
          edgesep: 20,
          ranksep: 0,
        });
      case LayoutType.DagreHorizontal:
        return new DagreGroupsLayout(graph, {
          rankdir: LEFT_TO_RIGHT,
          ranker: 'network-simplex',
          nodesep: 20,
          edgesep: 20,
          ranksep: 0,
        });
      case LayoutType.Force:
        return new ForceLayout(graph);
      case LayoutType.Grid:
        return new GridLayout(graph);
      case LayoutType.ColaGroups:
        return new ColaGroupsLayout(graph, { layoutOnDrag: false });
      default:
        return new ColaLayout(graph, { layoutOnDrag: false });
    }
  }

  static baselineComponentFactory(kind: ModelKind, type: string): ReturnType<ComponentFactory> {
    switch (type) {
      case 'group':
        return CustomGroupWithSelection;
      case 'edge-end':
        return EdgeEndWithButton;
      default:
        switch (kind) {
          case ModelKind.graph:
            return withPanZoom()(GraphComponent);
          case ModelKind.node:
            return CustomNodeWithSelection;
          case ModelKind.edge:
            return DefaultEdge;
          default:
            return undefined;
        }
    }
  }

  static baselineElementFactory(kind: ModelKind): GraphElement | undefined {
    switch (kind) {
      case ModelKind.edge:
        return new NoBendpointsEdge();
      default:
        return undefined;
    }
  }
}
