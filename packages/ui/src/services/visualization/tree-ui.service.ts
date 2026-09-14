import { DocumentTree } from '../../models/datamapper/document-tree';
import { DocumentTreeNode } from '../../models/datamapper/document-tree-node';
import { DocumentNodeData, FieldItemNodeData, TargetFieldNodeData } from '../../models/datamapper/visualization';
import { TreeExpansionState, useDocumentTreeStore } from '../../store/document-tree.store';
import { processTreeNode } from '../../utils';
import { TreeParsingService } from './tree-parsing.service';

/**
 * Manages tree UI state: creation, expansion toggling, and node invalidation.
 *
 * Owns domain-specific logic for expansion state reconciliation across tree rebuilds.
 * The store ({@link useDocumentTreeStore}) is a pure data layer — it provides path-based
 * reconciliation via `updateTreeExpansion` and a direct setter via `setTreeExpansion`,
 * but has no knowledge of field identity or node type transitions.
 *
 * **How expansion is preserved across mapping create/remove transitions:**
 *
 * When a mapping is created on a target field the node transitions from
 * `TargetFieldNodeData` (path segment = `field.id`) to `FieldItemNodeData`
 * (path segment = `mapping.id`), so every descendant's path string changes and
 * all expansion entries would be orphaned.
 *
 * `createTree` resolves this with two cooperating steps:
 *
 * 1. **Prefix migration (Step 1):** Before the new tree replaces the old one, identity
 *    maps are built for both old and new trees, recording bare `TargetFieldNodeData` nodes
 *    (`unmappedByFieldId`) and `FieldItemNodeData` nodes (`mappedByFieldId`) per `field.id`.
 *    1:1 `field.id → mapping.id` transitions (create) and their reverse (remove) are
 *    detected; a segment substitution map is built and applied in-memory via
 *    `applySegmentMigration` — reaching deep entries regardless of depth.
 *    Multi-sibling keys (count > 1 on either side) are skipped and fall back to today's
 *    path-match behavior.
 *
 * 2. **Verbatim carry-over + prune (Step 2):** `reconcileExpansion` seeds `newExpansionState`
 *    from a verbatim copy of the current (already-migrated) store state, preserving deep
 *    entries that are absent from the parse frontier. It then prunes orphaned keys — any key
 *    that is neither equal to, nor a `/`-descendant of, a live content-root path — to prevent
 *    unbounded memory growth across schema swaps. Finally it overlays the frontier walk's
 *    computed values on top.
 *
 * The existing field-identity fallback is retained. With Step 1 covering the
 * `TargetFieldNodeData ↔ FieldItemNodeData` transition it is redundant for that case, but
 * it still guards other rebuild paths (schema/type/choice changes) and should be removed
 * only in a follow-up PR once Step 1 is proven to cover all transition sources.
 */
export class TreeUIService {
  private static readonly trees: Map<string, DocumentTree> = new Map();

