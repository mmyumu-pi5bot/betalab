export const TUTORIAL_SESSION_STORAGE_KEY = "betalab:tutorial-sessions:v1";

export type TutorialSessionStatus = "active" | "paused";

export type TutorialSession = {
  tutorialId: string;
  experimentId: string;
  status: TutorialSessionStatus;
  completedStepIds: string[];
  version: 1;
};

type TutorialSessionMap = Record<string, TutorialSession>;

function readSessions(): TutorialSessionMap {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(TUTORIAL_SESSION_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as TutorialSessionMap) : {};
  } catch {
    return {};
  }
}

function writeSessions(sessions: TutorialSessionMap) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(TUTORIAL_SESSION_STORAGE_KEY, JSON.stringify(sessions));
}

export function getTutorialSession(tutorialId: string): TutorialSession | null {
  const session = readSessions()[tutorialId];
  if (
    !session ||
    session.version !== 1 ||
    session.tutorialId !== tutorialId ||
    typeof session.experimentId !== "string" ||
    (session.status !== "active" && session.status !== "paused")
  ) {
    return null;
  }
  return {
    ...session,
    completedStepIds: Array.isArray(session.completedStepIds)
      ? session.completedStepIds.filter((stepId): stepId is string => typeof stepId === "string")
      : [],
  };
}

export function saveTutorialSession(
  session: Omit<TutorialSession, "version" | "completedStepIds"> & {
    completedStepIds?: string[];
  },
): TutorialSession {
  const sessions = readSessions();
  const previous = sessions[session.tutorialId];
  const persisted: TutorialSession = {
    ...session,
    completedStepIds:
      session.completedStepIds ??
      (previous?.experimentId === session.experimentId && Array.isArray(previous.completedStepIds)
        ? previous.completedStepIds
        : []),
    version: 1,
  };
  writeSessions({ ...sessions, [session.tutorialId]: persisted });
  return persisted;
}

export function clearTutorialSession(tutorialId: string) {
  const sessions = readSessions();
  delete sessions[tutorialId];
  writeSessions(sessions);
}
