import { act, fireEvent, render, screen } from '@testing-library/react';
import { FunctionComponent, PropsWithChildren } from 'react';

import {
  BODY_DOCUMENT_ID,
  DocumentDefinition,
  DocumentDefinitionType,
  DocumentType,
} from '../../../../models/datamapper';
import { DocumentTree } from '../../../../models/datamapper/document-tree';
import { DocumentTreeNode } from '../../../../models/datamapper/document-tree-node';
import { FieldItem, MappingTree } from '../../../../models/datamapper/mapping';
import {
  DocumentNodeData,
  FieldItemNodeData,
  TargetAbstractFieldNodeData,
  TargetDocumentNodeData,
} from '../../../../models/datamapper/visualization';
import { MappingLinksProvider } from '../../../../providers/data-mapping-links.provider';
import { DataMapperProvider } from '../../../../providers/datamapper.provider';
import { FieldOverrideService } from '../../../../services/document/field-override.service';
import { XmlSchemaDocumentService } from '../../../../services/document/xml-schema/xml-schema-document.service';
import { MappingService } from '../../../../services/mapping/mapping.service';
import { MappingActionService } from '../../../../services/visualization/mapping-action.service';
import { TreeParsingService } from '../../../../services/visualization/tree-parsing.service';
import { VisualizationService } from '../../../../services/visualization/visualization.service';
import { getFieldSubstitutionXsd } from '../../../../stubs/datamapper/data-mapper';
import { QName } from '../../../../xml-schema-ts/QName';
import { SourceDocumentNodeWithContextMenu } from '../../SourceDocumentNode';
import { TargetDocumentNodeWithContextMenu } from '../../TargetDocumentNode';

const NS_SUBSTITUTION = 'http://www.example.com/SUBSTITUTION';

function createSubstitutionDoc(docType: DocumentType = DocumentType.SOURCE_BODY) {
  const definition = new DocumentDefinition(docType, DocumentDefinitionType.XML_SCHEMA, 'test-doc', {
    'FieldSubstitution.xsd': getFieldSubstitutionXsd(),
  });
  definition.rootElementChoice = { namespaceUri: NS_SUBSTITUTION, name: 'AbstractAnimal' };
  const result = XmlSchemaDocumentService.createXmlSchemaDocument(definition);
  if (result.validationStatus !== 'success' || !result.document) {
    throw new Error(result.errors?.map((e) => e.message).join('; ') || 'Failed to create substitution test document');
  }
  return result.document;
}

