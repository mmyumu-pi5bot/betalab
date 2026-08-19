import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IceBathIllustration } from "@/components/illustrations/ice-bath-illustration";

describe("IceBathIllustration", () => {
  it("keeps its gradient ids unique so two instances do not fight over them", () => {
    // The palette icon and the canvas widget are on screen at the same time.
    // A shared id makes the browser resolve every fill against whichever SVG
    // comes first -- the hidden 0x0 palette one -- and the water vanishes.
    const { container } = render(
      <>
        <IceBathIllustration hasTube={false} />
        <IceBathIllustration hasTube />
      </>,
    );

    const ids = [...container.querySelectorAll("[id]")].map((node) => node.id);

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("paints every shape with a gradient that exists in its own svg", () => {
    const { container } = render(<IceBathIllustration hasTube />);

    const declared = new Set([...container.querySelectorAll("[id]")].map((node) => node.id));
    const referenced = [...container.querySelectorAll("*")]
      .map((node) => node.getAttribute("fill") ?? "")
      .filter((fill) => fill.startsWith("url("))
      .map((fill) => fill.slice(5, -1));

    expect(referenced.length).toBeGreaterThan(0);
    for (const reference of referenced) {
      expect(declared).toContain(reference);
    }
  });
});
