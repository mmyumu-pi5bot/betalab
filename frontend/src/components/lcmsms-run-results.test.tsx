import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LcMsMsRunResults } from "@/components/lcmsms-run-results";
import { acquisitionMethodFixture } from "@/test-support/acquisition-method-fixture";
import type {
  InjectionMeasurement,
  MrmTransition,
  SequenceRun,
  TransitionTrace,
} from "@/types/workbench";

function makeTrace(
  transition: MrmTransition,
  peakHeight: number,
  overrides: Partial<TransitionTrace["acquisition"]> = {},
): TransitionTrace {
  const timesS = Array.from({ length: 40 }, (_, index) => index * 18);
  const centre = transition.expectedRetentionTimeS;
  return {
    injectionId: "inj_1",
    transition,
    timesS,
    intensities: timesS.map((time) => {
      const offset = time - centre;
      return 120 + peakHeight * Math.exp(-(offset * offset) / (2 * 9 * 9));
    }),
    acquisition: {
      runDurationS: 720,
      pointCount: timesS.length,
      samplingIntervalS: 18,
      dwellTimeMs: transition.dwellTimeMs,
      polarity: transition.polarity,
      matchedReferenceTransition: true,
      acquiredInRetentionWindow: true,
      ...overrides,
    },
  };
}

function makeInjection(overrides: Partial<InjectionMeasurement> = {}): InjectionMeasurement {
  const [quantifier, qualifier, istd] = acquisitionMethodFixture.transitions;
  return {
    id: "inj_1",
    vialId: "vial_1",
    vialLabel: "Sample vial",
    rackSlotId: "rack_slot_1",
    status: "ok",
    sampleName: "Apple A",
    injectionVolumeUl: 5,
    replicateIndex: 1,
    outputFilename: "01_apple_a.mzML",
    traces: [
      makeTrace(quantifier, 20000),
      makeTrace(qualifier, 7000),
      makeTrace(istd, 12000),
    ],
    ...overrides,
  };
}

function makeRun(overrides: Partial<SequenceRun> = {}): SequenceRun {
  return {
    id: "seq_1",
    methodId: acquisitionMethodFixture.id,
    methodSnapshot: acquisitionMethodFixture,
    injections: [makeInjection()],
    ...overrides,
  };
}

describe("LcMsMsRunResults", () => {
  it("invites the technician to run a sequence when there is none", () => {
    render(<LcMsMsRunResults runs={[]} />);

    expect(screen.getByText(/no sequence has been run yet/i)).toBeInTheDocument();
  });

  it("summarises the run with the method it was acquired with", () => {
    render(<LcMsMsRunResults runs={[makeRun()]} />);

    const summary = screen.getByTestId("run-summary");
    expect(summary).toHaveTextContent("seq_1");
    expect(summary).toHaveTextContent("1 injection");
    expect(summary).toHaveTextContent("Apple pesticides — MRM");
    expect(summary).toHaveTextContent("v1.0.0");
  });

  it("renders one chromatogram per recorded transition", () => {
    render(<LcMsMsRunResults runs={[makeRun()]} />);

    const chromatograms = screen.getAllByTestId("transition-chromatogram");
    expect(chromatograms).toHaveLength(3);
    expect(within(chromatograms[0]).getByText(/Boscalid/)).toBeInTheDocument();
    expect(within(chromatograms[0]).getByText(/343 → 307/)).toBeInTheDocument();
    expect(within(chromatograms[0]).getByText("Quantifier")).toBeInTheDocument();
    expect(within(chromatograms[1]).getByText("Qualifier")).toBeInTheDocument();
  });

  it("draws the trace as a polyline over the run duration", () => {
    const { container } = render(<LcMsMsRunResults runs={[makeRun()]} />);

    const polyline = container.querySelector(
      "[data-testid='transition-chromatogram'] polyline",
    );
    expect(polyline).not.toBeNull();
    expect(polyline?.getAttribute("points")?.split(" ").length).toBe(40);
  });

  it("reports the apex intensity actually sampled on each channel", () => {
    const injection = makeInjection();
    // The grid does not land exactly on the peak centre, so the apex is the
    // highest recorded point, not the theoretical peak height.
    const expectedApex = Math.round(Math.max(...injection.traces[0].intensities));
    render(<LcMsMsRunResults runs={[makeRun({ injections: [injection] })]} />);

    const chromatograms = screen.getAllByTestId("transition-chromatogram");
    expect(within(chromatograms[0]).getByTestId("trace-apex")).toHaveTextContent(
      String(expectedApex),
    );
    expect(expectedApex).toBeGreaterThan(1000);
  });

  it("explains a flat channel whose masses match nothing", () => {
    const [quantifier] = acquisitionMethodFixture.transitions;
    const run = makeRun({
      injections: [
        makeInjection({
          traces: [
            makeTrace(quantifier, 0, { matchedReferenceTransition: false }),
          ],
        }),
      ],
    });

    render(<LcMsMsRunResults runs={[run]} />);

    expect(screen.getByTestId("trace-warning")).toHaveTextContent(
      /no compound responds at this Q1\/Q3 pair/i,
    );
  });

  it("explains a flat channel whose retention window missed the peak", () => {
    const [quantifier] = acquisitionMethodFixture.transitions;
    const run = makeRun({
      injections: [
        makeInjection({
          traces: [
            makeTrace(quantifier, 0, { acquiredInRetentionWindow: false }),
          ],
        }),
      ],
    });

    render(<LcMsMsRunResults runs={[run]} />);

    expect(screen.getByTestId("trace-warning")).toHaveTextContent(
      /retention window does not cover/i,
    );
  });

  it("flags an injection that carried no extract", () => {
    const run = makeRun({
      injections: [makeInjection({ status: "no_extract_context", traces: [] })],
    });

    render(<LcMsMsRunResults runs={[run]} />);

    expect(screen.getByText(/no injectable content/i)).toBeInTheDocument();
  });

  it("lets the technician switch between injections", () => {
    const run = makeRun({
      injections: [
        makeInjection({ id: "inj_1", sampleName: "Apple A" }),
        makeInjection({ id: "inj_2", sampleName: "Cal 10", rackSlotId: "rack_slot_2" }),
      ],
    });

    render(<LcMsMsRunResults runs={[run]} />);

    expect(screen.getByTestId("injection-panel")).toHaveTextContent("Apple A");

    fireEvent.click(screen.getByRole("tab", { name: /Cal 10/ }));

    expect(screen.getByTestId("injection-panel")).toHaveTextContent("Cal 10");
  });

  it("shows no concentration, no recovery and no calibration curve", () => {
    const { container } = render(<LcMsMsRunResults runs={[makeRun()]} />);

    const text = container.textContent ?? "";
    expect(text).not.toMatch(/µg\/kg/);
    expect(text).not.toMatch(/calculated/i);
    expect(text).not.toMatch(/recovery/i);
    expect(text).not.toMatch(/calibration curve/i);
  });
});
