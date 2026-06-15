import * as React from "react";
import comingSoonImage from "../assets/comingSoon.png";
import { useData } from "../appLayout/AppContext";
import {
  FeatureFlag,
  isFeatureComingSoon,
  isFeatureEnabled,
  isFeatureHidden,
} from "@utils/featureFlag";
import "./FeatureGate.css";

type FeatureGateProps = {
  flag: FeatureFlag;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

const FeatureGate: React.FC<FeatureGateProps> = ({
  flag,
  children,
  fallback = null,
}) => {
  const { darkMode } = useData();

  if (isFeatureEnabled(flag)) {
    return <>{children}</>;
  }

  if (isFeatureHidden(flag)) {
    return <>{fallback}</>;
  }

  if (isFeatureComingSoon(flag)) {
    return (
      <>
        <div
          className="feature-gate__overlay"
          style={darkMode ? { background: "rgba(41, 41, 41, 0.6)" } : {}}
        >
          <img src={comingSoonImage} alt="Coming Soon" />
        </div>
        {children}
      </>
    );
  }

  return <>{children}</>;
};

export { FeatureGate };
