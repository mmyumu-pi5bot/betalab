import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TemperatureIndicator } from "@/components/temperature-indicator";

describe("TemperatureIndicator", () => {
  it("lowers the thermometer column as the produce gets colder", () => {
    const { rerender } = render(<TemperatureIndicator temperatureC={12} />);

    const warmFill = screen.getByTestId("temperature-indicator-fill");
    const warmHeight = Number.parseFloat(warmFill.style.height);

    rerender(<TemperatureIndicator temperatureC={-20} />);

    const coldFill = screen.getByTestId("temperature-indicator-fill");
    const coldHeight = Number.parseFloat(coldFill.style.height);

    expect(warmHeight).toBeGreaterThan(coldHeight);
    expect(warmHeight).toBeGreaterThan(90);
    expect(coldHeight).toBeLessThan(60);
  });

  it("keeps the status label in the tooltip instead of inline text", () => {
    render(<TemperatureIndicator temperatureC={-20} />);

    expect(screen.getByText("-20.0°C")).toBeInTheDocument();
    expect(screen.queryByText("Cooling fast")).not.toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Cooling fast • -20.0 C");
  });

  it("describes elevated temperatures as hot rather than cooling", () => {
    render(<TemperatureIndicator temperatureC={64.5} />);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Hot • 64.5 C");
  });
});
