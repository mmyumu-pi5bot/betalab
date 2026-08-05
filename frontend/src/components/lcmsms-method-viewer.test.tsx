import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LcMsMsMethodViewer } from "@/components/lcmsms-method-viewer";
import type { AcquisitionMethod } from "@/types/workbench";

function makeMethod(overrides: Partial<AcquisitionMethod> = {}): AcquisitionMethod {
  return {
    id: "apple_pesticides_mrm_v1",
    name: "Apple pesticides — MRM",
    version: "1.0.0",
    runtimeS: 720,
    isEducational: true,
    provenanceNote: "Educational method. Values are placeholders authored for Betalab.",
    isBuiltIn: true,
    liquidChromatography: {
      columnLabel: "C18 reversed phase, 100 x 2.1 mm, 1.8 µm",
      columnTemperatureC: 40,
      mobilePhaseA: "Water + 0.1 % formic acid",
      mobilePhaseB: "Methanol + 0.1 % formic acid",
      flowMlPerMin: 0.4,
      gradient: [
        { timeS: 0, mobilePhaseBPercent: 5 },
        { timeS: 480, mobilePhaseBPercent: 95 },
      ],
    },
    ionSource: {
      sourceType: "Heated electrospray (ESI)",
      ionSprayVoltageV: 4500,
      sourceTemperatureC: 450,
      nebulizerGasPsi: 50,
      heaterGasPsi: 55,
      curtainGasPsi: 30,
    },
    transitions: [
      {
        id: "boscalid__quantifier",
        compoundId: "boscalid",
        compoundLabel: "Boscalid",
        compoundKind: "analyte",
        q1Mz: 343,
        q3Mz: 307,
        polarity: "positive",
        role: "quantifier",
        collisionEnergyV: 24,
        dwellTimeMs: 25,
        expectedRetentionTimeS: 402,
        retentionWindowS: 60,
        internalStandardId: "istd_triphenyl_phosphate_d15",
        provenance: "educational_placeholder",
      },
      {
        id: "boscalid__qualifier",
        compoundId: "boscalid",
        compoundLabel: "Boscalid",
        compoundKind: "analyte",
        q1Mz: 343,
        q3Mz: 271.1,
        polarity: "positive",
        role: "qualifier",
        collisionEnergyV: 33,
        dwellTimeMs: 25,
        expectedRetentionTimeS: 402,
        retentionWindowS: 60,
        internalStandardId: "istd_triphenyl_phosphate_d15",
        provenance: "educational_placeholder",
      },
      {
        id: "acetamiprid__quantifier",
        compoundId: "acetamiprid",
        compoundLabel: "Acetamiprid",
        compoundKind: "analyte",
        q1Mz: 223.1,
        q3Mz: 126,
        polarity: "positive",
        role: "quantifier",
        collisionEnergyV: 22,
        dwellTimeMs: 25,
        expectedRetentionTimeS: 204,
        retentionWindowS: 60,
        internalStandardId: "istd_triphenyl_phosphate_d15",
        provenance: "educational_placeholder",
      },
    ],
    ...overrides,
  };
}

describe("LcMsMsMethodViewer", () => {
  it("shows the method identity, runtime and size", () => {
    render(<LcMsMsMethodViewer error={null} isLoading={false} method={makeMethod()} />);

    expect(screen.getByText(/Apple pesticides — MRM/)).toBeInTheDocument();
    expect(screen.getByText(/v1\.0\.0/)).toBeInTheDocument();
    expect(screen.getByTestId("method-runtime")).toHaveTextContent("12:00");
    expect(screen.getByTestId("method-compound-count")).toHaveTextContent("2");
    expect(screen.getByTestId("method-transition-count")).toHaveTextContent("3");
  });

  it("shows the main LC and source parameters", () => {
    render(<LcMsMsMethodViewer error={null} isLoading={false} method={makeMethod()} />);

    const chromatography = screen.getByTestId("method-lc-parameters");
    expect(chromatography).toHaveTextContent("C18 reversed phase");
    expect(chromatography).toHaveTextContent("0.4 mL/min");
    expect(chromatography).toHaveTextContent("40 °C");
    expect(chromatography).toHaveTextContent("Methanol + 0.1 % formic acid");

    const source = screen.getByTestId("method-source-parameters");
    expect(source).toHaveTextContent("Heated electrospray (ESI)");
    expect(source).toHaveTextContent("4500 V");
    expect(source).toHaveTextContent("450 °C");
  });

  it("lists every transition with its analytical columns", () => {
    render(<LcMsMsMethodViewer error={null} isLoading={false} method={makeMethod()} />);

    const rows = screen.getAllByTestId("method-transition-row");
    expect(rows).toHaveLength(3);

    const quantifier = within(rows[0]);
    expect(quantifier.getByText("Boscalid")).toBeInTheDocument();
    expect(quantifier.getByText("Quantifier")).toBeInTheDocument();
    expect(quantifier.getByText("343")).toBeInTheDocument();
    expect(quantifier.getByText("307")).toBeInTheDocument();
    expect(quantifier.getByText("+")).toBeInTheDocument();
    expect(quantifier.getByText("24")).toBeInTheDocument();
    expect(quantifier.getByText("25")).toBeInTheDocument();
    expect(quantifier.getByText("6:42")).toBeInTheDocument();

    expect(within(rows[1]).getByText("Qualifier")).toBeInTheDocument();
  });

  it("explains Q1, Q3, collision energy, dwell time, quantifier and qualifier", () => {
    render(<LcMsMsMethodViewer error={null} isLoading={false} method={makeMethod()} />);

    const glossary = screen.getByTestId("method-glossary");
    for (const term of [
      "Q1",
      "Q3",
      "Collision energy",
      "Dwell time",
      "Quantifier",
      "Qualifier",
    ]) {
      expect(within(glossary).getByText(term)).toBeInTheDocument();
    }
    expect(glossary).toHaveTextContent(/precursor/i);
    expect(glossary).toHaveTextContent(/product ion/i);
    expect(glossary).toHaveTextContent(/confirm/i);
  });

  it("flags an educational method and surfaces its provenance", () => {
    render(<LcMsMsMethodViewer error={null} isLoading={false} method={makeMethod()} />);

    expect(screen.getByTestId("method-educational-badge")).toBeInTheDocument();
    expect(screen.getByTestId("method-provenance")).toHaveTextContent(
      /placeholders authored for Betalab/,
    );
  });

  it("states that a built-in method is read-only and renders no editable control", () => {
    const { container } = render(
      <LcMsMsMethodViewer error={null} isLoading={false} method={makeMethod()} />,
    );

    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    expect(container.querySelectorAll("input, select, textarea")).toHaveLength(0);
  });

  it("renders a loading state while the method is being fetched", () => {
    render(<LcMsMsMethodViewer error={null} isLoading method={null} />);

    expect(screen.getByText(/loading the method/i)).toBeInTheDocument();
  });

  it("renders the error when the method cannot be loaded", () => {
    render(<LcMsMsMethodViewer error="Boom" isLoading={false} method={null} />);

    expect(screen.getByText("Boom")).toBeInTheDocument();
  });
});