  /**
   * Create and register a tree for a document node.
   *
   * When a tree already exists for the same document ID (i.e., a rebuild):
   * 1. Identity maps are built for the old tree (before it is replaced) and the newly parsed tree.
   * 2. 1:1 create/remove transitions are detected and `applySegmentMigration` builds migrated keys.
   * 3. The new tree is stored; `reconcileExpansion` does a verbatim carry-over + prune + frontier
   *    overlay and the result is written via a single `setTreeExpansion` call.
   */
  static createTree(documentNodeData: DocumentNodeData): DocumentTree {
    const id = documentNodeData.id;

    // Step 0: capture the old tree (may be undefined on first build) and build its identity maps
    const oldTree = this.trees.get(id);
    // Read expansionState fresh from the store — do NOT cache store.expansionState via an
    // earlier getState() snapshot: Zustand's set() replaces the expansionState object reference,
    // so a snapshot taken before a prior setTreeExpansion call will have a stale reference.
    const currentExpansion = useDocumentTreeStore.getState().expansionState[id] ?? {};

    const oldMaps = oldTree
      ? TreeUIService.buildIdentityMaps(oldTree)
      : { unmappedByFieldId: new Map(), mappedByFieldId: new Map() };

    // Build and parse the new tree
    const tree = new DocumentTree(documentNodeData);
    TreeParsingService.parseTree(tree);

    // Build identity maps for the new tree. buildIdentityMaps parses mapping-bearing nodes
    // on-demand while walking, so it can see FieldItemNodeData nodes that a mapping just
    // materialised behind the default parse frontier.
    const newMaps = TreeUIService.buildIdentityMaps(tree);

    // Step 1: build segment-level substitution table for all 1:1 create/remove transitions.
    //
    // When getOrCreateFieldItem materialises a mapping it creates FieldItems for the ENTIRE
    // ancestor chain (DeepOrder → Customer → Address → …) in one go, so multiple levels
    // transition simultaneously.  We build a segment-level substitution table —
    // oldPathSegment → newPathSegment for every transitioning node — and apply it in-memory
    // to currentExpansion before reconcileExpansion runs.  This way the migration and the
    // final setTreeExpansion happen in a single store.set() call, so React never sees the
    // intermediate half-migrated state that caused the visual collapse on the first mapping.
    const segmentMap = new Map<string, string>(); // oldSegment → newSegment

    // Create: unmapped (old, count=1) → mapped (new, count=1)
    for (const [fieldId, oldEntry] of oldMaps.unmappedByFieldId) {
      if (oldEntry.count !== 1) continue;
      const newEntry = newMaps.mappedByFieldId.get(fieldId);
      if (newEntry?.count !== 1) continue;
      // Extract the last path segment (the field/mapping id) from each path
      const oldSeg = oldEntry.path.split('/').pop()!;
      const newSeg = newEntry.path.split('/').pop()!;
      segmentMap.set(oldSeg, newSeg);
    }
    // Remove: mapped (old, count=1) → unmapped (new, count=1)
    for (const [fieldId, oldEntry] of oldMaps.mappedByFieldId) {
      if (oldEntry.count !== 1) continue;
      const newEntry = newMaps.unmappedByFieldId.get(fieldId);
      if (newEntry?.count !== 1) continue;
      const oldSeg = oldEntry.path.split('/').pop()!;
      const newSeg = newEntry.path.split('/').pop()!;
      segmentMap.set(oldSeg, newSeg);
    }

    // Apply segment migration purely in-memory so reconcileExpansion already sees
    // migrated keys.  No store write here — setTreeExpansion below is the single write.
    const migratedExpansion =
      segmentMap.size > 0 ? TreeUIService.applySegmentMigration(currentExpansion, segmentMap) : currentExpansion;

    this.trees.set(id, tree);

    // Step 2: verbatim carry-over + prune + frontier overlay
    const fieldExpansion = TreeUIService.buildFieldExpansionMap(currentExpansion, oldTree);
    const newExpansion = TreeUIService.reconcileExpansion(tree, migratedExpansion, fieldExpansion);
    // Single atomic store write — React never sees a half-migrated intermediate state.
    useDocumentTreeStore.getState().setTreeExpansion(tree.documentNodeDataId, newExpansion);

    // Step 3: re-parse any nodes that are expanded in the store but were not reached by
    // the initial parseTree frontier walk. Without this, flatten() skips their children
    // (children.length === 0) even though the store says they are expanded.
    TreeUIService.reparsExpandedNodes(tree, newExpansion);

    return tree;
  }

  static getTree(documentNodeDataId: string): DocumentTree | undefined {
    return this.trees.get(documentNodeDataId);
  }

  /**
   * Toggle node expansion and update store
   */
  static toggleNode(documentId: string, nodePath: string): void {
    const tree = this.trees.get(documentId);
    if (!tree) return;

    const node = tree.findNodeByPath(nodePath);
    if (!node) return;

    const store = useDocumentTreeStore.getState();

    if (!node.isParsed) {
      TreeParsingService.parseTreeNode(node);
    }

    store.toggleExpansion(documentId, nodePath);
  }

  /**
   * Re-parse any tree nodes that are marked as expanded in the store but were not reached
   * by the initial parseTree frontier walk (their children array is empty).
   * This ensures flatten() can actually show their children after a rebuild.
   * Only processes nodes that are both expanded (store=true) and unparsed (isParsed=false).
   */
  private static reparsExpandedNodes(tree: DocumentTree, expansionState: TreeExpansionState): void {
    const reparse = (node: DocumentTreeNode): void => {
      if (!node.isParsed && expansionState[node.path] === true) {
        TreeParsingService.parseTreeNode(node);
      }
      for (const child of node.children) {
        reparse(child);
      }
    };
    for (const contentRoot of tree.contentRoots) {
      reparse(contentRoot);
    }
  }