describe('useAbstractFieldSubstitutionMenu', () => {
  const wrapper: FunctionComponent<PropsWithChildren> = ({ children }) => (
    <DataMapperProvider>
      <MappingLinksProvider>{children}</MappingLinksProvider>
    </DataMapperProvider>
  );

  const createAbstractFieldNode = (selectMember = false) => {
    const document = createSubstitutionDoc();
    const abstractAnimalField = document.fields[0];

    if (selectMember) {
      abstractAnimalField.selectedMemberQName = new QName(NS_SUBSTITUTION, 'Cat');
    }

    const documentNodeData = new DocumentNodeData(document);
    const tree = new DocumentTree(documentNodeData);
    TreeParsingService.parseTree(tree);
    const abstractNode = tree.root.children[0];

    return { document, documentNodeData, abstractNode, abstractAnimalField };
  };

  it('should show inline substitution candidates when abstract field has candidates', () => {
    const { documentNodeData, abstractNode } = createAbstractFieldNode(false);

    render(
      <SourceDocumentNodeWithContextMenu
        treeNode={abstractNode}
        documentId={documentNodeData.id}
        isReadOnly={false}
        rank={1}
      />,
      { wrapper },
    );

    act(() => {
      fireEvent.contextMenu(screen.getByTestId(`node-source-${abstractNode.nodeData.id}`));
    });

    // Should show inline menu items for substitution candidates
    expect(screen.getByText('Cat')).toBeInTheDocument();
    expect(screen.getByText('Dog')).toBeInTheDocument();
    expect(screen.getByText('Fish')).toBeInTheDocument();
    expect(screen.getByText('Kitten')).toBeInTheDocument();
  });

  it('should show "Clear substitution" when a member is selected', () => {
    const { documentNodeData, abstractNode } = createAbstractFieldNode(true);

    render(
      <SourceDocumentNodeWithContextMenu
        treeNode={abstractNode}
        documentId={documentNodeData.id}
        isReadOnly={false}
        rank={1}
      />,
      { wrapper },
    );

    act(() => {
      fireEvent.contextMenu(screen.getByTestId(`node-source-${abstractNode.nodeData.id}`));
    });

    expect(screen.getByText('Clear substitution')).toBeInTheDocument();
  });

  it('should call applyFieldSubstitution when clicking a substitution candidate', () => {
    const { documentNodeData, abstractNode, abstractAnimalField } = createAbstractFieldNode(false);
    const applySpy = vi.spyOn(FieldOverrideService, 'applyFieldSubstitution');

    render(
      <SourceDocumentNodeWithContextMenu
        treeNode={abstractNode}
        documentId={documentNodeData.id}
        isReadOnly={false}
        rank={1}
      />,
      { wrapper },
    );

    act(() => {
      fireEvent.contextMenu(screen.getByTestId(`node-source-${abstractNode.nodeData.id}`));
    });

    act(() => {
      fireEvent.click(screen.getByText('Cat'));
    });

    expect(applySpy).toHaveBeenCalledWith(abstractAnimalField, expect.stringContaining('Cat'), expect.any(Object));
    applySpy.mockRestore();
  });

  it('should call revertFieldSubstitution when clicking "Clear substitution"', () => {
    const { documentNodeData, abstractNode, abstractAnimalField } = createAbstractFieldNode(true);
    const revertSpy = vi.spyOn(FieldOverrideService, 'revertFieldSubstitution');

    render(
      <SourceDocumentNodeWithContextMenu
        treeNode={abstractNode}
        documentId={documentNodeData.id}
        isReadOnly={false}
        rank={1}
      />,
      { wrapper },
    );

    act(() => {
      fireEvent.contextMenu(screen.getByTestId(`node-source-${abstractNode.nodeData.id}`));
    });

    act(() => {
      fireEvent.click(screen.getByText('Clear substitution'));
    });

    expect(revertSpy).toHaveBeenCalledWith(abstractAnimalField, expect.any(Object));
    revertSpy.mockRestore();
  });

  it('should not show "Clear substitution" when no member is selected', () => {
    const { documentNodeData, abstractNode } = createAbstractFieldNode(false);

    render(
      <SourceDocumentNodeWithContextMenu
        treeNode={abstractNode}
        documentId={documentNodeData.id}
        isReadOnly={false}
        rank={1}
      />,
      { wrapper },
    );

    act(() => {
      fireEvent.contextMenu(screen.getByTestId(`node-source-${abstractNode.nodeData.id}`));
    });

    expect(screen.queryByText('Clear substitution')).not.toBeInTheDocument();
  });

  describe('target-side abstract wrapper', () => {
    const createTargetAbstractFieldNode = () => {
      const document = createSubstitutionDoc(DocumentType.TARGET_BODY);
      const mappingTree = new MappingTree(
        document.documentType,
        document.documentId,
        DocumentDefinitionType.XML_SCHEMA,
      );
      const documentNodeData = new TargetDocumentNodeData(document, mappingTree);
      const abstractAnimalField = document.fields[0];

      const tree = new DocumentTree(documentNodeData);
      TreeParsingService.parseTree(tree);
      const abstractNode = tree.root.children[0];
      return { document, documentNodeData, abstractNode, abstractAnimalField, mappingTree };
    };

    it('should hide children for unconfigured target abstract wrapper', () => {
      const { abstractNode } = createTargetAbstractFieldNode();
      expect(VisualizationService.hasChildren(abstractNode.nodeData)).toBe(false);
      const children = VisualizationService.generateNonDocumentNodeDataChildren(abstractNode.nodeData);
      expect(children).toHaveLength(0);
    });

    it('should show substitution candidates in context menu for unconfigured target abstract wrapper', () => {
      const { documentNodeData, abstractNode } = createTargetAbstractFieldNode();

      render(
        <TargetDocumentNodeWithContextMenu
          treeNode={abstractNode}
          documentId={documentNodeData.id}
          isReadOnly={false}
          rank={1}
        />,
        { wrapper },
      );

      act(() => {
        fireEvent.contextMenu(screen.getByTestId(`node-target-${abstractNode.nodeData.id}`));
      });

      expect(screen.getByText('Cat')).toBeInTheDocument();
      expect(screen.getByText('Dog')).toBeInTheDocument();
      expect(screen.getByText('Fish')).toBeInTheDocument();
      expect(screen.getByText('Kitten')).toBeInTheDocument();
    });

    it('should call applyFieldSubstitution when clicking a candidate on target-side', () => {
      const { documentNodeData, abstractNode, abstractAnimalField } = createTargetAbstractFieldNode();
      const applySpy = vi.spyOn(FieldOverrideService, 'applyFieldSubstitution');

      render(
        <TargetDocumentNodeWithContextMenu
          treeNode={abstractNode}
          documentId={documentNodeData.id}
          isReadOnly={false}
          rank={1}
        />,
        { wrapper },
      );

      act(() => {
        fireEvent.contextMenu(screen.getByTestId(`node-target-${abstractNode.nodeData.id}`));
      });

      act(() => {
        fireEvent.click(screen.getByText('Cat'));
      });

      expect(applySpy).toHaveBeenCalledWith(abstractAnimalField, expect.stringContaining('Cat'), expect.any(Object));
      applySpy.mockRestore();
    });

    it('should replace existing FieldItem field when selecting a different candidate on target-side', () => {
      const { documentNodeData, abstractNode, abstractAnimalField, mappingTree } = createTargetAbstractFieldNode();
      const abstractTargetNode = abstractNode.nodeData as TargetAbstractFieldNodeData;
      abstractTargetNode.mapping = new FieldItem(mappingTree, abstractAnimalField);
      const applySpy = vi.spyOn(FieldOverrideService, 'applyFieldSubstitution');

      render(
        <TargetDocumentNodeWithContextMenu
          treeNode={abstractNode}
          documentId={documentNodeData.id}
          isReadOnly={false}
          rank={1}
        />,
        { wrapper },
      );

      act(() => {
        fireEvent.contextMenu(screen.getByTestId(`node-target-${abstractNode.nodeData.id}`));
      });

      act(() => {
        fireEvent.click(screen.getByText('Dog'));
      });

      expect(applySpy).toHaveBeenCalledWith(abstractAnimalField, expect.stringContaining('Dog'), expect.any(Object));
      applySpy.mockRestore();
    });

    it('should show children after substitute is selected on target abstract wrapper', () => {
      const { abstractNode, abstractAnimalField, mappingTree } = createTargetAbstractFieldNode();
      abstractAnimalField.selectedMemberQName = new QName(NS_SUBSTITUTION, 'Cat');
      const abstractTargetNode = abstractNode.nodeData as TargetAbstractFieldNodeData;
      abstractTargetNode.mapping = new FieldItem(mappingTree, abstractAnimalField);
      expect(VisualizationService.hasChildren(abstractTargetNode)).toBe(true);
    });
  });

  describe('target-side abstract wrapper with maxOccurs>1', () => {
    function createTargetZooDoc() {
      const definition = new DocumentDefinition(
        DocumentType.TARGET_BODY,
        DocumentDefinitionType.XML_SCHEMA,
        BODY_DOCUMENT_ID,
        { 'FieldSubstitution.xsd': getFieldSubstitutionXsd() },
        { namespaceUri: NS_SUBSTITUTION, name: 'Zoo' },
      );
      const result = XmlSchemaDocumentService.createXmlSchemaDocument(definition);
      if (result.validationStatus !== 'success' || !result.document) {
        throw new Error(result.errors?.map((e) => e.message).join('; ') || 'Failed to create Zoo test document');
      }
      return result.document;
    }

    const createTargetZooAbstractNode = () => {
      const document = createTargetZooDoc();
      const mappingTree = new MappingTree(
        document.documentType,
        document.documentId,
        DocumentDefinitionType.XML_SCHEMA,
      );
      const documentNodeData = new TargetDocumentNodeData(document, mappingTree);
      const zooField = document.fields[0];
      const abstractAnimalField = zooField.fields.find((f) => f.name === 'AbstractAnimal')!;
      expect(abstractAnimalField.maxOccurs).not.toBe(1);

      const tree = new DocumentTree(documentNodeData);
      TreeParsingService.parseTree(tree);
      const zooNode = tree.root.children[0];
      const abstractNode = zooNode.children.find((c) => c.nodeData instanceof TargetAbstractFieldNodeData)!;
      return { document, documentNodeData, abstractNode, abstractAnimalField, mappingTree };
    };

    it('should NOT call applyFieldSubstitution when selecting candidate on maxOccurs>1 wrapper', () => {
      const { documentNodeData, abstractNode } = createTargetZooAbstractNode();
      const applySpy = vi.spyOn(FieldOverrideService, 'applyFieldSubstitution');
      const targetSelectionSpy = vi.spyOn(MappingActionService, 'applyTargetSelection');

      render(
        <TargetDocumentNodeWithContextMenu
          treeNode={abstractNode}
          documentId={documentNodeData.id}
          isReadOnly={false}
          rank={1}
        />,
        { wrapper },
      );

      act(() => {
        fireEvent.contextMenu(screen.getByTestId(`node-target-${abstractNode.nodeData.id}`));
      });

      act(() => {
        fireEvent.click(screen.getByText('Cat'));
      });

      expect(applySpy).not.toHaveBeenCalled();
      expect(targetSelectionSpy).toHaveBeenCalled();
      applySpy.mockRestore();
      targetSelectionSpy.mockRestore();
    });

    it('should not set selectedMemberQName on wrapper after selection on maxOccurs>1', () => {
      const { documentNodeData, abstractNode, abstractAnimalField } = createTargetZooAbstractNode();
      vi.spyOn(MappingActionService, 'applyTargetSelection').mockImplementation(vi.fn());

      render(
        <TargetDocumentNodeWithContextMenu
          treeNode={abstractNode}
          documentId={documentNodeData.id}
          isReadOnly={false}
          rank={1}
        />,
        { wrapper },
      );

      act(() => {
        fireEvent.contextMenu(screen.getByTestId(`node-target-${abstractNode.nodeData.id}`));
      });

      act(() => {
        fireEvent.click(screen.getByText('Dog'));
      });

      expect(abstractAnimalField.selectedMemberQName).toBeUndefined();
      vi.restoreAllMocks();
    });

    it('should still call applyFieldSubstitution for maxOccurs=1 wrapper (regression)', () => {
      const { documentNodeData, abstractNode, abstractAnimalField } = createTargetZooAbstractNode();
      abstractAnimalField.maxOccurs = 1;
      const applySpy = vi.spyOn(FieldOverrideService, 'applyFieldSubstitution');

      render(
        <TargetDocumentNodeWithContextMenu
          treeNode={abstractNode}
          documentId={documentNodeData.id}
          isReadOnly={false}
          rank={1}
        />,
        { wrapper },
      );

      act(() => {
        fireEvent.contextMenu(screen.getByTestId(`node-target-${abstractNode.nodeData.id}`));
      });

      act(() => {
        fireEvent.click(screen.getByText('Cat'));
      });

      expect(applySpy).toHaveBeenCalledWith(abstractAnimalField, expect.stringContaining('Cat'), expect.any(Object));
      applySpy.mockRestore();
    });
  });

  describe('FieldItemNodeData under abstract wrapper (member context menu)', () => {
    function createTargetZooDoc() {
      const definition = new DocumentDefinition(
        DocumentType.TARGET_BODY,
        DocumentDefinitionType.XML_SCHEMA,
        BODY_DOCUMENT_ID,
        { 'FieldSubstitution.xsd': getFieldSubstitutionXsd() },
        { namespaceUri: NS_SUBSTITUTION, name: 'Zoo' },
      );
      const result = XmlSchemaDocumentService.createXmlSchemaDocument(definition);
      if (result.validationStatus !== 'success' || !result.document) {
        throw new Error(result.errors?.map((e) => e.message).join('; ') || 'Failed to create Zoo test document');
      }
      return result.document;
    }

    const createMemberNode = () => {
      const document = createTargetZooDoc();
      const mappingTree = new MappingTree(
        document.documentType,
        document.documentId,
        DocumentDefinitionType.XML_SCHEMA,
      );
      const documentNodeData = new TargetDocumentNodeData(document, mappingTree);
      const zooField = document.fields[0];
      const abstractAnimalField = zooField.fields.find((f) => f.name === 'AbstractAnimal')!;
      const catField = abstractAnimalField.fields.find((f) => f.name === 'Cat')!;

      const tree = new DocumentTree(documentNodeData);
      TreeParsingService.parseTree(tree);
      const zooNode = tree.root.children[0];
      const abstractNode = zooNode.children.find((c) => c.nodeData instanceof TargetAbstractFieldNodeData)!;

      const abstractNodeData = abstractNode.nodeData as TargetAbstractFieldNodeData;
      const parentItem = MappingActionService.getOrCreateFieldItem(abstractNodeData.parent);
      const fieldItem = MappingService.createFieldItem(parentItem, catField);
      fieldItem.isUserCreated = true;
      abstractNodeData.mapping = new FieldItem(parentItem, abstractAnimalField);

      const fieldItemNodeData = new FieldItemNodeData(abstractNodeData, fieldItem);
      const memberTreeNode = new DocumentTreeNode(fieldItemNodeData, abstractNode);

      return { document, documentNodeData, memberTreeNode, fieldItem, abstractAnimalField, mappingTree };
    };

    it('should show substitution candidates in context menu for member node', () => {
      const { documentNodeData, memberTreeNode } = createMemberNode();

      render(
        <TargetDocumentNodeWithContextMenu
          treeNode={memberTreeNode}
          documentId={documentNodeData.id}
          isReadOnly={false}
          rank={1}
        />,
        { wrapper },
      );

      act(() => {
        fireEvent.contextMenu(screen.getByTestId(`node-target-${memberTreeNode.nodeData.id}`));
      });

      const menuItems = screen.getAllByText('Cat');
      expect(menuItems.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Dog')).toBeInTheDocument();
      expect(screen.getByText('Fish')).toBeInTheDocument();
      expect(screen.getByText('Kitten')).toBeInTheDocument();
    });

    it('should show "Clear substitution" for member node', () => {
      const { documentNodeData, memberTreeNode } = createMemberNode();

      render(
        <TargetDocumentNodeWithContextMenu
          treeNode={memberTreeNode}
          documentId={documentNodeData.id}
          isReadOnly={false}
          rank={1}
        />,
        { wrapper },
      );

      act(() => {
        fireEvent.contextMenu(screen.getByTestId(`node-target-${memberTreeNode.nodeData.id}`));
      });

      expect(screen.getByText('Clear substitution')).toBeInTheDocument();
    });

    it('should call updateFieldItemField when changing substitution on member node', () => {
      const { documentNodeData, memberTreeNode } = createMemberNode();
      const updateSpy = vi.spyOn(MappingService, 'updateFieldItemField');

      render(
        <TargetDocumentNodeWithContextMenu
          treeNode={memberTreeNode}
          documentId={documentNodeData.id}
          isReadOnly={false}
          rank={1}
        />,
        { wrapper },
      );

      act(() => {
        fireEvent.contextMenu(screen.getByTestId(`node-target-${memberTreeNode.nodeData.id}`));
      });

      act(() => {
        fireEvent.click(screen.getByText('Dog'));
      });

      expect(updateSpy).toHaveBeenCalled();
      updateSpy.mockRestore();
    });

    it('should remove FieldItem from parent when clearing substitution on member node', () => {
      const { documentNodeData, memberTreeNode, fieldItem } = createMemberNode();
      const parentChildren = fieldItem.parent.children;
      const childrenBefore = parentChildren.length;

      render(
        <TargetDocumentNodeWithContextMenu
          treeNode={memberTreeNode}
          documentId={documentNodeData.id}
          isReadOnly={false}
          rank={1}
        />,
        { wrapper },
      );

      act(() => {
        fireEvent.contextMenu(screen.getByTestId(`node-target-${memberTreeNode.nodeData.id}`));
      });

      act(() => {
        fireEvent.click(screen.getByText('Clear substitution'));
      });

      expect(parentChildren).toHaveLength(childrenBefore - 1);
      expect(parentChildren).not.toContain(fieldItem);
    });
  });
});
