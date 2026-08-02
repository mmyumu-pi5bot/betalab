import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DebugProducePalette } from "@/components/debug-produce-palette";

describe("DebugProducePalette", () => {
  it("collapses and expands its contents when the header is clicked", () => {
    render(<DebugProducePalette presets={[]} />);

    const header = screen.getByRole("button", { name: "Debug Palette" });
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("debug-palette-content")).toBeInTheDocument();

    fireEvent.click(header);

    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("debug-palette-content")).not.toBeInTheDocument();

    fireEvent.click(header);

    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("debug-palette-content")).toBeInTheDocument();
  });
});
