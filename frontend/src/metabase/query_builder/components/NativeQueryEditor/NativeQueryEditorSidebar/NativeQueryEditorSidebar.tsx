import { t } from "ttag";

import Button from "metabase/core/components/Button";
import CS from "metabase/css/core/index.css";
import { isMac } from "metabase/lib/browser";
import { PLUGIN_AI_SQL_GENERATION } from "metabase/plugins";
import { canFormatForEngine } from "metabase/query_builder/components/NativeQueryEditor/utils";
import { DataReferenceButton } from "metabase/query_builder/components/view/DataReferenceButton";
import { NativeVariablesButton } from "metabase/query_builder/components/view/NativeVariablesButton";
import { PreviewQueryButton } from "metabase/query_builder/components/view/PreviewQueryButton";
import { SnippetSidebarButton } from "metabase/query_builder/components/view/SnippetSidebarButton";
import type { QueryModalType } from "metabase/query_builder/constants";
import { Box, Tooltip } from "metabase/ui";
import * as Lib from "metabase-lib";
import type Question from "metabase-lib/v1/Question";
import type { Collection, NativeQuerySnippet } from "metabase-types/api";

import RunButtonWithTooltip from "../../RunButtonWithTooltip";

import NativeQueryEditorSidebarS from "./NativeQueryEditorSidebar.module.css";

const ICON_SIZE = 18;

export type Features = {
  dataReference?: boolean;
  variables?: boolean;
  snippets?: boolean;
  promptInput?: boolean;
};

interface NativeQueryEditorSidebarProps {
  question: Question;
  nativeEditorSelectedText?: string;
  features: Features;
  snippets?: NativeQuerySnippet[];
  snippetCollections?: Collection[];
  isRunnable: boolean;
  isRunning: boolean;
  isResultDirty: boolean;
  isShowingDataReference: boolean;
  isShowingTemplateTagsEditor: boolean;
  isShowingSnippetSidebar: boolean;
  isPromptInputVisible?: boolean;
  runQuery?: () => void;
  cancelQuery?: () => void;
  onOpenModal: (modalType: QueryModalType) => void;
  onShowPromptInput: () => void;
  toggleDataReference: () => void;
  toggleTemplateTagsEditor: () => void;
  toggleSnippetSidebar: () => void;
  onFormatQuery: () => void;
  onGenerateQuery: (queryText: string) => void;
}

export const NativeQueryEditorSidebar = (
  props: NativeQueryEditorSidebarProps,
) => {
  const {
    question,
    cancelQuery,
    isResultDirty,
    isRunnable,
    isRunning,
    nativeEditorSelectedText,
    runQuery,
    snippetCollections,
    snippets,
    features,
    onFormatQuery,
    onGenerateQuery,
  } = props;

  // hide the snippet sidebar if there aren't any visible snippets/collections
  // and the root collection isn't writable
  const showSnippetSidebarButton = !(
    snippets?.length === 0 &&
    snippetCollections?.length === 1 &&
    !snippetCollections[0].can_write
  );

  const getTooltip = () => {
    const command = nativeEditorSelectedText
      ? t`Run selected text`
      : t`Run query`;

    const shortcut = isMac() ? t`(⌘ + enter)` : t`(Ctrl + enter)`;

    return command + " " + shortcut;
  };

  const query = question.query();
  const databaseId = Lib.databaseID(query);
  const canRunQuery = runQuery && cancelQuery;
  const engine = question.database?.()?.engine;
  const canFormatQuery = engine != null && canFormatForEngine(engine);

  return (
    <Box
      component="aside"
      className={NativeQueryEditorSidebarS.Container}
      data-testid="native-query-editor-sidebar"
    >
      {canFormatQuery && (
        <Tooltip label={t`Auto-format`}>
          <Button
            className={NativeQueryEditorSidebarS.SidebarButton}
            aria-label={t`Auto-format`}
            onClick={onFormatQuery}
            icon="format_code"
            iconSize={20}
            onlyIcon
          />
        </Tooltip>
      )}
      {features.dataReference ? (
        <DataReferenceButton {...props} size={ICON_SIZE} className={CS.mt3} />
      ) : null}
      {features.variables ? (
        <NativeVariablesButton {...props} size={ICON_SIZE} className={CS.mt3} />
      ) : null}
      {features.snippets && showSnippetSidebarButton ? (
        <SnippetSidebarButton {...props} size={ICON_SIZE} className={CS.mt3} />
      ) : null}
      {PreviewQueryButton.shouldRender({ question }) && (
        <PreviewQueryButton {...props} />
      )}
      {nativeEditorSelectedText != null && databaseId != null && (
        <PLUGIN_AI_SQL_GENERATION.GenerateSqlQueryButton
          className={CS.mt3}
          prompt={nativeEditorSelectedText}
          databaseId={databaseId}
          onGenerateQuery={onGenerateQuery}
        />
      )}
      {!!canRunQuery && (
        <RunButtonWithTooltip
          className={NativeQueryEditorSidebarS.RunButtonWithTooltipStyled}
          disabled={!isRunnable}
          isRunning={isRunning}
          isDirty={isResultDirty}
          onRun={runQuery}
          onCancel={cancelQuery}
          getTooltip={getTooltip}
        />
      )}
    </Box>
  );
};
