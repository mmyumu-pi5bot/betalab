import { beforeEach, describe, expect, it } from "vitest";

import {
  clearTutorialSession,
  getTutorialSession,
  getTutorialSessions,
  saveTutorialSession,
} from "@/lib/tutorial-session-store";

describe("tutorial session store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists durable quest milestones for the dedicated experiment", () => {
    saveTutorialSession({
      tutorialId: "calibration-sample-v1",
      experimentId: "experiment_1",
      status: "active",
      completedStepIds: ["weigh-received-sample"],
    });

    expect(getTutorialSession("calibration-sample-v1", "experiment_1")).toEqual({
      tutorialId: "calibration-sample-v1",
      experimentId: "experiment_1",
      status: "active",
      completedStepIds: ["weigh-received-sample"],
      version: 1,
    });
  });

  it("keeps milestones when the session is paused without resupplying them", () => {
    saveTutorialSession({
      tutorialId: "calibration-sample-v1",
      experimentId: "experiment_1",
      status: "active",
      completedStepIds: ["weigh-received-sample", "register-and-label-sample"],
    });

    saveTutorialSession({
      tutorialId: "calibration-sample-v1",
      experimentId: "experiment_1",
      status: "paused",
    });

    expect(
      getTutorialSession("calibration-sample-v1", "experiment_1")?.completedStepIds,
    ).toEqual([
      "weigh-received-sample",
      "register-and-label-sample",
    ]);
  });

  it("keeps independent progress for multiple experiments using the same tutorial", () => {
    saveTutorialSession({
      tutorialId: "calibration-sample-v1",
      experimentId: "experiment_1",
      status: "paused",
      completedStepIds: ["weigh-received-sample"],
    });
    saveTutorialSession({
      tutorialId: "calibration-sample-v1",
      experimentId: "experiment_2",
      status: "active",
      completedStepIds: ["weigh-received-sample", "register-and-label-sample"],
    });

    expect(getTutorialSessions("calibration-sample-v1")).toHaveLength(2);
    expect(
      getTutorialSession("calibration-sample-v1", "experiment_1")?.completedStepIds,
    ).toEqual(["weigh-received-sample"]);
    expect(
      getTutorialSession("calibration-sample-v1", "experiment_2")?.completedStepIds,
    ).toEqual(["weigh-received-sample", "register-and-label-sample"]);
  });

  it("removes only the requested experiment tutorial session", () => {
    saveTutorialSession({
      tutorialId: "calibration-sample-v1",
      experimentId: "experiment_1",
      status: "paused",
    });
    saveTutorialSession({
      tutorialId: "calibration-sample-v1",
      experimentId: "experiment_2",
      status: "paused",
    });

    clearTutorialSession("calibration-sample-v1", "experiment_1");

    expect(getTutorialSession("calibration-sample-v1", "experiment_1")).toBeNull();
    expect(getTutorialSession("calibration-sample-v1", "experiment_2")).not.toBeNull();
  });

  it("persists an abandoned tutorial after the learner chooses an irreversible action", () => {
    saveTutorialSession({
      tutorialId: "calibration-sample-v1",
      experimentId: "experiment_1",
      status: "abandoned",
      completedStepIds: ["weigh-received-sample"],
    });

    expect(getTutorialSession("calibration-sample-v1", "experiment_1")).toMatchObject({
      status: "abandoned",
      completedStepIds: ["weigh-received-sample"],
    });
  });

  it("persists a completed tutorial the learner left for free mode", () => {
    saveTutorialSession({
      tutorialId: "calibration-sample-v1",
      experimentId: "experiment_1",
      status: "completed",
      completedStepIds: ["weigh-received-sample"],
    });

    expect(getTutorialSession("calibration-sample-v1", "experiment_1")).toMatchObject({
      status: "completed",
      completedStepIds: ["weigh-received-sample"],
    });
  });

  it("reads the legacy single-session format without losing progress", () => {
    window.localStorage.setItem(
      "betalab:tutorial-sessions:v1",
      JSON.stringify({
        "calibration-sample-v1": {
          tutorialId: "calibration-sample-v1",
          experimentId: "legacy_experiment",
          status: "paused",
          completedStepIds: ["weigh-received-sample"],
          version: 1,
        },
      }),
    );

    expect(
      getTutorialSession("calibration-sample-v1", "legacy_experiment"),
    ).toMatchObject({
      experimentId: "legacy_experiment",
      completedStepIds: ["weigh-received-sample"],
    });
  });
});
