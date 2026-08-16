import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CryogenicGrinderIllustration } from "@/components/illustrations/cryogenic-grinder-illustration";

const testId = "cryogenic-grinder-illustration";

describe("CryogenicGrinderIllustration temperature readout", () => {
  it("shows no reading while the chamber is empty", () => {
    render(<CryogenicGrinderIllustration status="idle" testId={testId} />);

    const readout = screen.getByTestId("grinder-temperature-readout");
    expect(readout).toHaveTextContent("--°C");
    expect(readout).toHaveAttribute("data-tone", "none");
  });

  it("shows the loaded lot temperature instead of a hardcoded value", () => {
    render(<CryogenicGrinderIllustration status="idle" temperatureC={12.4} testId={testId} />);

    const readout = screen.getByTestId("grinder-temperature-readout");
    expect(readout).toHaveTextContent("12°C");
    expect(readout).toHaveAttribute("data-tone", "ambient");
  });

  it("shows a negative reading for a lot that is cooling down", () => {
    render(<CryogenicGrinderIllustration status="idle" temperatureC={-31.6} testId={testId} />);

    const readout = screen.getByTestId("grinder-temperature-readout");
    expect(readout).toHaveTextContent("-32°C");
    expect(readout).toHaveAttribute("data-tone", "cooling");
  });

  it("marks the readout cryogenic once the lot is cold enough to grind", () => {
    render(<CryogenicGrinderIllustration status="ready" temperatureC={-72} testId={testId} />);

    const readout = screen.getByTestId("grinder-temperature-readout");
    expect(readout).toHaveTextContent("-72°C");
    expect(readout).toHaveAttribute("data-tone", "cryogenic");
  });

  it("never reports a temperature colder than dry ice can reach", () => {
    render(<CryogenicGrinderIllustration status="running" temperatureC={-78.5} testId={testId} />);

    expect(screen.getByTestId("grinder-temperature-readout")).toHaveTextContent("-78°C");
    expect(screen.queryByText("-196°C")).not.toBeInTheDocument();
  });
});
