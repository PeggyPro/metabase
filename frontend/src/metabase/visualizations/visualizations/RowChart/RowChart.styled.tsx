// eslint-disable-next-line no-restricted-imports
import styled from "@emotion/styled";

import { LegendCaption } from "metabase/visualizations/components/legend/LegendCaption";
import { LegendLayout } from "metabase/visualizations/components/legend/LegendLayout";
import { getChartPadding } from "metabase/visualizations/visualizations/CartesianChart/padding";

interface RowVisualizationRootProps {
  isQueryBuilder: boolean;
}

export const RowVisualizationRoot = styled.div<RowVisualizationRootProps>`
  display: flex;
  flex-direction: column;
  padding: ${getChartPadding};
  overflow: hidden;
`;

export const RowLegendCaption = styled(LegendCaption)`
  flex: 0 0 auto;
  margin-bottom: 0.5rem;
`;

export const RowChartContainer = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  left: 0;
`;

export const RowChartLegendLayout = styled(LegendLayout)`
  height: 100%;
`;
