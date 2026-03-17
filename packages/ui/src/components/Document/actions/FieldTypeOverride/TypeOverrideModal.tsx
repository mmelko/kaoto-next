import {
  Button,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Icon,
  MenuToggle,
  MenuToggleElement,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Radio,
  Select,
  SelectList,
  SelectOption,
  Split,
  SplitItem,
} from '@patternfly/react-core';
import { FileImportIcon, WrenchIcon } from '@patternfly/react-icons';
import { FunctionComponent, MouseEvent, Ref, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useDataMapper } from '../../../../hooks/useDataMapper';
import { IField, SCHEMA_FILE_NAME_PATTERN_XML } from '../../../../models/datamapper/document';
import { FieldOverrideVariant, IFieldTypeInfo } from '../../../../models/datamapper/types';
import { MetadataContext } from '../../../../providers';
import { FieldTypeOverrideService } from '../../../../services/field-type-override.service';
import { formatQNameWithPrefix } from '../../../../services/qname-util';
import { getFileName, pickAndValidateSchemaFiles } from '../utils';
import { SchemaFileList } from './SchemaFileList';

export type OverrideMode = 'type' | 'substitution';

export type TypeOverrideModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (selectedType: IFieldTypeInfo | null, mode: OverrideMode, selectedKey: string | null) => void;
  onAttach: (schemas: Record<string, string>) => void;
  onRemove: () => void;
  field: IField;
};

