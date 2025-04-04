import type React from "react";

import { PublicComponentWrapper } from "./PublicComponentWrapper";

export function withPublicComponentWrapper<P extends object>(
  WrappedComponent: React.ComponentType<P>,
): React.FC<P> {
  const WithPublicComponentWrapper: React.FC<P> = (props) => {
    return (
      <PublicComponentWrapper>
        <WrappedComponent {...props} />
      </PublicComponentWrapper>
    );
  };

  WithPublicComponentWrapper.displayName = `withPublicComponentWrapper(${
    WrappedComponent.displayName || WrappedComponent.name || "Component"
  })`;

  return WithPublicComponentWrapper;
}