  /**
   * Invalidate a tree node and all its descendants.
   * Used when a type override or choice selection changes the field structure.
   * The node will be re-parsed on next expansion.
   *
   * @param documentId - The document ID containing the node
   * @param nodePath - The path of the node to invalidate
   */
  static invalidateNode(documentId: string, nodePath: string): void {
    const tree = this.trees.get(documentId);
    if (!tree) return;

    const node = tree.findNodeByPath(nodePath);
    if (!node) return;

    node.invalidateDescendants();
  }

  /**
   * Verbatim carry-over + prune + frontier overlay reconciliation.
   *
   * @param newTree - The freshly built tree.
   * @param migratedExpansion - The already segment-migrated expansion snapshot. Entries that
   *   are absent from the parse frontier are preserved verbatim (Step 1); orphaned keys are
   *   then pruned (Step 2); finally the frontier walk overlays computed values (Step 3).
   * @param fieldExpansion - Optional field-id → boolean fallback for nodes whose path changed
   *   in a way not covered by segment migration (e.g. schema/choice/type swaps).
   */
  private static reconcileExpansion(
    newTree: DocumentTree,
    migratedExpansion: TreeExpansionState,
    fieldExpansion?: Record<string, boolean>,
  ): TreeExpansionState {
    const currentExpansionState = migratedExpansion;

    // Step 2a: verbatim carry-over (no isParsed gate)
    const newExpansionState: TreeExpansionState = { ...currentExpansionState };

    // Step 2b: prune — keep only keys that are equal to or a /-descendant of a live content-root path
    const liveRootPaths = newTree.contentRoots.map((r) => r.path);
    for (const key of Object.keys(newExpansionState)) {
      const isLive = liveRootPaths.some((rootPath) => key === rootPath || key.startsWith(rootPath + '/'));
      if (!isLive) {
        delete newExpansionState[key];
      }
    }

    // Step 2c: overlay frontier walk
    // Only write a value when isParsed=true OR the key is not already carried over (new node).
    // An isParsed=false node that already has a stored value must be left alone — the verbatim
    // carry-over (Step 2a) already holds the correct value; overwriting with `false && savedState`
    // would collapse deep nodes that the user previously expanded but that are behind the parse frontier.
    for (const contentRoot of newTree.contentRoots) {
      processTreeNode(contentRoot, (treeNode) => {
        const isNodeParsed = treeNode.isParsed;
        // If not parsed and already carried over verbatim, skip — do not clobber.
        if (!isNodeParsed && treeNode.path in newExpansionState) {
          return;
        }
        let savedState = currentExpansionState[treeNode.path];
        if (savedState === undefined && fieldExpansion && 'field' in treeNode.nodeData) {
          savedState = fieldExpansion[(treeNode.nodeData as { field: { id: string } }).field.id];
        }
        newExpansionState[treeNode.path] = isNodeParsed && (savedState ?? true);
      });
    }

    return newExpansionState;
  }

  /**
   * Apply a segment-level substitution map to an expansion state in-memory: for each key,
   * every `/`-delimited segment present in `segmentMap` is replaced with its mapped value.
   * Operates on a plain object without touching the Zustand store, so `createTree` can
   * collapse the segment migration and the final `setTreeExpansion` into a single store
   * write — preventing React from seeing an intermediate half-migrated state.
   */
  private static applySegmentMigration(
    expansion: TreeExpansionState,
    segmentMap: Map<string, string>,
  ): TreeExpansionState {
    const result: TreeExpansionState = {};
    for (const [key, value] of Object.entries(expansion)) {
      const newKey = key
        .split('/')
        .map((seg) => segmentMap.get(seg) ?? seg)
        .join('/');
      result[newKey] = value;
    }
    return result;
  }

