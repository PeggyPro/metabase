import type {
  PinDropTargetProps,
  PinDropTargetRenderArgs,
} from "./PinnedItemSortDropTarget.styled";
import {
  PinDropTargetIndicator,
  StyledPinDropTarget,
} from "./PinnedItemSortDropTarget.styled";

function PinnedItemSortDropTarget(props: PinDropTargetProps) {
  return (
    <StyledPinDropTarget {...props}>
      {(args: PinDropTargetRenderArgs) => <PinDropTargetIndicator {...args} />}
    </StyledPinDropTarget>
  );
}

// eslint-disable-next-line import/no-default-export -- deprecated usage
export default PinnedItemSortDropTarget;