export const TypeOverrideModal: FunctionComponent<TypeOverrideModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onAttach,
  onRemove,
  field,
}) => {
  const api = useContext(MetadataContext)!;
  const { mappingTree } = useDataMapper();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Record<string, IFieldTypeInfo>>({});
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [uploadedSchemas, setUploadedSchemas] = useState<Record<string, string>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [overrideMode, setOverrideMode] = useState<OverrideMode>('type');

  const selectedCandidate = selectedKey ? (candidates[selectedKey] ?? null) : null;

  const existingFiles = useMemo(
    () => Object.keys(field?.ownerDocument?.definition?.definitionFiles ?? {}),
    [field?.ownerDocument?.definition?.definitionFiles],
  );

  const hasSubstitutionCandidates = useMemo(() => {
    if (!field) return false;
    return (
      Object.keys(FieldTypeOverrideService.getFieldSubstitutionCandidates(field, mappingTree.namespaceMap)).length > 0
    );
  }, [field, mappingTree.namespaceMap]);

  const showModeToggle = hasSubstitutionCandidates;

  function getCandidatesForMode(mode: OverrideMode): Record<string, IFieldTypeInfo> {
    if (!field) return {};
    const namespaceMap = mappingTree.namespaceMap;
    return mode === 'substitution'
      ? FieldTypeOverrideService.getFieldSubstitutionCandidates(field, namespaceMap)
      : FieldTypeOverrideService.getSafeOverrideCandidates(field, namespaceMap);
  }

  function preselectKeyForMode(mode: OverrideMode, availableCandidates: Record<string, IFieldTypeInfo>): string | null {
    if (!field) return null;
    if (
      mode === 'type' &&
      field.typeOverride !== FieldOverrideVariant.NONE &&
      field.typeOverride !== FieldOverrideVariant.SUBSTITUTION &&
      field.typeQName
    ) {
      const typeString = formatQNameWithPrefix(field.typeQName, mappingTree.namespaceMap, field.type);
      return typeString in availableCandidates ? typeString : null;
    }
    return null;
  }

  function loadCandidatesForMode(mode: OverrideMode) {
    const availableCandidates = getCandidatesForMode(mode);
    setCandidates(availableCandidates);
    setSelectedKey(preselectKeyForMode(mode, availableCandidates));
  }

  // Set initial mode and load candidates when modal opens or definition files change
  useEffect(() => {
    if (isOpen && field) {
      const mode = field.typeOverride === FieldOverrideVariant.SUBSTITUTION ? 'substitution' : 'type';
      setOverrideMode(mode);
      loadCandidatesForMode(mode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, field, existingFiles]);

  const handleModeChange = (mode: OverrideMode) => {
    setOverrideMode(mode);
    loadCandidatesForMode(mode);
  };

  // Clean up transient state when modal closes
  useEffect(() => {
    if (!isOpen) return;
    return () => {
      setUploadError(null);
      setSelectedKey(null);
      setIsSelectOpen(false);
      setUploadedSchemas({});
    };
  }, [isOpen]);

  // Prevent @dnd-kit drag activation when modal is open
  // React synthetic events from portals bubble through the React tree, not DOM tree.
  // Since this modal is rendered inside a draggable component, mousedown events
  // would bubble to the useDraggable listeners. We use native capture-phase listeners
  // to intercept events BEFORE they reach React's synthetic event system.
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDownCapture = (e: Event) => {
      const target = e.target as HTMLElement;
      // Stop propagation for any click on backdrop or modal content
      if (target.closest('.pf-v6-c-backdrop') || target.closest('.pf-v6-c-modal-box')) {
        e.stopPropagation();
      }
    };

    // Capture phase (third parameter = true) runs before React synthetic events
    document.addEventListener('mousedown', handleMouseDownCapture, true);
    document.addEventListener('pointerdown', handleMouseDownCapture, true);

    return () => {
      document.removeEventListener('mousedown', handleMouseDownCapture, true);
      document.removeEventListener('pointerdown', handleMouseDownCapture, true);
    };
  }, [isOpen]);

  const handleTypeSelect = useCallback(
    (_event: MouseEvent | undefined, value: string | number | undefined) => {
      const key = value as string;
      if (key in candidates) {
        setSelectedKey(key);
      }
      setIsSelectOpen(false);
    },
    [candidates],
  );

  const readSchemaFiles = useCallback(
    async (paths: string[]): Promise<Record<string, string> | null> => {
      const newSchemas: Record<string, string> = {};
      for (const path of paths) {
        if (uploadedSchemas[path] || existingFiles.includes(path)) continue;

        const content = await api.getResourceContent(path);
        if (!content) {
          setUploadError(`Failed to read: ${getFileName(path)}`);
          return null;
        }
        newSchemas[path] = content;
      }
      return newSchemas;
    },
    [api, uploadedSchemas, existingFiles],
  );

  const handleSchemaUpload = useCallback(async () => {
    setUploadError(null);

    try {
      const { paths: newPaths, error } = await pickAndValidateSchemaFiles(
        api,
        SCHEMA_FILE_NAME_PATTERN_XML,
        field.ownerDocument.definition.documentType,
        Object.keys(uploadedSchemas),
      );

      if (error) {
        setUploadError(error);
        return;
      }

      if (newPaths.length === 0) return;

      const newSchemas = await readSchemaFiles(newPaths);
      if (!newSchemas || Object.keys(newSchemas).length === 0) return;

      // Track uploaded schemas for duplicate detection
      setUploadedSchemas((prev) => ({ ...prev, ...newSchemas }));

      // Immediately attach schemas to document and reload types
      try {
        onAttach(newSchemas);
        // Types will be reloaded automatically via useEffect when existingFiles changes
      } catch (attachError: unknown) {
        const message = attachError instanceof Error ? attachError.message : String(attachError);
        setUploadError(`Invalid schema: ${message}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setUploadError(`Failed to upload: ${message}`);
    }
  }, [api, uploadedSchemas, field, readSchemaFiles, onAttach]);

  const handleSave = useCallback(() => {
    onSave(selectedCandidate, overrideMode, selectedKey);
  }, [selectedCandidate, selectedKey, overrideMode, onSave]);

  const handleToggleSelect = useCallback(() => {
    setIsSelectOpen(!isSelectOpen);
  }, [isSelectOpen]);

  const isSubstitutionMode = overrideMode === 'substitution';
  const selectLabel = isSubstitutionMode ? 'Substitute Element' : 'New Type';
  const selectPlaceholder = isSubstitutionMode ? 'Select a substitute element...' : 'Select a new type...';

  const renderToggle = useCallback(
    (toggleRef: Ref<MenuToggleElement>) => (
      <MenuToggle ref={toggleRef} onClick={handleToggleSelect} isExpanded={isSelectOpen} isFullWidth>
        {selectedCandidate?.displayName || selectPlaceholder}
      </MenuToggle>
    ),
    [handleToggleSelect, isSelectOpen, selectedCandidate?.displayName, selectPlaceholder],
  );

  const hasExistingOverride = field?.typeOverride !== FieldOverrideVariant.NONE;

  const originalTypeDisplay =
    field?.originalField?.typeQName?.toString() || field?.originalField?.type || field?.type || 'Unknown';
  const fieldName = field?.displayName || field?.name || 'Field';
  const fieldPath = field?.path?.toString() || '';
  const modalTitle = (
    <>
      <Icon size="md" status="warning" isInline>
        <WrenchIcon />
      </Icon>{' '}
      Field Override: {fieldName}
    </>
  );

  return (
    <Modal
      variant={ModalVariant.medium}
      isOpen={isOpen}
      onClose={onClose}
      appendTo={() => document.body}
      className="type-override-modal"
    >
      <ModalHeader title={modalTitle} />
      <ModalBody>
        <Form>
          <FormGroup>
            <p>
              <strong>Field Path:</strong> {fieldPath}
            </p>
          </FormGroup>

          <FormGroup>
            <p>
              <strong>Original Type:</strong> {originalTypeDisplay}
            </p>
          </FormGroup>

          {showModeToggle && (
            <FormGroup label="Override Mode" fieldId="override-mode" role="radiogroup">
              <Split hasGutter>
                <SplitItem>
                  <Radio
                    id="mode-type"
                    name="override-mode"
                    label="Override Type"
                    isChecked={overrideMode === 'type'}
                    onChange={() => handleModeChange('type')}
                  />
                </SplitItem>
                <SplitItem>
                  <Radio
                    id="mode-substitution"
                    name="override-mode"
                    label="Substitute Element"
                    isChecked={overrideMode === 'substitution'}
                    onChange={() => handleModeChange('substitution')}
                  />
                </SplitItem>
              </Split>
            </FormGroup>
          )}

          <FormGroup label={selectLabel} fieldId="type-select" isRequired>
            <Select
              id="type-select"
              isOpen={isSelectOpen}
              selected={selectedKey}
              onSelect={handleTypeSelect}
              onOpenChange={(isOpen) => setIsSelectOpen(isOpen)}
              toggle={renderToggle}
              maxMenuHeight="240px"
              popperProps={{
                preventOverflow: true,
              }}
            >
              <SelectList>
                {Object.entries(candidates)
                  .sort(([, a], [, b]) => a.displayName.localeCompare(b.displayName))
                  .map(([key, typeInfo]) => (
                    <SelectOption key={key} value={key}>
                      {typeInfo.displayName}
                    </SelectOption>
                  ))}
              </SelectList>
            </Select>
            {selectedCandidate?.description && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>{selectedCandidate.description}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>

          <FormGroup label="Document Schema Files" fieldId="schema-upload">
            <SchemaFileList existingFiles={existingFiles} pendingUploads={[]} onRemove={() => {}} />
            <Button
              icon={<FileImportIcon />}
              onClick={handleSchemaUpload}
              aria-label="Upload schema file"
              data-testid="upload-schema-button"
              variant="secondary"
            >
              Upload Schema
            </Button>
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant={uploadError ? 'error' : undefined}>
                  {uploadError || 'Upload schema files to add types to the dropdown.'}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        {hasExistingOverride && (
          <Button key="remove" variant="danger" onClick={onRemove} style={{ marginRight: 'auto' }}>
            Remove Override
          </Button>
        )}
        <Button key="cancel" variant="link" onClick={onClose}>
          Cancel
        </Button>
        <Button key="save" variant="primary" onClick={handleSave} isDisabled={!selectedKey}>
          Save
        </Button>
      </ModalFooter>
    </Modal>
  );
};