  /**
   * Build a field-id → expansion-boolean fallback map from the old tree.
   * Used by `reconcileExpansion` as a fallback when no direct path match exists.
   * First-writer-wins per field.id (identical to the original implementation).
   *
   * NOTE: this intentionally takes the PRE-migration `currentExpansionState` (old paths),
   * not the segment-migrated snapshot — it walks the OLD tree, whose node paths are still the
   * old ones, and maps each old path's stored boolean onto its field.id. Passing the migrated
   * snapshot here would mismatch the old paths and produce an empty/incorrect fallback.
   */
  private static buildFieldExpansionMap(
    currentExpansionState: Record<string, boolean>,
    oldTree?: DocumentTree,
  ): Record<string, boolean> | undefined {
    if (!oldTree) return undefined;
    if (!currentExpansionState || Object.keys(currentExpansionState).length === 0) return undefined;

    const fieldExpansion: Record<string, boolean> = {};
    for (const contentRoot of oldTree.contentRoots) {
      processTreeNode(contentRoot, (treeNode) => {
        if ('field' in treeNode.nodeData) {
          const fieldId = (treeNode.nodeData as { field: { id: string } }).field.id;
          const state = currentExpansionState[treeNode.path];
          if (state !== undefined && !(fieldId in fieldExpansion)) {
            fieldExpansion[fieldId] = state;
          }
        }
      });
    }
    return Object.keys(fieldExpansion).length > 0 ? fieldExpansion : undefined;
  }

  /**
   * Build identity maps for transition detection (Option B).
   *
   * Records:
   * - `unmappedByFieldId`: bare `TargetFieldNodeData` nodes with no mapping (the unmapped placeholder).
   * - `mappedByFieldId`: `FieldItemNodeData` nodes (mapped field items).
   *
   * Counts per `field.id` to support the 1:1 guard: a key with count > 1 is ineligible
   * for prefix migration (collection with multiple mappings / add-mapping placeholder present).
   *
   * NOTE: walks with NO depth/field limit so that nodes behind the default parse frontier
   * (e.g. a transitioning field that is itself beyond the 100-node budget) are still detected
   * and their prefix can be migrated correctly.
   */
  private static buildIdentityMaps(tree: DocumentTree): {
    unmappedByFieldId: Map<string, { path: string; count: number }>;
    mappedByFieldId: Map<string, { path: string; count: number }>;
  } {
    const unmappedByFieldId = new Map<string, { path: string; count: number }>();
    const mappedByFieldId = new Map<string, { path: string; count: number }>();

    // Walk the tree, recording transitions. A mapping created on a deep field materialises a
    // FieldItem chain (e.g. Customer → Address → Geo → Coordinates → Lng) all at once, but
    // parseTree only parses down to the frontier, so the deep FieldItem nodes are still unparsed
    // here. We must therefore parse on-demand while descending — otherwise the deep transitions
    // are invisible to this walk and their expansion keys get dropped.
    //
    // To keep this bounded (not a full-tree materialisation of huge schemas) we only force-parse
    // a node when it actually carries a mapping — i.e. it is a FieldItemNodeData, or a
    // TargetFieldNodeData whose `mapping` is set. Such a node's children can contain further
    // materialised FieldItems (the rest of the chain). An unmapped node below the frontier cannot
    // have a mapped descendant, so there is nothing to migrate underneath it and we leave it
    // unparsed. processTreeNode is not used here because it cannot force parsing behind the frontier.
    const visit = (node: DocumentTreeNode): void => {
      const nd = node.nodeData;
      const isMapped = nd instanceof FieldItemNodeData;
      if (isMapped) {
        const entry = mappedByFieldId.get(nd.field.id);
        if (entry) entry.count++;
        else mappedByFieldId.set(nd.field.id, { path: node.path, count: 1 });
      } else if (nd instanceof TargetFieldNodeData && !nd.mapping) {
        const entry = unmappedByFieldId.get(nd.field.id);
        if (entry) entry.count++;
        else unmappedByFieldId.set(nd.field.id, { path: node.path, count: 1 });
      }
      const carriesMapping = isMapped || (nd instanceof TargetFieldNodeData && !!nd.mapping);
      if (carriesMapping && !node.isParsed) {
        TreeParsingService.parseTreeNode(node);
      }
      for (const child of node.children) {
        visit(child);
      }
    };
    for (const contentRoot of tree.contentRoots) {
      visit(contentRoot);
    }

    return { unmappedByFieldId, mappedByFieldId };
  }
}
