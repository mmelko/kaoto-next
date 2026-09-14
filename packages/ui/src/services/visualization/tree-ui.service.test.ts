import {
  BODY_DOCUMENT_ID,
  DocumentDefinition,
  DocumentDefinitionType,
  DocumentType,
  PrimitiveDocument,
} from '../../models/datamapper/document';
import { DocumentTree } from '../../models/datamapper/document-tree';
import { MappingTree } from '../../models/datamapper/mapping';
import {
  DocumentNodeData,
  FieldItemNodeData,
  TargetDocumentNodeData,
  TargetFieldNodeData,
} from '../../models/datamapper/visualization';
import { MappingService } from '../../services/mapping/mapping.service';
import { useDocumentTreeStore } from '../../store/document-tree.store';
import { TestUtil } from '../../stubs/datamapper/data-mapper';
import { XmlSchemaDocument } from '../document/xml-schema/xml-schema-document.model';
import { XmlSchemaDocumentService } from '../document/xml-schema/xml-schema-document.service';
import { MappingActionService } from './mapping-action.service';
import { TreeParsingService } from './tree-parsing.service';
import { TreeUIService } from './tree-ui.service';

/**
 * Inline synthetic XSD for the wide+deep regression (§6.2 of the spec).
 *
 * Shape: WideDeep → wide_01..wide_10 (×10 siblings to burn budget) +
 *        deep_chain (→ L2 → L3 → L4 → L5leaf).
 * With INITIAL_FIELD_COUNTS=100 the budget is consumed by the wide siblings
 * before the parse frontier reaches L3/L4/L5, so those nodes sit below the
 * frontier and only exist as store keys when the user has explicitly expanded them.
 */
const WIDE_DEEP_XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="WideDeep">
    <xs:complexType><xs:sequence>
      <xs:element name="wide_01"><xs:complexType><xs:sequence>
        <xs:element name="w01_c01" type="xs:string" minOccurs="0"/>
        <xs:element name="w01_c02" type="xs:string" minOccurs="0"/>
        <xs:element name="w01_c03" type="xs:string" minOccurs="0"/>
        <xs:element name="w01_c04" type="xs:string" minOccurs="0"/>
        <xs:element name="w01_c05" type="xs:string" minOccurs="0"/>
        <xs:element name="w01_c06" type="xs:string" minOccurs="0"/>
        <xs:element name="w01_c07" type="xs:string" minOccurs="0"/>
        <xs:element name="w01_c08" type="xs:string" minOccurs="0"/>
        <xs:element name="w01_c09" type="xs:string" minOccurs="0"/>
        <xs:element name="w01_c10" type="xs:string" minOccurs="0"/>
      </xs:sequence></xs:complexType></xs:element>
      <xs:element name="wide_02"><xs:complexType><xs:sequence>
        <xs:element name="w02_c01" type="xs:string" minOccurs="0"/>
        <xs:element name="w02_c02" type="xs:string" minOccurs="0"/>
        <xs:element name="w02_c03" type="xs:string" minOccurs="0"/>
        <xs:element name="w02_c04" type="xs:string" minOccurs="0"/>
        <xs:element name="w02_c05" type="xs:string" minOccurs="0"/>
        <xs:element name="w02_c06" type="xs:string" minOccurs="0"/>
        <xs:element name="w02_c07" type="xs:string" minOccurs="0"/>
        <xs:element name="w02_c08" type="xs:string" minOccurs="0"/>
        <xs:element name="w02_c09" type="xs:string" minOccurs="0"/>
        <xs:element name="w02_c10" type="xs:string" minOccurs="0"/>
      </xs:sequence></xs:complexType></xs:element>
      <xs:element name="wide_03"><xs:complexType><xs:sequence>
        <xs:element name="w03_c01" type="xs:string" minOccurs="0"/>
        <xs:element name="w03_c02" type="xs:string" minOccurs="0"/>
        <xs:element name="w03_c03" type="xs:string" minOccurs="0"/>
        <xs:element name="w03_c04" type="xs:string" minOccurs="0"/>
        <xs:element name="w03_c05" type="xs:string" minOccurs="0"/>
        <xs:element name="w03_c06" type="xs:string" minOccurs="0"/>
        <xs:element name="w03_c07" type="xs:string" minOccurs="0"/>
        <xs:element name="w03_c08" type="xs:string" minOccurs="0"/>
        <xs:element name="w03_c09" type="xs:string" minOccurs="0"/>
        <xs:element name="w03_c10" type="xs:string" minOccurs="0"/>
      </xs:sequence></xs:complexType></xs:element>
      <xs:element name="wide_04"><xs:complexType><xs:sequence>
        <xs:element name="w04_c01" type="xs:string" minOccurs="0"/>
        <xs:element name="w04_c02" type="xs:string" minOccurs="0"/>
        <xs:element name="w04_c03" type="xs:string" minOccurs="0"/>
        <xs:element name="w04_c04" type="xs:string" minOccurs="0"/>
        <xs:element name="w04_c05" type="xs:string" minOccurs="0"/>
        <xs:element name="w04_c06" type="xs:string" minOccurs="0"/>
        <xs:element name="w04_c07" type="xs:string" minOccurs="0"/>
        <xs:element name="w04_c08" type="xs:string" minOccurs="0"/>
        <xs:element name="w04_c09" type="xs:string" minOccurs="0"/>
        <xs:element name="w04_c10" type="xs:string" minOccurs="0"/>
      </xs:sequence></xs:complexType></xs:element>
      <xs:element name="wide_05"><xs:complexType><xs:sequence>
        <xs:element name="w05_c01" type="xs:string" minOccurs="0"/>
        <xs:element name="w05_c02" type="xs:string" minOccurs="0"/>
        <xs:element name="w05_c03" type="xs:string" minOccurs="0"/>
        <xs:element name="w05_c04" type="xs:string" minOccurs="0"/>
        <xs:element name="w05_c05" type="xs:string" minOccurs="0"/>
        <xs:element name="w05_c06" type="xs:string" minOccurs="0"/>
        <xs:element name="w05_c07" type="xs:string" minOccurs="0"/>
        <xs:element name="w05_c08" type="xs:string" minOccurs="0"/>
        <xs:element name="w05_c09" type="xs:string" minOccurs="0"/>
        <xs:element name="w05_c10" type="xs:string" minOccurs="0"/>
      </xs:sequence></xs:complexType></xs:element>
      <xs:element name="wide_06"><xs:complexType><xs:sequence>
        <xs:element name="w06_c01" type="xs:string" minOccurs="0"/>
        <xs:element name="w06_c02" type="xs:string" minOccurs="0"/>
        <xs:element name="w06_c03" type="xs:string" minOccurs="0"/>
        <xs:element name="w06_c04" type="xs:string" minOccurs="0"/>
        <xs:element name="w06_c05" type="xs:string" minOccurs="0"/>
        <xs:element name="w06_c06" type="xs:string" minOccurs="0"/>
        <xs:element name="w06_c07" type="xs:string" minOccurs="0"/>
        <xs:element name="w06_c08" type="xs:string" minOccurs="0"/>
        <xs:element name="w06_c09" type="xs:string" minOccurs="0"/>
        <xs:element name="w06_c10" type="xs:string" minOccurs="0"/>
      </xs:sequence></xs:complexType></xs:element>
      <xs:element name="wide_07"><xs:complexType><xs:sequence>
        <xs:element name="w07_c01" type="xs:string" minOccurs="0"/>
        <xs:element name="w07_c02" type="xs:string" minOccurs="0"/>
        <xs:element name="w07_c03" type="xs:string" minOccurs="0"/>
        <xs:element name="w07_c04" type="xs:string" minOccurs="0"/>
        <xs:element name="w07_c05" type="xs:string" minOccurs="0"/>
        <xs:element name="w07_c06" type="xs:string" minOccurs="0"/>
        <xs:element name="w07_c07" type="xs:string" minOccurs="0"/>
        <xs:element name="w07_c08" type="xs:string" minOccurs="0"/>
        <xs:element name="w07_c09" type="xs:string" minOccurs="0"/>
        <xs:element name="w07_c10" type="xs:string" minOccurs="0"/>
      </xs:sequence></xs:complexType></xs:element>
      <xs:element name="wide_08"><xs:complexType><xs:sequence>
        <xs:element name="w08_c01" type="xs:string" minOccurs="0"/>
        <xs:element name="w08_c02" type="xs:string" minOccurs="0"/>
        <xs:element name="w08_c03" type="xs:string" minOccurs="0"/>
        <xs:element name="w08_c04" type="xs:string" minOccurs="0"/>
        <xs:element name="w08_c05" type="xs:string" minOccurs="0"/>
        <xs:element name="w08_c06" type="xs:string" minOccurs="0"/>
        <xs:element name="w08_c07" type="xs:string" minOccurs="0"/>
        <xs:element name="w08_c08" type="xs:string" minOccurs="0"/>
        <xs:element name="w08_c09" type="xs:string" minOccurs="0"/>
        <xs:element name="w08_c10" type="xs:string" minOccurs="0"/>
      </xs:sequence></xs:complexType></xs:element>
      <xs:element name="wide_09"><xs:complexType><xs:sequence>
        <xs:element name="w09_c01" type="xs:string" minOccurs="0"/>
        <xs:element name="w09_c02" type="xs:string" minOccurs="0"/>
        <xs:element name="w09_c03" type="xs:string" minOccurs="0"/>
        <xs:element name="w09_c04" type="xs:string" minOccurs="0"/>
        <xs:element name="w09_c05" type="xs:string" minOccurs="0"/>
        <xs:element name="w09_c06" type="xs:string" minOccurs="0"/>
        <xs:element name="w09_c07" type="xs:string" minOccurs="0"/>
        <xs:element name="w09_c08" type="xs:string" minOccurs="0"/>
        <xs:element name="w09_c09" type="xs:string" minOccurs="0"/>
        <xs:element name="w09_c10" type="xs:string" minOccurs="0"/>
      </xs:sequence></xs:complexType></xs:element>
      <xs:element name="deep_chain">
        <xs:complexType><xs:sequence>
          <xs:element name="L2">
            <xs:complexType><xs:sequence>
              <xs:element name="L3">
                <xs:complexType><xs:sequence>
                  <xs:element name="L4">
                    <xs:complexType><xs:sequence>
                      <xs:element name="L5leaf" type="xs:string" minOccurs="0"/>
                    </xs:sequence></xs:complexType>
                  </xs:element>
                </xs:sequence></xs:complexType>
              </xs:element>
            </xs:sequence></xs:complexType>
          </xs:element>
        </xs:sequence></xs:complexType>
      </xs:element>
    </xs:sequence></xs:complexType>
  </xs:element>
