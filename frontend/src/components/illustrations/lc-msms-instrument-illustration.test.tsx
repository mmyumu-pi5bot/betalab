import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LcMsMsInstrumentIllustration } from "@/components/illustrations/lc-msms-instrument-illustration";

describe("LcMsMsInstrumentIllustration autosampler tray", () => {
  it("shows an empty tray while no rack is loaded", () => {
    render(<LcMsMsInstrumentIllustration loadedRackPositions={null} status="idle" />);

    expect(screen.queryAllByTestId("autosampler-vial")).toHaveLength(0);
  });

  it("shows the vials the loaded rack actually holds", () => {
    render(
      <LcMsMsInstrumentIllustration loadedRackPositions={[2, 5, 11]} status="ready" />,
    );

    expect(screen.getAllByTestId("autosampler-vial")).toHaveLength(3);
  });
});
