import { useCallback, useLayoutEffect, useState } from "react";

import { useToggle } from "metabase/hooks/use-toggle";
import { ExpressionWidget } from "metabase/query_builder/components/expressions/ExpressionWidget";
import { ExpressionWidgetHeader } from "metabase/query_builder/components/expressions/ExpressionWidgetHeader";
import * as Lib from "metabase-lib";

import {
  FilterColumnPicker,
  type FilterColumnPickerProps,
} from "./FilterColumnPicker";
import { FilterPickerBody } from "./FilterPickerBody";
import type { ColumnListItem, SegmentListItem } from "./types";

export type FilterPickerProps = {
  className?: string;
  query: Lib.Query;
  stageIndex: number;
  filter?: Lib.FilterClause;
  filterIndex?: number;

  onSelect: (filter: Lib.Filterable) => void;
  onClose?: () => void;
  onBack?: () => void;
} & Pick<
  FilterColumnPickerProps,
  "withColumnItemIcon" | "withColumnGroupIcon" | "withCustomExpression"
>;

export function FilterPicker({
  className,
  query,
  stageIndex,
  filter: initialFilter,
  filterIndex,
  onSelect,
  onClose,
  onBack,
  withColumnItemIcon,
  withColumnGroupIcon,
  withCustomExpression,
}: FilterPickerProps) {
  const [filter, setFilter] = useState(initialFilter);

  const [column, setColumn] = useState(
    getInitialColumn(query, stageIndex, filter),
  );

  const [
    isEditingExpression,
    { turnOn: openExpressionEditor, turnOff: closeExpressionEditor },
  ] = useToggle(isExpressionEditorInitiallyOpen(query, stageIndex, filter));

  const isNewFilter = !initialFilter;

  useLayoutEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  const handleChange = (filter: Lib.Filterable) => {
    onSelect(filter);
    onClose?.();
  };

  const handleBack = () => {
    setColumn(undefined);
    onBack?.();
  };

  const handleColumnSelect = (column: Lib.ColumnMetadata) => {
    setColumn(column);
    setFilter(undefined);
  };

  const checkItemIsSelected = useCallback(
    (item: ColumnListItem | SegmentListItem) => {
      return Boolean(
        filterIndex != null && item.filterPositions?.includes?.(filterIndex),
      );
    },
    [filterIndex],
  );

  const handleClauseChange = useCallback(
    (_name: string, clause: Lib.ExpressionClause | Lib.FilterClause) => {
      onSelect(clause);
      onClose?.();
    },
    [onSelect, onClose],
  );

  const renderExpressionEditor = () => (
    <ExpressionWidget
      query={query}
      stageIndex={stageIndex}
      clause={filter}
      startRule="boolean"
      header={<ExpressionWidgetHeader onBack={closeExpressionEditor} />}
      onChangeClause={handleClauseChange}
      onClose={closeExpressionEditor}
    />
  );

  if (isEditingExpression) {
    return renderExpressionEditor();
  }

  if (!column) {
    return (
      <FilterColumnPicker
        className={className}
        query={query}
        stageIndex={stageIndex}
        checkItemIsSelected={checkItemIsSelected}
        onColumnSelect={handleColumnSelect}
        onSegmentSelect={handleChange}
        onExpressionSelect={openExpressionEditor}
        withColumnGroupIcon={withColumnGroupIcon}
        withColumnItemIcon={withColumnItemIcon}
        withCustomExpression={withCustomExpression}
      />
    );
  }

  return (
    <FilterPickerBody
      query={query}
      stageIndex={stageIndex}
      column={column}
      filter={filter}
      isNew={isNewFilter}
      onChange={handleChange}
      onBack={handleBack}
    />
  );
}

function getInitialColumn(
  query: Lib.Query,
  stageIndex: number,
  filter?: Lib.FilterClause,
) {
  return filter
    ? Lib.filterParts(query, stageIndex, filter)?.column
    : undefined;
}

function isExpressionEditorInitiallyOpen(
  query: Lib.Query,
  stageIndex: number,
  filter?: Lib.FilterClause,
) {
  return (
    filter != null &&
    !Lib.isStandardFilter(query, stageIndex, filter) &&
    !Lib.isSegmentFilter(query, stageIndex, filter)
  );
}