</xs:schema>`;

/** Create a wide+deep target document from the inline XSD above. */
function createWideDeepTargetDoc() {
  const definition = new DocumentDefinition(
    DocumentType.TARGET_BODY,
    DocumentDefinitionType.XML_SCHEMA,
    BODY_DOCUMENT_ID,
    { 'wide-deep.xsd': WIDE_DEEP_XSD },
  );
  const result = XmlSchemaDocumentService.createXmlSchemaDocument(definition);
  if (result.validationStatus !== 'success' || !result.document) {
    throw new Error(result.errors?.map((e) => e.message).join('; ') || 'Failed to create wide+deep doc');
  }
  return result.document;
}

describe('TreeUIService', () => {
  let sourceDoc: XmlSchemaDocument;
  let sourceDocNode: DocumentNodeData;

  beforeEach(() => {
    sourceDoc = TestUtil.createSourceOrderDoc();
    sourceDocNode = new DocumentNodeData(sourceDoc);

    useDocumentTreeStore.setState({ expansionState: {} });
  });

  describe('createTree', () => {
    it('should create a DocumentTree with the given DocumentNodeData', () => {
      const tree = TreeUIService.createTree(sourceDocNode);

      expect(tree).toBeInstanceOf(DocumentTree);
      expect(tree.root.nodeData).toBe(sourceDocNode);
    });

    it('should parse the tree to INITIAL_PARSE_DEPTH', () => {
      const tree = TreeUIService.createTree(sourceDocNode);

      expect(tree.root.isParsed).toBe(true);
      expect(tree.root.children.length).toBeGreaterThan(0);

      const hasChildrenParsed = tree.root.children.some((child) => child.isParsed);
      expect(hasChildrenParsed).toBe(true);
    });

    it('should set initial expansion state in the store', () => {
      const tree = TreeUIService.createTree(sourceDocNode);

      const store = useDocumentTreeStore.getState();
      const documentId = sourceDocNode.id;
      const expansionState = store.expansionState[documentId];

      expect(expansionState).toBeDefined();
      expect(expansionState[tree.contentRoots[0].path]).toBe(true);
    });

    it('should initialize expansion state for all nodes up to INITIAL_PARSE_DEPTH', () => {
      const tree = TreeUIService.createTree(sourceDocNode);

      const store = useDocumentTreeStore.getState();
      const documentId = sourceDocNode.id;
      const expansionState = store.expansionState[documentId];

      const expandedNodeCount = Object.keys(expansionState).length;
      expect(expandedNodeCount).toBeGreaterThan(1); // At least content root and some children

      expect(store.isExpanded(documentId, tree.contentRoots[0].path)).toBe(true);
    });

    it('should store the tree internally and make it accessible via toggleNode', () => {
      const tree = TreeUIService.createTree(sourceDocNode);

      // This is an indirect test - we'll verify the tree is stored by using toggleNode
      const documentId = sourceDocNode.id;
      const firstChildPath = tree.root.children[0]?.path;

      expect(() => {
        TreeUIService.toggleNode(documentId, firstChildPath);
      }).not.toThrow();
    });

    it('should create tree for primitive document', () => {
      const primitiveDoc = new PrimitiveDocument(
        new DocumentDefinition(DocumentType.SOURCE_BODY, DocumentDefinitionType.Primitive, BODY_DOCUMENT_ID),
      );
      const primitiveDocNode = new DocumentNodeData(primitiveDoc);

      const tree = TreeUIService.createTree(primitiveDocNode);

      expect(tree).toBeInstanceOf(DocumentTree);
      expect(tree.root.isParsed).toBe(false);
      expect(tree.root.children).toHaveLength(0);
    });

    it('should create separate trees for different documents', () => {
      const sourceDocNode1 = new DocumentNodeData(sourceDoc);
      const targetDoc = TestUtil.createTargetOrderDoc();
      const targetDocNode = new DocumentNodeData(targetDoc);

      const tree1 = TreeUIService.createTree(sourceDocNode1);
      const tree2 = TreeUIService.createTree(targetDocNode);

      expect(tree1).not.toBe(tree2);
      expect(tree1.root.nodeData.id).not.toBe(tree2.root.nodeData.id);

      // Verify both have separate expansion states
      const store = useDocumentTreeStore.getState();
      expect(store.expansionState[sourceDocNode1.id]).toBeDefined();
      expect(store.expansionState[targetDocNode.id]).toBeDefined();
    });

    it('should replace existing tree if called with same document ID', () => {
      const tree1 = TreeUIService.createTree(sourceDocNode);
      const tree2 = TreeUIService.createTree(sourceDocNode);

      expect(tree1).not.toBe(tree2);
      expect(tree1).toBeInstanceOf(DocumentTree);
      expect(tree2).toBeInstanceOf(DocumentTree);

      const store = useDocumentTreeStore.getState();
      const documentId = sourceDocNode.id;
      expect(store.expansionState[documentId]).toBeDefined();
    });
  });

  describe('getTree', () => {
    it('should return undefined when no tree exists for the given ID', () => {
      expect(TreeUIService.getTree('non-existent-id')).toBeUndefined();
    });

    it('should return the cached tree after createTree()', () => {
      TreeUIService.createTree(sourceDocNode);

      const retrieved = TreeUIService.getTree(sourceDocNode.id);

      expect(retrieved).toBeInstanceOf(DocumentTree);
      expect(retrieved!.root.nodeData).toBe(sourceDocNode);
    });

    it('should return different trees for different document IDs', () => {
      TreeUIService.createTree(sourceDocNode);

      const targetDoc = TestUtil.createTargetOrderDoc();
      const targetDocNode = new DocumentNodeData(targetDoc);
      TreeUIService.createTree(targetDocNode);

      const sourceTree = TreeUIService.getTree(sourceDocNode.id);
      const targetTree = TreeUIService.getTree(targetDocNode.id);

      expect(sourceTree).not.toBe(targetTree);
      expect(sourceTree!.root.nodeData.id).not.toBe(targetTree!.root.nodeData.id);
    });
  });

  describe('toggleNode', () => {
    let tree: DocumentTree;
    let documentId: string;

    beforeEach(() => {
      tree = TreeUIService.createTree(sourceDocNode);
      documentId = sourceDocNode.id;
    });

    it('should toggle expansion state of a node in the store', () => {
      const store = useDocumentTreeStore.getState();
      const nodePath = tree.root.path;

      const initialState = store.isExpanded(documentId, nodePath);
      TreeUIService.toggleNode(documentId, nodePath);
      const newState = store.isExpanded(documentId, nodePath);

      expect(newState).toBe(!initialState);
    });

    it('should parse unparsed node before toggling', () => {
      const parseTreeNodeSpy = vi.spyOn(TreeParsingService, 'parseTreeNode');

      // Find an unparsed node by navigating the tree
      // Level 1 nodes are parsed (depth 1 < 3)
      const level1Node = tree.root.children[0];
      expect(level1Node).toBeDefined();
      expect(level1Node.isParsed).toBe(true);

      // Find a level 1 node that has children to ensure we can go deeper
      const level1WithChildren = tree.root.children.find((node) => node.isParsed && node.children.length > 0);
      expect(level1WithChildren).toBeDefined();

      // Level 2: Find a parsed node with children
      const level2WithChildren = level1WithChildren!.children.find((node) => node.isParsed && node.children.length > 0);
      expect(level2WithChildren).toBeDefined();

      // Level 3: This node should NOT be parsed (depth 3 >= 3)
      const level3Node = level2WithChildren!.children[0];
      expect(level3Node).toBeDefined();
      expect(level3Node.isParsed).toBe(false);
      expect(level3Node.children).toHaveLength(0);

      // Toggle the unparsed node - this should trigger parsing
      TreeUIService.toggleNode(documentId, level3Node.path);

      // Verify parseTreeNode was called with the unparsed node
      expect(parseTreeNodeSpy).toHaveBeenCalledWith(level3Node);

      parseTreeNodeSpy.mockRestore();
    });

    it('should not re-parse already parsed nodes', () => {
      // Get first child which is already parsed (depth 1)
      const firstChild = tree.root.children[0];
      expect(firstChild).toBeDefined();
      expect(firstChild.isParsed).toBe(true);

      const childrenCountBefore = firstChild.children.length;
      expect(childrenCountBefore).toBeGreaterThan(0);

      // Toggle the already-parsed node
      TreeUIService.toggleNode(documentId, firstChild.path);

      // Children count should not change (no re-parsing happens)
      expect(firstChild.children).toHaveLength(childrenCountBefore);
    });

    it('should do nothing if document ID is not found', () => {
      const store = useDocumentTreeStore.getState();
      const nonExistentId = 'non-existent-id';
      const initialExpansionState = { ...store.expansionState };

      TreeUIService.toggleNode(nonExistentId, tree.root.path);

      expect(store.expansionState).toEqual(initialExpansionState);
      expect(store.expansionState[nonExistentId]).toBeUndefined();
    });

    it('should do nothing if node path is not found', () => {
      const store = useDocumentTreeStore.getState();
      const nonExistentPath = 'sourceBody:nonexistent://path';
      const initialExpansionState = { ...store.expansionState[documentId] };

      TreeUIService.toggleNode(documentId, nonExistentPath);

      expect(store.expansionState[documentId]).toEqual(initialExpansionState);
      expect(store.isExpanded(documentId, nonExistentPath)).toBe(false);
    });

    it('should toggle node multiple times correctly', () => {
      const store = useDocumentTreeStore.getState();
      const nodePath = tree.root.path;

      const initialState = store.isExpanded(documentId, nodePath);

      TreeUIService.toggleNode(documentId, nodePath);
      expect(store.isExpanded(documentId, nodePath)).toBe(!initialState);

      TreeUIService.toggleNode(documentId, nodePath);
      expect(store.isExpanded(documentId, nodePath)).toBe(initialState);

      TreeUIService.toggleNode(documentId, nodePath);
      expect(store.isExpanded(documentId, nodePath)).toBe(!initialState);
    });

    it('should handle toggling child nodes', () => {
      const store = useDocumentTreeStore.getState();
      const firstChild = tree.root.children[0];

      // Tree always has children based on our test fixture
      expect(firstChild).toBeDefined();

      const initialState = store.isExpanded(documentId, firstChild.path);

      TreeUIService.toggleNode(documentId, firstChild.path);
      const newState = store.isExpanded(documentId, firstChild.path);

      expect(newState).toBe(!initialState);
    });

    it('should handle deeply nested nodes', () => {
      // Navigate to a node at depth 2 (two levels down from root)
      const level1Node = tree.root.children[0];
      expect(level1Node).toBeDefined();

      const level2Node = level1Node.children[0];
      expect(level2Node).toBeDefined();

      const store = useDocumentTreeStore.getState();
      const initialState = store.isExpanded(documentId, level2Node.path);

      TreeUIService.toggleNode(documentId, level2Node.path);

      expect(store.isExpanded(documentId, level2Node.path)).toBe(!initialState);
    });
  });

  it('should create tree and toggle nodes in sequence', () => {
    const tree = TreeUIService.createTree(sourceDocNode);
    const documentId = sourceDocNode.id;
    const store = useDocumentTreeStore.getState();

    // Initial state: first content root should be expanded
    const firstContentRoot = tree.contentRoots[0];
    expect(store.isExpanded(documentId, firstContentRoot.path)).toBe(true);

    // Toggle content root
    TreeUIService.toggleNode(documentId, firstContentRoot.path);
    expect(store.isExpanded(documentId, firstContentRoot.path)).toBe(false);

    // Toggle content root again
    TreeUIService.toggleNode(documentId, firstContentRoot.path);
    expect(store.isExpanded(documentId, firstContentRoot.path)).toBe(true);

    // Toggle a child - we know content root has children from our fixture
    expect(firstContentRoot.children.length).toBeGreaterThan(0);
    const firstChildPath = firstContentRoot.children[0].path;
    const initialChildState = store.isExpanded(documentId, firstChildPath);

    TreeUIService.toggleNode(documentId, firstChildPath);
    expect(store.isExpanded(documentId, firstChildPath)).toBe(!initialChildState);
  });

  it('should maintain separate state for multiple documents', () => {
    const sourceTree = TreeUIService.createTree(sourceDocNode);
    const targetDoc = TestUtil.createTargetOrderDoc();
    const targetDocNode = new DocumentNodeData(targetDoc);
    const targetTree = TreeUIService.createTree(targetDocNode);

    const sourceDocId = sourceDocNode.id;
    const targetDocId = targetDocNode.id;
    const store = useDocumentTreeStore.getState();

    // Both content roots should be expanded initially
    const sourceContentRoot = sourceTree.contentRoots[0];
    const targetContentRoot = targetTree.contentRoots[0];
    expect(store.isExpanded(sourceDocId, sourceContentRoot.path)).toBe(true);
    expect(store.isExpanded(targetDocId, targetContentRoot.path)).toBe(true);

    // Toggle source content root
    TreeUIService.toggleNode(sourceDocId, sourceContentRoot.path);
    expect(store.isExpanded(sourceDocId, sourceContentRoot.path)).toBe(false);
    expect(store.isExpanded(targetDocId, targetContentRoot.path)).toBe(true);

    // Toggle target content root
    TreeUIService.toggleNode(targetDocId, targetContentRoot.path);
    expect(store.isExpanded(sourceDocId, sourceContentRoot.path)).toBe(false);
    expect(store.isExpanded(targetDocId, targetContentRoot.path)).toBe(false);
  });

  it('should handle creating tree, toggling, and verifying expansion state', () => {
    expect.assertions(5);
    TreeUIService.createTree(sourceDocNode);
    const documentId = sourceDocNode.id;
    const store = useDocumentTreeStore.getState();

    // Get initial expansion state
    const initialExpansionState = { ...store.expansionState[documentId] };

    const initialKeys = Object.keys(initialExpansionState);
    expect(initialKeys).toHaveLength(13);

    const expandedPaths = Object.entries(initialExpansionState).reduce((acc, [path, isExpanded]) => {
      if (isExpanded) acc.push(path);
      return acc;
    }, [] as string[]);
    expect(expandedPaths).toHaveLength(3);

    // Toggle all initially expanded nodes
    for (const nodePath of expandedPaths) {
      TreeUIService.toggleNode(documentId, nodePath);
    }

    // All initially expanded nodes should now be collapsed
    for (const nodePath of expandedPaths) {
      expect(store.isExpanded(documentId, nodePath)).toBe(false);
    }
  });

  it('should work with both XML source and target documents', () => {
    const sourceTree = TreeUIService.createTree(sourceDocNode);
    const targetDoc = TestUtil.createTargetOrderDoc();
    const targetDocNode = new DocumentNodeData(targetDoc);
    const targetTree = TreeUIService.createTree(targetDocNode);

    expect(sourceTree.root.isParsed).toBe(true);
    expect(targetTree.root.isParsed).toBe(true);
    expect(sourceTree.root.children.length).toBeGreaterThan(0);
    expect(targetTree.root.children.length).toBeGreaterThan(0);

    const store = useDocumentTreeStore.getState();
    expect(store.expansionState[sourceDocNode.id]).toBeDefined();
    expect(store.expansionState[targetDocNode.id]).toBeDefined();
  });

  describe('edge cases', () => {
    it('should handle toggling root node', () => {
      const tree = TreeUIService.createTree(sourceDocNode);
      const documentId = sourceDocNode.id;
      const store = useDocumentTreeStore.getState();

      const rootPath = tree.root.path;
      const initialState = store.isExpanded(documentId, rootPath);

      TreeUIService.toggleNode(documentId, rootPath);

      expect(store.isExpanded(documentId, rootPath)).toBe(!initialState);
    });

    it('should handle empty document ID', () => {
      const store = useDocumentTreeStore.getState();
      const initialExpansionState = { ...store.expansionState };

      TreeUIService.toggleNode('', 'some-path');

      // Expansion state should remain unchanged
      expect(store.expansionState).toEqual(initialExpansionState);
    });

    it('should handle empty node path', () => {
      TreeUIService.createTree(sourceDocNode);
      const documentId = sourceDocNode.id;
      const store = useDocumentTreeStore.getState();
      const initialExpansionState = { ...store.expansionState[documentId] };

      TreeUIService.toggleNode(documentId, '');

      // Expansion state for this document should remain unchanged
      expect(store.expansionState[documentId]).toEqual(initialExpansionState);
    });

    it('should handle primitive document tree', () => {
      const primitiveDoc = new PrimitiveDocument(
        new DocumentDefinition(DocumentType.SOURCE_BODY, DocumentDefinitionType.Primitive, BODY_DOCUMENT_ID),
      );
      const primitiveDocNode = new DocumentNodeData(primitiveDoc);
      const tree = TreeUIService.createTree(primitiveDocNode);

      expect(tree.root.children).toHaveLength(0);
      expect(tree.root.isParsed).toBe(false);

      const store = useDocumentTreeStore.getState();
      const documentId = primitiveDocNode.id;

      // Expansion state should still be set even for primitive documents
      expect(store.expansionState[documentId]).toBeDefined();
    });

    it('should handle rapid consecutive toggles', () => {
      const tree = TreeUIService.createTree(sourceDocNode);
      const documentId = sourceDocNode.id;
      const nodePath = tree.root.path;
      const store = useDocumentTreeStore.getState();

      const initialState = store.isExpanded(documentId, nodePath);

      // Rapid toggles
      TreeUIService.toggleNode(documentId, nodePath);
      TreeUIService.toggleNode(documentId, nodePath);
      TreeUIService.toggleNode(documentId, nodePath);
      TreeUIService.toggleNode(documentId, nodePath);
      TreeUIService.toggleNode(documentId, nodePath);

      // After odd number of toggles, state should be opposite of initial
      expect(store.isExpanded(documentId, nodePath)).toBe(!initialState);
    });
  });

  describe('expansion state preservation across tree rebuild', () => {
    it('should preserve collapsed state when tree is rebuilt for same document', () => {
      const tree = TreeUIService.createTree(sourceDocNode);
      const documentId = sourceDocNode.id;
      const store = useDocumentTreeStore.getState();

      const contentRoot = tree.contentRoots[0];
      expect(store.isExpanded(documentId, contentRoot.path)).toBe(true);

      TreeUIService.toggleNode(documentId, contentRoot.path);
      expect(store.isExpanded(documentId, contentRoot.path)).toBe(false);

      const tree2 = TreeUIService.createTree(sourceDocNode);
      const contentRoot2 = tree2.contentRoots[0];
      expect(store.isExpanded(documentId, contentRoot2.path)).toBe(false);
    });

    it('should preserve expansion state via field identity when node type transitions', () => {
      const targetDoc = TestUtil.createTargetOrderDoc();
      const mappingTree = new MappingTree(
        targetDoc.documentType,
        targetDoc.documentId,
        DocumentDefinitionType.XML_SCHEMA,
      );
      const targetDocNode = new TargetDocumentNodeData(targetDoc, mappingTree);
      const tree1 = TreeUIService.createTree(targetDocNode);
      const documentId = targetDocNode.id;
      const store = useDocumentTreeStore.getState();

      const contentRoot = tree1.contentRoots[0];
      expect(contentRoot.nodeData).toBeInstanceOf(TargetFieldNodeData);
      expect(store.isExpanded(documentId, contentRoot.path)).toBe(true);

      TreeUIService.toggleNode(documentId, contentRoot.path);
      expect(store.isExpanded(documentId, contentRoot.path)).toBe(false);

      const field = (contentRoot.nodeData as TargetFieldNodeData).field;
      MappingService.createFieldItem(mappingTree, field);

      const newMappingTree = new MappingTree(
        targetDoc.documentType,
        targetDoc.documentId,
        DocumentDefinitionType.XML_SCHEMA,
      );
      newMappingTree.children = mappingTree.children.map((child) => {
        child.parent = newMappingTree;
        return child;
      });
      const targetDocNode2 = new TargetDocumentNodeData(targetDoc, newMappingTree);
      const tree2 = TreeUIService.createTree(targetDocNode2);

      const newContentRoot = tree2.contentRoots[0];
      expect(newContentRoot.nodeData).toBeInstanceOf(FieldItemNodeData);
      expect(newContentRoot.path).not.toBe(contentRoot.path);
      expect(store.isExpanded(documentId, newContentRoot.path)).toBe(false);
    });
  });

  describe('deep expansion preservation (issue #3811)', () => {
    beforeEach(() => {
      // Clear the static tree cache to prevent interference from other tests
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TreeUIService as any).trees.clear();
    });

    afterEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TreeUIService as any).trees.clear();
    });

    /**
     * The load-bearing regression test.
     *
     * Verifies that descendants of a transitioning node that sit BELOW the parse frontier
     * keep their expansion state across a mapping create → remove round-trip.
     *
     * Schema shape:  WideDeep (content root, L0)
     *                 ├─ wide_01..wide_09 (L1, each with 10 leaf children = 90 L2 nodes)
     *                 └─ deep_chain (L1) → L2 → L3 → L4 → L5leaf
     *
     * With INITIAL_FIELD_COUNTS=100 and INITIAL_PARSE_DEPTH=3:
     * - WideDeep (1) + wide_01..wide_09 (9×11=99) = 100 nodes consume the budget before
     *   the deep chain's L3/L4 are visited.
     * - The transitioning node is `WideDeep` (the content root itself) which is always
     *   within the frontier (depth 0).
     * - deep_chain and its descendants sit under WideDeep and are expanded by the test
     *   via toggleNode before the mapping create, producing deep store keys.
     *
     * §7c confirmed: on unfixed code, 0 of N deep keys survived. The fix must preserve all N.
     */
    it('should preserve deep descendant expansion after mapping create on a frontier-visible field', () => {
      const targetDoc = createWideDeepTargetDoc();
      const mappingTree = new MappingTree(
        targetDoc.documentType,
        targetDoc.documentId,
        DocumentDefinitionType.XML_SCHEMA,
      );
      const targetDocNode = new TargetDocumentNodeData(targetDoc, mappingTree);
      const tree1 = TreeUIService.createTree(targetDocNode);
      const documentId = targetDocNode.id;

      // The content root is `WideDeep` (the single top-level xs:element).
      // It is within the frontier (depth 0 from contentRoots) so it is the transitioning node.
      const wideDeepRoot = tree1.contentRoots[0];
      expect(wideDeepRoot).toBeDefined();
      expect(wideDeepRoot.nodeData.title).toBe('WideDeep');
      expect(wideDeepRoot.nodeData).toBeInstanceOf(TargetFieldNodeData);
      const oldWideDeepPath = wideDeepRoot.path;

      // Navigate to deep_chain → L2 → L3.
      // deep_chain (depth 1) and L2 (depth 2) are within the frontier guarantee (depth+1 < 3).
      // L3 is at depth 3 — processTreeNode won't visit it once totalFieldsProcessed ≥ 100
      // (the 9 wide siblings + their 90 leaf children exhaust the budget before the walk reaches L3).
      const deepChainNode = wideDeepRoot.children.find((c) => c.nodeData.title === 'deep_chain');
      expect(deepChainNode).toBeDefined();
      TreeParsingService.parseTreeNode(deepChainNode!); // add L2
      const l2Node = deepChainNode!.children[0];
      expect(l2Node).toBeDefined();
      TreeParsingService.parseTreeNode(l2Node); // add L3
      const l3Node = l2Node.children[0];
      expect(l3Node).toBeDefined();

      // Inject L3 as a below-frontier expansion key directly into the store.
      // The frontier walk of the NEW tree (after mapping create) will NOT visit L3,
      // so this key can only survive if the fix carries it over verbatim + migrates its prefix.
      // Using setTreeExpansion so the key is the L3 path under the old WideDeep prefix.
      const existingExpansion = useDocumentTreeStore.getState().expansionState[documentId];
      useDocumentTreeStore.getState().setTreeExpansion(documentId, {
        ...existingExpansion,
        [l3Node.path]: true, // ← genuinely below-frontier key
      });

      // Pre-condition: the below-frontier L3 key is now in the store under the old WideDeep prefix
      const expansionSnapshot = useDocumentTreeStore.getState().expansionState[documentId];
      const deepKeysBefore = Object.keys(expansionSnapshot).filter(
        (k) => k === oldWideDeepPath || k.startsWith(oldWideDeepPath + '/'),
      );
      // Must include at least the L3 key (which is NOT reachable by the frontier walk of the new tree)
      expect(deepKeysBefore.some((k) => k === l3Node.path)).toBe(true);
      // Confirm L3 is truly below the frontier: it must NOT be in the new tree after rebuild
      // (we verify this post-rebuild below)

      // Create a mapping on WideDeep: TargetFieldNodeData → FieldItemNodeData transition
      const wideDeepField = (wideDeepRoot.nodeData as TargetFieldNodeData).field;
      MappingService.createFieldItem(mappingTree, wideDeepField);

      // Simulate the structural rebuild (as refreshMappingTree({ structural: true }) does)
      const newMappingTree = new MappingTree(
        targetDoc.documentType,
        targetDoc.documentId,
        DocumentDefinitionType.XML_SCHEMA,
      );
      newMappingTree.children = mappingTree.children.map((child) => {
        child.parent = newMappingTree;
        return child;
      });
      const targetDocNode2 = new TargetDocumentNodeData(targetDoc, newMappingTree);
      const tree2 = TreeUIService.createTree(targetDocNode2);

      // Content root is now a FieldItemNodeData
      const newWideDeepRoot = tree2.contentRoots.find(
        (r) => r.nodeData instanceof FieldItemNodeData && (r.nodeData as FieldItemNodeData).field === wideDeepField,
      );
      expect(newWideDeepRoot).toBeDefined();
      const newWideDeepPath = newWideDeepRoot!.path;
      expect(newWideDeepPath).not.toBe(oldWideDeepPath);

      const expansionAfter = useDocumentTreeStore.getState().expansionState[documentId];

      // The expected new path for L3 after prefix migration
      const l3NewPath = newWideDeepPath + l3Node.path.slice(oldWideDeepPath.length);

      // CORE ASSERTION (the bug §7c describes): the below-frontier L3 key must survive
      // This assertion FAILS on the unfixed code (reconcileExpansion overwrites with frontier-only keys)
      expect(expansionAfter[l3NewPath]).toBeDefined();

      // Every key that was under the old prefix must now exist under the new prefix
      for (const oldKey of deepKeysBefore) {
        const newKey = newWideDeepPath + oldKey.slice(oldWideDeepPath.length);
        expect(expansionAfter[newKey]).toBeDefined();
      }

      // No stale keys under the old field.id prefix
      const staleKeys = Object.keys(expansionAfter).filter(
        (k) => k === oldWideDeepPath || k.startsWith(oldWideDeepPath + '/'),
      );
      expect(staleKeys).toHaveLength(0);
    });

    it('should preserve deep descendant expansion after mapping remove (reverse transition)', () => {
      const targetDoc = createWideDeepTargetDoc();
      const mappingTree = new MappingTree(
        targetDoc.documentType,
        targetDoc.documentId,
        DocumentDefinitionType.XML_SCHEMA,
      );
      const targetDocNode = new TargetDocumentNodeData(targetDoc, mappingTree);
      const tree1 = TreeUIService.createTree(targetDocNode);
      const documentId = targetDocNode.id;

      // Content root is WideDeep; create a mapping on it so it starts as FieldItemNodeData
      const wideDeepRoot = tree1.contentRoots[0];
      expect(wideDeepRoot).toBeDefined();
      const wideDeepField = (wideDeepRoot.nodeData as TargetFieldNodeData).field;
      const fieldItem = MappingService.createFieldItem(mappingTree, wideDeepField);

      const mappingTree2 = new MappingTree(
        targetDoc.documentType,
        targetDoc.documentId,
        DocumentDefinitionType.XML_SCHEMA,
      );
      mappingTree2.children = mappingTree.children.map((child) => {
        child.parent = mappingTree2;
        return child;
      });
      const targetDocNode2 = new TargetDocumentNodeData(targetDoc, mappingTree2);
      const tree2 = TreeUIService.createTree(targetDocNode2);

      // Content root is now FieldItemNodeData
      const mappedRoot = tree2.contentRoots.find(
        (r) => r.nodeData instanceof FieldItemNodeData && (r.nodeData as FieldItemNodeData).field === wideDeepField,
      );
      expect(mappedRoot).toBeDefined();
      const mappedPath = mappedRoot!.path;

      // Expand deep descendants under the new FieldItemNodeData prefix
      TreeParsingService.parseTreeNode(mappedRoot!);
      const deepChainMapped = mappedRoot!.children.find((c) => c.nodeData.title === 'deep_chain');
      expect(deepChainMapped).toBeDefined();
      TreeUIService.toggleNode(documentId, deepChainMapped!.path);
      TreeParsingService.parseTreeNode(deepChainMapped!);
      const l2 = deepChainMapped!.children[0];
      TreeUIService.toggleNode(documentId, l2.path);
      TreeParsingService.parseTreeNode(l2);
      const l3 = l2.children[0];
      TreeUIService.toggleNode(documentId, l3.path); // below frontier

      const deepKeysUnderMapped = Object.keys(useDocumentTreeStore.getState().expansionState[documentId]).filter(
        (k) => k === mappedPath || k.startsWith(mappedPath + '/'),
      );
      expect(deepKeysUnderMapped.length).toBeGreaterThan(0);

      // Delete the mapping: FieldItemNodeData → TargetFieldNodeData transition
      // Remove the FieldItem directly from the parent's children (simulating a mapping delete)
      const mappingTree3 = new MappingTree(
        targetDoc.documentType,
        targetDoc.documentId,
        DocumentDefinitionType.XML_SCHEMA,
      );
      mappingTree3.children = mappingTree2.children
        .filter((child) => child !== fieldItem)
        .map((child) => {
          child.parent = mappingTree3;
          return child;
        });
      const targetDocNode3 = new TargetDocumentNodeData(targetDoc, mappingTree3);
      const tree3 = TreeUIService.createTree(targetDocNode3);

      // Content root should now be back to a TargetFieldNodeData
      const unmappedRoot = tree3.contentRoots[0];
      expect(unmappedRoot).toBeDefined();
      expect(unmappedRoot.nodeData).toBeInstanceOf(TargetFieldNodeData);
      expect(unmappedRoot.nodeData.title).toBe('WideDeep');
      const unmappedPath = unmappedRoot.path;

      // Deep keys must be preserved under the restored field.id prefix
      const expansionAfter = useDocumentTreeStore.getState().expansionState[documentId];
      for (const oldKey of deepKeysUnderMapped) {
        const newKey = unmappedPath + oldKey.slice(mappedPath.length);
        expect(expansionAfter[newKey]).toBeDefined();
      }

      // No stale keys under the old mapping.id prefix
      const staleKeys = Object.keys(expansionAfter).filter((k) => k === mappedPath || k.startsWith(mappedPath + '/'));
      expect(staleKeys).toHaveLength(0);
    });

    it('should perform a full create → remove round-trip preserving expansion throughout', () => {
      const targetDoc = createWideDeepTargetDoc();
      const mappingTree = new MappingTree(
        targetDoc.documentType,
        targetDoc.documentId,
        DocumentDefinitionType.XML_SCHEMA,
      );
      const targetDocNode = new TargetDocumentNodeData(targetDoc, mappingTree);
      const tree1 = TreeUIService.createTree(targetDocNode);
      const documentId = targetDocNode.id;

      const wideDeepRoot = tree1.contentRoots[0];
      expect(wideDeepRoot).toBeDefined();
      const originalPath = wideDeepRoot.path;

      // Parse down to L3 to get its actual path string, then inject it as a below-frontier key.
      const deepChainNode = wideDeepRoot.children.find((c) => c.nodeData.title === 'deep_chain');
      expect(deepChainNode).toBeDefined();
      TreeParsingService.parseTreeNode(deepChainNode!); // add L2
      const l2 = deepChainNode!.children[0];
      TreeParsingService.parseTreeNode(l2); // add L3
      const l3 = l2.children[0];
      expect(l3).toBeDefined();

      // Inject L3 as a genuinely below-frontier key
      useDocumentTreeStore.getState().setTreeExpansion(documentId, {
        ...useDocumentTreeStore.getState().expansionState[documentId],
        [l3.path]: true,
      });

      const originalDeepKeys = Object.keys(useDocumentTreeStore.getState().expansionState[documentId]).filter(
        (k) => k === originalPath || k.startsWith(originalPath + '/'),
      );
      // Must include the below-frontier L3 key
      expect(originalDeepKeys.some((k) => k === l3.path)).toBe(true);

      // --- Create mapping ---
      const wideDeepField = (wideDeepRoot.nodeData as TargetFieldNodeData).field;
      const fieldItem = MappingService.createFieldItem(mappingTree, wideDeepField);

      const mt2 = new MappingTree(targetDoc.documentType, targetDoc.documentId, DocumentDefinitionType.XML_SCHEMA);
      mt2.children = mappingTree.children.map((c) => {
        c.parent = mt2;
        return c;
      });
      const tree2 = TreeUIService.createTree(new TargetDocumentNodeData(targetDoc, mt2));

      const mappedRoot = tree2.contentRoots.find(
        (r) => r.nodeData instanceof FieldItemNodeData && (r.nodeData as FieldItemNodeData).field === wideDeepField,
      );
      expect(mappedRoot).toBeDefined();
      const mappedPath = mappedRoot!.path;

      // The L3 key must have migrated to the new prefix
      const l3MappedPath = mappedPath + l3.path.slice(originalPath.length);
      // CORE ASSERTION: this fails on unfixed code (L3 is below frontier, dropped by old reconcileExpansion)
      expect(useDocumentTreeStore.getState().expansionState[documentId][l3MappedPath]).toBeDefined();

      // --- Remove mapping: remove FieldItem from the tree directly ---
      const mt3 = new MappingTree(targetDoc.documentType, targetDoc.documentId, DocumentDefinitionType.XML_SCHEMA);
      mt3.children = mt2.children
        .filter((c) => c !== fieldItem)
        .map((c) => {
          c.parent = mt3;
          return c;
        });
      const tree3 = TreeUIService.createTree(new TargetDocumentNodeData(targetDoc, mt3));

      const restoredRoot = tree3.contentRoots[0];
      expect(restoredRoot).toBeDefined();
      expect(restoredRoot.nodeData).toBeInstanceOf(TargetFieldNodeData);
      const restoredPath = restoredRoot.path;

      // L3 must survive the full round-trip under the restored field.id prefix
      const l3RestoredPath = restoredPath + l3.path.slice(originalPath.length);
      expect(useDocumentTreeStore.getState().expansionState[documentId][l3RestoredPath]).toBeDefined();

      // No stale keys under the intermediate mapping.id prefix
      expect(
        Object.keys(useDocumentTreeStore.getState().expansionState[documentId]).filter(
          (k) => k === mappedPath || k.startsWith(mappedPath + '/'),
        ),
      ).toHaveLength(0);
    });

    it('should NOT migrate when a collection field has multiple mappings (multi-sibling skip)', () => {
      // Use a simple target doc with the ShipOrder (Item field is repeating)
      const targetDoc = TestUtil.createTargetOrderDoc();
      const mappingTree = new MappingTree(
        targetDoc.documentType,
        targetDoc.documentId,
        DocumentDefinitionType.XML_SCHEMA,
      );
      const targetDocNode = new TargetDocumentNodeData(targetDoc, mappingTree);
      const tree1 = TreeUIService.createTree(targetDocNode);
      const documentId = targetDocNode.id;
      const store = useDocumentTreeStore.getState();

      // Find the ShipOrder content root and get the Item child (it's a collection)
      const shipOrderRoot = tree1.contentRoots[0];
      expect(shipOrderRoot).toBeDefined();
      TreeParsingService.parseTreeNode(shipOrderRoot);
      const itemNode = shipOrderRoot.children.find((c) => c.nodeData.title === 'Item');
      expect(itemNode).toBeDefined();
      const itemField = (itemNode!.nodeData as TargetFieldNodeData).field;
      const itemPath = itemNode!.path;

      // Collapse item so we have a false entry
      TreeUIService.toggleNode(documentId, itemPath);
      const itemStateBeforeCreate = store.isExpanded(documentId, itemPath);

      // Create TWO mappings on Item (multi-sibling scenario)
      MappingService.createFieldItem(mappingTree, itemField);
      MappingService.createFieldItem(mappingTree, itemField);

      const newMappingTree = new MappingTree(
        targetDoc.documentType,
        targetDoc.documentId,
        DocumentDefinitionType.XML_SCHEMA,
      );
      newMappingTree.children = mappingTree.children.map((child) => {
        child.parent = newMappingTree;
        return child;
      });
      const targetDocNode2 = new TargetDocumentNodeData(targetDoc, newMappingTree);
      // This must NOT throw and must NOT broadcast the single stale value to both mappings
      expect(() => TreeUIService.createTree(targetDocNode2)).not.toThrow();

      // Verify behavior is "no worse than today": the old Item path key is gone
      // (replaced by the new tree's path keys for the two FieldItemNodeData siblings);
      // no assertion on the new paths since the skip leaves the existing fallback in charge.
      expect(store.expansionState[documentId][itemPath]).not.toBe(itemStateBeforeCreate);
    });

    it('should prune orphaned expansion keys (verbatim carry-over with prune — §4.3 memory guard)', () => {
      // This test verifies that keys from a previous document state (simulating
      // a schema swap) do not accumulate in the store.
      const targetDoc = TestUtil.createTargetOrderDoc();
      const mappingTree = new MappingTree(
        targetDoc.documentType,
        targetDoc.documentId,
        DocumentDefinitionType.XML_SCHEMA,
      );
      const targetDocNode = new TargetDocumentNodeData(targetDoc, mappingTree);
      const documentId = targetDocNode.id;

      // Manually seed bogus orphan keys that do not correspond to any live content root
      const BOGUS_PREFIX = 'targetBody:Body://fx-DEAD-0000';
      useDocumentTreeStore.getState().setTreeExpansion(documentId, {
        [BOGUS_PREFIX]: true,
        [`${BOGUS_PREFIX}/fx-Child-1111`]: true,
        [`${BOGUS_PREFIX}/fx-Child-1111/fx-GrandChild-2222`]: false,
      });

      // Rebuild via createTree — prune must eliminate the bogus keys
      TreeUIService.createTree(targetDocNode);

      const expansionAfter = useDocumentTreeStore.getState().expansionState[documentId];
      // Bogus keys must be gone
      expect(expansionAfter[BOGUS_PREFIX]).toBeUndefined();
      expect(expansionAfter[`${BOGUS_PREFIX}/fx-Child-1111`]).toBeUndefined();
      expect(expansionAfter[`${BOGUS_PREFIX}/fx-Child-1111/fx-GrandChild-2222`]).toBeUndefined();
      // Live keys (the actual content roots) must still be present
      const liveKeys = Object.keys(expansionAfter);
      expect(liveKeys.length).toBeGreaterThan(0);
    });
  });

  /**
   * Exact reproduction of the user-reported scenario:
   * expand ShipTo children via toggleNode, then create first mapping on Name
   * (which transitions ShipOrder→ShipTo→Name to FieldItemNodeData via getOrCreateFieldItem).
   * Address/City/Country — siblings of Name that stay as TargetFieldNodeData — must remain expanded.
   */
  describe('reproduction: expand all → first mapping collapses to depth 3', () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TreeUIService as any).trees.clear();
      useDocumentTreeStore.setState({ expansionState: {}, expansionStateArray: {} });
    });
    afterEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (TreeUIService as any).trees.clear();
      useDocumentTreeStore.setState({ expansionState: {}, expansionStateArray: {} });
    });

    it('should keep ShipTo children expanded after first mapping on Name', () => {
      const targetDoc = TestUtil.createTargetOrderDoc();
      const mappingTree = new MappingTree(
        targetDoc.documentType,
        targetDoc.documentId,
        DocumentDefinitionType.XML_SCHEMA,
      );
      const targetDocNode = new TargetDocumentNodeData(targetDoc, mappingTree);
      const tree1 = TreeUIService.createTree(targetDocNode);
      const documentId = targetDocNode.id;
      const store = useDocumentTreeStore.getState();

      // Navigate: ShipOrder → ShipTo → children (Name, Address, City, Country)
      const shipOrderRoot = tree1.contentRoots[0];
      expect(shipOrderRoot.nodeData.title).toBe('ShipOrder');

      // ShipTo is a child of ShipOrder — already parsed by parseTree
      const shipToNode = shipOrderRoot.children.find((c) => c.nodeData.title === 'ShipTo');
      expect(shipToNode).toBeDefined();
      if (!shipToNode!.isParsed) TreeParsingService.parseTreeNode(shipToNode!);
      expect(shipToNode!.children.length).toBeGreaterThan(0);

      // Ensure ShipTo and all its children (Name, Address, City, Country) are expanded
      if (!store.isExpanded(documentId, shipToNode!.path)) {
        TreeUIService.toggleNode(documentId, shipToNode!.path);
      }
      expect(store.isExpanded(documentId, shipToNode!.path)).toBe(true);

      for (const child of shipToNode!.children) {
        if (!store.isExpanded(documentId, child.path)) {
          TreeUIService.toggleNode(documentId, child.path);
        }
        expect(store.isExpanded(documentId, child.path)).toBe(true);
      }

      // Find Name node — use its TargetFieldNodeData directly for getOrCreateFieldItem
      const nameNode = shipToNode!.children.find((c) => c.nodeData.title === 'Name');
      expect(nameNode).toBeDefined();
      const nameNodeData = nameNode!.nodeData as TargetFieldNodeData;

      // Find Address, City, Country — these must stay expanded after the mapping
      const addressNode = shipToNode!.children.find((c) => c.nodeData.title === 'Address');
      const cityNode = shipToNode!.children.find((c) => c.nodeData.title === 'City');
      const countryNode = shipToNode!.children.find((c) => c.nodeData.title === 'Country');
      expect(addressNode).toBeDefined();
      expect(cityNode).toBeDefined();
      expect(countryNode).toBeDefined();

      // Create first mapping on Name via getOrCreateFieldItem — this materialises
      // FieldItem ancestor chain: mappingTree → ShipOrder_fi → ShipTo_fi → Name_fi
      MappingActionService.getOrCreateFieldItem(nameNodeData);

      // Simulate refreshMappingTree({ structural: true })
      const newMappingTree = new MappingTree(
        targetDoc.documentType,
        targetDoc.documentId,
        DocumentDefinitionType.XML_SCHEMA,
      );
      newMappingTree.children = mappingTree.children.map((child) => {
        child.parent = newMappingTree;
        return child;
      });
      const tree2 = TreeUIService.createTree(new TargetDocumentNodeData(targetDoc, newMappingTree));

      // ShipOrder is now FieldItemNodeData
      const newShipOrderRoot = tree2.contentRoots[0];
      expect(newShipOrderRoot.nodeData).toBeInstanceOf(FieldItemNodeData);

      // ShipTo is now FieldItemNodeData
      if (!newShipOrderRoot.isParsed) TreeParsingService.parseTreeNode(newShipOrderRoot);
      const newShipToNode = newShipOrderRoot.children.find((c) => c.nodeData.title === 'ShipTo');
      expect(newShipToNode).toBeDefined();
      expect(newShipToNode!.nodeData).toBeInstanceOf(FieldItemNodeData);

      const expansionAfter = useDocumentTreeStore.getState().expansionState[documentId];

      // ShipTo must still be expanded
      expect(expansionAfter[newShipToNode!.path]).toBe(true);

      // Address, City, Country (still TargetFieldNodeData under the new ShipTo FieldItem)
      // must still be expanded — their paths changed prefix from ShipTo_fid to ShipTo_mid
      if (!newShipToNode!.isParsed) TreeParsingService.parseTreeNode(newShipToNode!);
      const newAddressNode = newShipToNode!.children.find((c) => c.nodeData.title === 'Address');
      const newCityNode = newShipToNode!.children.find((c) => c.nodeData.title === 'City');
      const newCountryNode = newShipToNode!.children.find((c) => c.nodeData.title === 'Country');
      expect(newAddressNode).toBeDefined();
      expect(newCityNode).toBeDefined();
      expect(newCountryNode).toBeDefined();

      // CORE ASSERTION: Address/City/Country must be expanded (not collapsed to default)
      expect(expansionAfter[newAddressNode!.path]).toBe(true);
      expect(expansionAfter[newCityNode!.path]).toBe(true);
      expect(expansionAfter[newCountryNode!.path]).toBe(true);
    });

    /**
     * Regression for the reported "first mapping on a DEEP leaf collapses its ancestor" bug.
     *
     * Unlike the ShipTo case above (where the transitioning chain sits within the parse
     * frontier), here the whole chain WideDeep → deep_chain → L2 → L3 → L4 is BELOW the
     * 100-node frontier. Mapping the deepest leaf (L4/L5leaf) materialises the entire
     * FieldItem chain at once, but parseTree only parses to the frontier, so those deep
     * FieldItem nodes are unparsed when buildIdentityMaps runs. If buildIdentityMaps does not
     * parse them on-demand, their field.id → mapping.id transition is undetected, their
     * expansion keys are dropped by the prune step, and the ancestor (deep_chain / L2 / L3)
     * visually collapses on the FIRST mapping. This test locks the on-demand-parse fix.
     */
    it('should keep a deep below-frontier chain expanded after the first mapping on its leaf', () => {
      const targetDoc = createWideDeepTargetDoc();
      const mappingTree = new MappingTree(
        targetDoc.documentType,
        targetDoc.documentId,
        DocumentDefinitionType.XML_SCHEMA,
      );
      const targetDocNode = new TargetDocumentNodeData(targetDoc, mappingTree);
      const tree1 = TreeUIService.createTree(targetDocNode);
      const documentId = targetDocNode.id;

      // Helper: ensure a node ends up expanded regardless of its default state
      // (toggleNode flips, so only toggle when currently collapsed) — mirrors the user
      // deliberately expanding a branch, without accidentally collapsing an already-open one.
      const ensureExpanded = (path: string) => {
        if (!useDocumentTreeStore.getState().isExpanded(documentId, path)) {
          TreeUIService.toggleNode(documentId, path);
        }
      };

      // Navigate WideDeep → deep_chain → L2 → L3 → L4, expanding each so the deep chain
      // (below the frontier) has genuine store keys — exactly what the user does before mapping.
      const root = tree1.contentRoots[0];
      const deepChain = root.children.find((c) => c.nodeData.title === 'deep_chain');
      expect(deepChain).toBeDefined();
      ensureExpanded(deepChain!.path);
      if (!deepChain!.isParsed) TreeParsingService.parseTreeNode(deepChain!);
      const l2 = deepChain!.children.find((c) => c.nodeData.title === 'L2');
      expect(l2).toBeDefined();
      ensureExpanded(l2!.path);
      if (!l2!.isParsed) TreeParsingService.parseTreeNode(l2!);
      const l3 = l2!.children.find((c) => c.nodeData.title === 'L3');
      expect(l3).toBeDefined();
      ensureExpanded(l3!.path);
      if (!l3!.isParsed) TreeParsingService.parseTreeNode(l3!);
      const l4 = l3!.children.find((c) => c.nodeData.title === 'L4');
      expect(l4).toBeDefined();
      ensureExpanded(l4!.path);

      // Pre-condition: the deep chain is expanded in the store
      expect(useDocumentTreeStore.getState().isExpanded(documentId, deepChain!.path)).toBe(true);
      expect(useDocumentTreeStore.getState().isExpanded(documentId, l2!.path)).toBe(true);
      expect(useDocumentTreeStore.getState().isExpanded(documentId, l3!.path)).toBe(true);

      // First mapping on the deepest leaf L4 — materialises the whole FieldItem chain
      MappingActionService.getOrCreateFieldItem(l4!.nodeData as TargetFieldNodeData);

      // Rebuild as refreshMappingTree({ structural: true }) would
      const newMappingTree = new MappingTree(
        targetDoc.documentType,
        targetDoc.documentId,
        DocumentDefinitionType.XML_SCHEMA,
      );
      newMappingTree.children = mappingTree.children.map((child) => {
        child.parent = newMappingTree;
        return child;
      });
      const tree2 = TreeUIService.createTree(new TargetDocumentNodeData(targetDoc, newMappingTree));

      const expansionAfter = useDocumentTreeStore.getState().expansionState[documentId];

      // Locate the new (FieldItem-prefixed) deep chain and assert every level stays expanded.
      // Walk the whole tree (unbounded) since the mapped chain sits below the parse frontier.
      const findByTitle = (title: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let match: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const walk = (n: any) => {
          if (n.nodeData.title === title) match = n;
          n.children.forEach(walk);
        };
        for (const r of tree2.contentRoots) walk(r);
        return match;
      };
      const newDeepChain = findByTitle('deep_chain');
      const newL2 = findByTitle('L2');
      const newL3 = findByTitle('L3');
      expect(newDeepChain).toBeDefined();
      expect(newL2).toBeDefined();
      expect(newL3).toBeDefined();

      // CORE ASSERTIONS: the deep chain must remain expanded under the new mapping.id prefix.
      expect(expansionAfter[newDeepChain!.path]).toBe(true);
      expect(expansionAfter[newL2!.path]).toBe(true);
      expect(expansionAfter[newL3!.path]).toBe(true);

      // And flatten() must actually render them (they are parsed, so children are visible).
      const visiblePaths = new Set(tree2.flatten(expansionAfter).map((f) => f.path));
      expect(visiblePaths.has(newL2!.path)).toBe(true);
      expect(visiblePaths.has(newL3!.path)).toBe(true);
    });
  });
});
