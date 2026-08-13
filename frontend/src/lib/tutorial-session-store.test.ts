import { beforeEach, describe, expect, it } from "vitest";

import {
  clearTutorialSession,
  getTutorialSession,
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

    expect(getTutorialSession("calibration-sample-v1")).toEqual({
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

    expect(getTutorialSession("calibration-sample-v1")?.completedStepIds).toEqual([
      "weigh-received-sample",
      "register-and-label-sample",
    ]);
  });

  it("removes only the requested tutorial session", () => {
    saveTutorialSession({
      tutorialId: "calibration-sample-v1",
      experimentId: "experiment_1",
      status: "paused",
    });

    clearTutorialSession("calibration-sample-v1");

    expect(getTutorialSession("calibration-sample-v1")).toBeNull();
  });
});
