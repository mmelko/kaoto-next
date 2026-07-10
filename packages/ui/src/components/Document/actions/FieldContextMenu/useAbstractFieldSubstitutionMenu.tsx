import { Choices } from '@carbon/icons-react';
import { CheckIcon } from '@patternfly/react-icons';
import { useCallback, useMemo, useState } from 'react';

import { useDataMapper } from '../../../../hooks/useDataMapper';
import { IField } from '../../../../models/datamapper/document';
import { FieldItem } from '../../../../models/datamapper/mapping';
import { IFieldSubstituteInfo } from '../../../../models/datamapper/types';
import { FieldItemNodeData, NodeData, TargetNodeData } from '../../../../models/datamapper/visualization';
import { DocumentUtilService } from '../../../../services/document/document-util.service';
import { FieldOverrideService } from '../../../../services/document/field-override.service';
import { MappingService } from '../../../../services/mapping/mapping.service';
import { SchemaPathService } from '../../../../services/schema-path.service';
import { MappingActionService } from '../../../../services/visualization/mapping-action.service';
import { MenuAction, MenuGroup } from '../FieldContextMenu';
import { SubstitutionSelectionModal } from '../SubstitutionSelectionModal';
import { buildSelectSelfAction, findCandidateQName, resolveAbstractFieldInfo } from './menu-utils';
import { MenuContributor } from './types';

const INLINE_SUBSTITUTION_LIMIT = 10;

function resolveCandidateField(
  wrapperField: IField,
  qname: string,
  cachedCandidates: Record<string, IFieldSubstituteInfo>,
  knownWrapper: IField | undefined,
  namespaceMap: Record<string, string>,
): IField | undefined {
  const resolvedCandidates =
    wrapperField === knownWrapper
      ? cachedCandidates
      : FieldOverrideService.getFieldSubstitutionCandidates(wrapperField, namespaceMap);
  const candidate = resolvedCandidates[qname];
  if (!candidate) return undefined;
  return wrapperField.fields?.find(
    (f) => f.name === candidate.qname.getLocalPart() && f.namespaceURI === candidate.qname.getNamespaceURI(),
  );
}

function buildInlineSubstitutionActions(
  candidates: Record<string, IFieldSubstituteInfo>,
  selectedQName: string | undefined,
  onSelect: (qname: string) => void,
): MenuAction[] {
  return Object.entries(candidates).map(([qname, info]) => ({
    label: info.displayName,
    onClick: () => {
      onSelect(qname);
    },
    icon: selectedQName === qname ? <CheckIcon /> : <Choices />,
    testId: `substitution-menu-item-${qname}`,
  }));
}

function buildAbstractWrapperMenuGroups(
  candidates: Record<string, IFieldSubstituteInfo>,
  selectedQName: string | undefined,
  selectSelfAction: MenuAction | undefined,
  clearSubstitutionAction: MenuAction,
  handleSelectSubstitution: (qname: string) => void,
  handleOpenSubstitutionModal: () => void,
): MenuGroup[] {
  const candidateCount = Object.keys(candidates).length;

  if (candidateCount === 0 && selectedQName === undefined) {
    return selectSelfAction ? [{ actions: [selectSelfAction] }] : [];
  }

  const candidatesGroup: MenuGroup =
    candidateCount <= INLINE_SUBSTITUTION_LIMIT
      ? { actions: buildInlineSubstitutionActions(candidates, selectedQName, handleSelectSubstitution) }
      : {
          actions: [
            { label: 'Select Substitute...', onClick: handleOpenSubstitutionModal, testId: 'open-substitution-modal' },
          ],
        };

  const hasSelection = selectedQName !== undefined;
  return [
    { actions: selectSelfAction ? [selectSelfAction] : [] },
    candidatesGroup,
    { actions: hasSelection ? [clearSubstitutionAction] : [] },
  ];
}

