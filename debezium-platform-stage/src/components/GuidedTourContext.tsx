import React, { createContext, useContext, useState, useCallback } from "react";

export type TourMode = "basic" | "advanced" | null;

const WALKTHROUGH_STORAGE_KEY = "dbz-walkthrough-completed";
const WALKTHROUGH_MODE_KEY = "dbz-walkthrough-mode";
const TOUR_LEVEL_KEY = "dbz-tour-level";
const PAGE_TOURS_COMPLETED_KEY = "dbz-page-tours-completed";
const PAGE_TOURS_DISABLED_KEY = "dbz-page-tours-disabled";
const ALL_PAGE_TOUR_KEYS = [
  "source",
  "source-catalog",
  "create-source",
  "destination",
  "destination-catalog",
  "create-destination",
];

export const isWalkthroughCompleted = (): boolean => {
  return localStorage.getItem(WALKTHROUGH_STORAGE_KEY) === "true";
};

export const isWalkthroughDeferred = (): boolean => {
  return localStorage.getItem(WALKTHROUGH_STORAGE_KEY) === "deferred";
};

export const markWalkthroughCompleted = (): void => {
  localStorage.setItem(WALKTHROUGH_STORAGE_KEY, "true");
};

export const markWalkthroughDeferred = (): void => {
  localStorage.setItem(WALKTHROUGH_STORAGE_KEY, "deferred");
};

export const clearWalkthrough = (): void => {
  localStorage.removeItem(WALKTHROUGH_STORAGE_KEY);
  localStorage.removeItem(WALKTHROUGH_MODE_KEY);
};

export const getStoredTourMode = (): TourMode => {
  return localStorage.getItem(WALKTHROUGH_MODE_KEY) as TourMode;
};

export const setStoredTourMode = (mode: TourMode): void => {
  if (mode) {
    localStorage.setItem(WALKTHROUGH_MODE_KEY, mode);
  } else {
    localStorage.removeItem(WALKTHROUGH_MODE_KEY);
  }
};

// --- Tour level persistence (survives main tour completion) ---

export const getStoredTourLevel = (): TourMode => {
  return localStorage.getItem(TOUR_LEVEL_KEY) as TourMode;
};

export const setStoredTourLevel = (level: TourMode): void => {
  if (level) {
    localStorage.setItem(TOUR_LEVEL_KEY, level);
  } else {
    localStorage.removeItem(TOUR_LEVEL_KEY);
  }
};

// --- Page-specific tour tracking ---

const getCompletedPageTours = (): string[] => {
  try {
    const stored = localStorage.getItem(PAGE_TOURS_COMPLETED_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const markPageTourCompletedInStorage = (pageKey: string): void => {
  const completed = getCompletedPageTours();
  if (!completed.includes(pageKey)) {
    completed.push(pageKey);
    localStorage.setItem(PAGE_TOURS_COMPLETED_KEY, JSON.stringify(completed));
  }
};

const clearPageToursInStorage = (): void => {
  localStorage.removeItem(PAGE_TOURS_COMPLETED_KEY);
};

const setCompletedPageToursInStorage = (pageKeys: string[]): void => {
  localStorage.setItem(PAGE_TOURS_COMPLETED_KEY, JSON.stringify(pageKeys));
};

export const arePageToursDisabled = (): boolean => {
  return localStorage.getItem(PAGE_TOURS_DISABLED_KEY) === "true";
};

interface GuidedTourContextType {
  isTourActive: boolean;
  tourMode: TourMode;
  stepIndex: number;
  setTourActive: (active: boolean) => void;
  setTourMode: (mode: TourMode) => void;
  setStepIndex: (index: number) => void;
  replayTour: () => void;
  completeTour: () => void;
  deferTour: () => void;
  // Page-specific tours
  isAdvancedUser: boolean;
  isPageTourCompleted: (pageKey: string) => boolean;
  markPageTourCompleted: (pageKey: string) => void;
  skipAllPageTours: () => void;
}

const GuidedTourContext = createContext<GuidedTourContextType | undefined>(
  undefined
);

export const GuidedTourProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isTourActive, setIsTourActive] = useState<boolean>(
    () => !isWalkthroughCompleted()
  );
  const [tourMode, setTourModeState] = useState<TourMode>(
    () => getStoredTourMode()
  );
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [completedPageTours, setCompletedPageTours] = useState<string[]>(
    () => getCompletedPageTours()
  );
  const [isAdvancedUser, setIsAdvancedUser] = useState<boolean>(
    () => getStoredTourLevel() === "advanced"
  );

  const setTourActive = useCallback((active: boolean) => {
    setIsTourActive(active);
  }, []);

  const setTourMode = useCallback((mode: TourMode) => {
    setTourModeState(mode);
    setStoredTourMode(mode);
    // Persist the tour level choice permanently
    if (mode) {
      setStoredTourLevel(mode);
      setIsAdvancedUser(mode === "advanced");
    }
  }, []);

  const replayTour = useCallback(() => {
    clearWalkthrough();
    clearPageToursInStorage();
    localStorage.removeItem(PAGE_TOURS_DISABLED_KEY);
    setCompletedPageTours([]);
    setIsAdvancedUser(false);
    setTourModeState(null);
    setStepIndex(0);
    setIsTourActive(true);
  }, []);

  const completeTour = useCallback(() => {
    markWalkthroughCompleted();
    setIsTourActive(false);
    setTourModeState(null);
    setStepIndex(0);
  }, []);

  const deferTour = useCallback(() => {
    markWalkthroughDeferred();
    setIsTourActive(false);
    setTourModeState(null);
    setStepIndex(0);
  }, []);

  const isPageTourCompleted = useCallback(
    (pageKey: string) => completedPageTours.includes(pageKey),
    [completedPageTours]
  );

  const markPageTourCompleted = useCallback((pageKey: string) => {
    markPageTourCompletedInStorage(pageKey);
    setCompletedPageTours((prev) =>
      prev.includes(pageKey) ? prev : [...prev, pageKey]
    );
  }, []);

  const skipAllPageTours = useCallback(() => {
    localStorage.setItem(PAGE_TOURS_DISABLED_KEY, "true");
    setCompletedPageToursInStorage(ALL_PAGE_TOUR_KEYS);
    setCompletedPageTours(ALL_PAGE_TOUR_KEYS);
    markWalkthroughCompleted();
    setStoredTourLevel(null);
    setIsAdvancedUser(false);
  }, []);

  return (
    <GuidedTourContext.Provider
      value={{
        isTourActive,
        tourMode,
        stepIndex,
        setTourActive,
        setTourMode,
        setStepIndex,
        replayTour,
        completeTour,
        deferTour,
        isAdvancedUser,
        isPageTourCompleted,
        markPageTourCompleted,
        skipAllPageTours,
      }}
    >
      {children}
    </GuidedTourContext.Provider>
  );
};

export const useGuidedTour = (): GuidedTourContextType => {
  const context = useContext(GuidedTourContext);
  if (!context) {
    throw new Error("useGuidedTour must be used within a GuidedTourProvider");
  }
  return context;
};
