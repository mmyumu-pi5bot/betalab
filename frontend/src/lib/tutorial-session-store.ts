const TUTORIAL_SESSION_STORAGE_KEY = "betalab:tutorial-sessions:v1";

// "completed" is a deliberate exit: the learner finished the tutorial and switched
// the experiment to free mode, so the coach must not come back on its own.
export type TutorialSessionStatus = "abandoned" | "active" | "completed" | "paused";

const tutorialSessionStatuses: readonly TutorialSessionStatus[] = [
  "abandoned",
  "active",
  "completed",
  "paused",
];

export type TutorialSession = {
  tutorialId: string;
  experimentId: string;
  status: TutorialSessionStatus;
  completedStepIds: string[];
  version: 1;
};

type TutorialSessionMap = Record<string, TutorialSession>;

function tutorialSessionKey(tutorialId: string, experimentId: string) {
  return `${tutorialId}::${experimentId}`;
}

function normalizeTutorialSession(value: unknown): TutorialSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const session = value as Partial<TutorialSession>;
  if (
    session.version !== 1 ||
    typeof session.tutorialId !== "string" ||
    typeof session.experimentId !== "string" ||
    !session.status ||
    !tutorialSessionStatuses.includes(session.status)
  ) {
    return null;
  }
  return {
    tutorialId: session.tutorialId,
    experimentId: session.experimentId,
    status: session.status,
    completedStepIds: Array.isArray(session.completedStepIds)
      ? session.completedStepIds.filter((stepId): stepId is string => typeof stepId === "string")
      : [],
    version: 1,
  };
}

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
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return Object.values(parsed).reduce<TutorialSessionMap>((sessions, value) => {
      const session = normalizeTutorialSession(value);
      if (session) {
        sessions[tutorialSessionKey(session.tutorialId, session.experimentId)] = session;
      }
      return sessions;
    }, {});
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

export function getTutorialSession(
  tutorialId: string,
  experimentId: string,
): TutorialSession | null {
  return readSessions()[tutorialSessionKey(tutorialId, experimentId)] ?? null;
}

// Ongoing sessions are the ones the coach still owns: abandoned and completed
// sessions both hand the experiment back to free mode.
export function isTutorialSessionOngoing(session: TutorialSession) {
  return session.status === "active" || session.status === "paused";
}

export function getTutorialSessions(tutorialId: string): TutorialSession[] {
  return Object.values(readSessions()).filter(
    (session) => session.tutorialId === tutorialId,
  );
}

export function saveTutorialSession(
  session: Omit<TutorialSession, "version" | "completedStepIds"> & {
    completedStepIds?: string[];
  },
): TutorialSession {
  const sessions = readSessions();
  const key = tutorialSessionKey(session.tutorialId, session.experimentId);
  const previous = sessions[key];
  const persisted: TutorialSession = {
    ...session,
    completedStepIds:
      session.completedStepIds ??
      (previous && Array.isArray(previous.completedStepIds)
        ? previous.completedStepIds
        : []),
    version: 1,
  };
  writeSessions({ ...sessions, [key]: persisted });
  return persisted;
}

export function clearTutorialSession(tutorialId: string, experimentId: string) {
  const sessions = readSessions();
  delete sessions[tutorialSessionKey(tutorialId, experimentId)];
  writeSessions(sessions);
}
