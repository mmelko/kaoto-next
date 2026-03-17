import { Icon } from '@patternfly/react-core';
import { ExchangeAltIcon, WrenchIcon } from '@patternfly/react-icons';
import { FunctionComponent, ReactNode, useCallback } from 'react';

import { useDataMapper } from '../../../../hooks/useDataMapper';
import { DocumentDefinition, IDocument, IField } from '../../../../models/datamapper/document';
import { FieldOverrideVariant, IFieldTypeInfo } from '../../../../models/datamapper/types';
import { QName } from '../../../../xml-schema-ts/QName';
import { FieldTypeOverrideService } from '../../../../services/field-type-override.service';
import { formatQNameWithPrefix } from '../../../../services/qname-util';
import { OverrideMode, TypeOverrideModal } from './TypeOverrideModal';

type FieldTypeOverrideProps = {
  field: IField;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
};

/**
 * Dedicated component for field type override operations.
 * Wraps TypeOverrideModal with save/remove handlers, consolidating
 * the override logic that was previously duplicated across
 * SourceDocumentNode, TargetNodeActions, and ConditionMenuAction.
 */
export const FieldTypeOverride: FunctionComponent<FieldTypeOverrideProps> = ({
  field,
  isOpen,
  onClose,
  onComplete,
}) => {
  const { mappingTree, updateDocument } = useDataMapper();

  const handleAttach = useCallback(
    (schemas: Record<string, string>) => {
      const document = field.ownerDocument;
      const namespaceMap = mappingTree.namespaceMap;
      const previousRefId = document.getReferenceId(namespaceMap);
      FieldTypeOverrideService.addSchemaFilesForTypeOverride(document, schemas);
      updateDocument(document, document.definition, previousRefId);
    },
    [field, mappingTree.namespaceMap, updateDocument],
  );

  const handleSave = useCallback(
    (selectedType: IFieldTypeInfo | null, mode: OverrideMode, selectedKey: string | null) => {
      if (!selectedType || !selectedKey) return;

      const document = field.ownerDocument;
      const namespaceMap = mappingTree.namespaceMap;
      const previousRefId = document.getReferenceId(namespaceMap);

      if (mode === 'substitution') {
        const substituteElement = new QName(selectedType.namespaceURI, selectedType.displayName);
        FieldTypeOverrideService.applyFieldSubstitution(document, field, substituteElement, namespaceMap);
      } else {
        FieldTypeOverrideService.applyFieldTypeOverride(
          document,
          field,
          selectedType,
          namespaceMap,
          FieldOverrideVariant.SAFE,
        );
      }

      updateDocument(document, document.definition, previousRefId);
      onComplete();
      onClose();
    },
    [field, mappingTree.namespaceMap, updateDocument, onComplete, onClose],
  );

  const handleRemove = useCallback(() => {
    revertOverride(field, mappingTree.namespaceMap, updateDocument);
    onComplete();
    onClose();
  }, [field, mappingTree.namespaceMap, updateDocument, onComplete, onClose]);

  return (
    <TypeOverrideModal
      isOpen={isOpen}
      field={field}
      onSave={handleSave}
      onAttach={handleAttach}
      onRemove={handleRemove}
      onClose={onClose}
    />
  );
};

/**
 * Revert a field override (type override or substitution) without opening the modal.
 * Dispatches to the correct service method based on the field's current override variant.
 */
export function revertOverride(
  field: IField,
  namespaceMap: Record<string, string>,
  updateDocument: (document: IDocument, definition: DocumentDefinition, previousRefId: string) => void,
): void {
  const document = field.ownerDocument;
  const previousRefId = document.getReferenceId(namespaceMap);

  if (field.typeOverride === FieldOverrideVariant.SUBSTITUTION) {
    FieldTypeOverrideService.revertFieldSubstitution(document, field, namespaceMap);
  } else {
    FieldTypeOverrideService.revertFieldTypeOverride(document, field, namespaceMap);
  }

  updateDocument(document, document.definition, previousRefId);
}

/** Render an icon indicator for a field with an override (type or substitution). Returns null if no override. */
export function renderTypeOverrideIndicator(
  field: IField | undefined,
  namespaceMap: Record<string, string> = {},
): ReactNode {
  if (!field || field.typeOverride === FieldOverrideVariant.NONE) return null;

  const isSubstitution = field.typeOverride === FieldOverrideVariant.SUBSTITUTION;
  const title = isSubstitution
    ? `Element substituted: ${field.originalField?.name ?? '?'} → ${field.name}`
    : `Type overridden: ${formatQNameWithPrefix(field.originalField?.typeQName ?? field.typeQName, namespaceMap, field.originalField?.type ?? field.type)} → ${formatQNameWithPrefix(field.typeQName, namespaceMap, field.type)}`;

  return (
    <Icon className="node__spacer node__type-override-indicator" size="md" status="warning" isInline title={title}>
      {isSubstitution ? <ExchangeAltIcon /> : <WrenchIcon />}
    </Icon>
  );
}