export function useAbstractFieldSubstitutionMenu(nodeData: NodeData): MenuContributor {
  const { mappingTree, updateDocument } = useDataMapper();

  const {
    isAbstractWrapper,
    isSelectedSubstitution,
    isSubstitutionCandidate,
    isAbstractWrapperMember,
    abstractWrapperField,
    field,
    parentAbstractField,
    candidateQName,
  } = resolveAbstractFieldInfo(nodeData, mappingTree.namespaceMap);

  const [isSubstitutionModalOpen, setIsSubstitutionModalOpen] = useState(false);

  const candidates = useMemo(() => {
    if (!abstractWrapperField) return {};
    return FieldOverrideService.getFieldSubstitutionCandidates(abstractWrapperField, mappingTree.namespaceMap);
  }, [abstractWrapperField, mappingTree.namespaceMap]);

  const selectedQName = useMemo(() => {
    if (!abstractWrapperField) return undefined;
    const selectedField = DocumentUtilService.getSelectedMember(abstractWrapperField);
    if (!selectedField) return undefined;
    return findCandidateQName(candidates, selectedField);
  }, [abstractWrapperField, candidates]);

  const isTargetSide = !nodeData.isSource;

  const applySubstitution = useCallback(
    (wrapperField: IField, qname: string) => {
      if (isAbstractWrapperMember && nodeData instanceof FieldItemNodeData) {
        const candidateField = resolveCandidateField(
          wrapperField,
          qname,
          candidates,
          abstractWrapperField,
          mappingTree.namespaceMap,
        );
        if (candidateField && nodeData.mapping instanceof FieldItem) {
          MappingService.updateFieldItemField(nodeData.mapping, candidateField);
        }
      } else if (isTargetSide && wrapperField.maxOccurs !== 1) {
        const candidateField = resolveCandidateField(
          wrapperField,
          qname,
          candidates,
          abstractWrapperField,
          mappingTree.namespaceMap,
        );
        if (candidateField) {
          MappingActionService.applyTargetSelection(nodeData as TargetNodeData, candidateField);
        }
      } else {
        FieldOverrideService.applyFieldSubstitution(wrapperField, qname, mappingTree.namespaceMap);
        if (isTargetSide) {
          const selectedMember = DocumentUtilService.getSelectedMember(wrapperField);
          if (selectedMember) MappingActionService.applyTargetSelection(nodeData as TargetNodeData, selectedMember);
        }
      }

      const doc = wrapperField.ownerDocument;
      const previousRefId = doc.getReferenceId(mappingTree.namespaceMap);
      updateDocument(doc, doc.definition, previousRefId);
    },
    [
      abstractWrapperField,
      isAbstractWrapperMember,
      isTargetSide,
      candidates,
      mappingTree.namespaceMap,
      nodeData,
      updateDocument,
    ],
  );

  const applyClearSubstitution = useCallback(
    (wrapperField: IField) => {
      if (isAbstractWrapperMember && nodeData instanceof FieldItemNodeData && nodeData.mapping instanceof FieldItem) {
        const mapping = nodeData.mapping;
        const idx = mapping.parent.children.indexOf(mapping);
        if (idx !== -1) mapping.parent.children.splice(idx, 1);
      } else {
        if (isTargetSide) MappingActionService.clearTargetSelection(nodeData as TargetNodeData, wrapperField);
        const doc = wrapperField.ownerDocument;
        const schemaPath = SchemaPathService.build(wrapperField, mappingTree.namespaceMap);
        DocumentUtilService.invalidateDescendants(doc, schemaPath);
        FieldOverrideService.revertFieldSubstitution(wrapperField, mappingTree.namespaceMap);
      }

      const doc = wrapperField.ownerDocument;
      const previousRefId = doc.getReferenceId(mappingTree.namespaceMap);
      updateDocument(doc, doc.definition, previousRefId);
    },
    [isAbstractWrapperMember, isTargetSide, mappingTree.namespaceMap, nodeData, updateDocument],
  );

  // Case A: select a substitute from this node's own wrapper candidate list
  const handleSelectSubstitution = useCallback(
    (qname: string) => {
      if (!abstractWrapperField) return;
      applySubstitution(abstractWrapperField, qname);
    },
    [abstractWrapperField, applySubstitution],
  );

  // Case A/B: clear substitution on this node's wrapper (or the selected wrapper)
  const handleClearSubstitution = useCallback(() => {
    if (!abstractWrapperField) return;
    applyClearSubstitution(abstractWrapperField);
  }, [abstractWrapperField, applyClearSubstitution]);

  const handleOpenSubstitutionModal = useCallback(() => {
    setIsSubstitutionModalOpen(true);
  }, []);

  // Case C: select this candidate within the parent abstract wrapper
  const handleSelectSelfAsCandidate = useCallback(() => {
    if (!parentAbstractField || !candidateQName) return;
    applySubstitution(parentAbstractField, candidateQName);
  }, [parentAbstractField, candidateQName, applySubstitution]);

  const clearSubstitutionAction: MenuAction = {
    label: 'Clear substitution',
    onClick: handleClearSubstitution,
    testId: 'clear-substitution',
  };

  const selectSelfAction = isSubstitutionCandidate
    ? buildSelectSelfAction(field, parentAbstractField, handleSelectSelfAsCandidate, 'select-substitution-member')
    : undefined;

  const memberSelectedQName = useMemo(() => {
    if (!isAbstractWrapperMember || !abstractWrapperField || !field) return undefined;
    return findCandidateQName(candidates, field);
  }, [isAbstractWrapperMember, abstractWrapperField, candidates, field]);

  let menuGroups: MenuGroup[];
  if (isAbstractWrapper || isAbstractWrapperMember) {
    menuGroups = buildAbstractWrapperMenuGroups(
      candidates,
      isAbstractWrapperMember ? memberSelectedQName : selectedQName,
      isAbstractWrapperMember ? undefined : selectSelfAction,
      clearSubstitutionAction,
      handleSelectSubstitution,
      handleOpenSubstitutionModal,
    );
  } else {
    const substitutionActions: MenuAction[] = [];
    if (isSelectedSubstitution) substitutionActions.push(clearSubstitutionAction);
    if (selectSelfAction) substitutionActions.push(selectSelfAction);
    menuGroups = [{ actions: substitutionActions }];
  }

  const closeSubstitutionModal = useCallback(() => {
    setIsSubstitutionModalOpen(false);
  }, []);

  return {
    groups: menuGroups,
    modals:
      isSubstitutionModalOpen && abstractWrapperField ? (
        <SubstitutionSelectionModal
          isOpen={isSubstitutionModalOpen}
          abstractField={abstractWrapperField}
          candidates={candidates}
          onSelect={handleSelectSubstitution}
          onClose={closeSubstitutionModal}
        />
      ) : null,
  };
}
