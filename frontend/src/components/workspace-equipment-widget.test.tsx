import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppleIllustration } from "@/components/illustrations/apple-illustration";
import { AutosamplerRackIllustration } from "@/components/illustrations/autosampler-rack-illustration";
import { CryogenicGrinderIllustration } from "@/components/illustrations/cryogenic-grinder-illustration";
import { ItemCountBadge } from "@/components/item-count-badge";
import { LabAssetIcon } from "@/components/icons/lab-asset-icon";
import { LcMsMsInstrumentIllustration } from "@/components/illustrations/lc-msms-instrument-illustration";
import { ProduceBasketIllustration } from "@/components/illustrations/produce-basket-illustration";
import { WorkspaceEquipmentWidget } from "@/components/workspace-equipment-widget";

describe("workspace equipment illustrations", () => {
  it("renders powder above the liquid surface inside a sample vial", () => {
    render(
      <LabAssetIcon
        accent="sky"
        className="h-22 w-16"
        fillRatio={0.5}
        kind="sample_vial"
        powderMassG={1.2}
      />,
    );

    const icon = screen.getByLabelText("sample vial").parentElement;
    const liquidLayer = icon?.querySelector("path[fill='#38bdf8']");
    const powderLayer = icon?.querySelector("[data-powder-layer='true']");
    const liquidTopY = Number(liquidLayer?.getAttribute("d")?.match(/^M\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)/)?.[1]);
    const powderTopY = Number(powderLayer?.getAttribute("d")?.match(/^M\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)/)?.[1]);

    expect(liquidLayer).toBeTruthy();
    expect(powderLayer).toBeTruthy();
    expect(powderTopY).toBeLessThan(liquidTopY);
    expect(powderTopY).toBeGreaterThan(34);
  });

  it("renders rack occupancy as data attributes", () => {
    render(
      <AutosamplerRackIllustration
        occupiedSlotLiquids={{
          1: [
            {
              accent: "rose",
              id: "bench_liquid_1",
              liquidId: "apple_extract",
              name: "Apple extract",
              volume_ml: 1,
            },
          ],
          3: [
            {
              accent: "emerald",
              id: "bench_liquid_2",
              liquidId: "matrix_blank",
              name: "Matrix blank",
              volume_ml: 1,
            },
          ],
          5: [],
          4: [
            {
              accent: "amber",
              id: "bench_liquid_3",
              liquidId: "acetonitrile_extraction",
              name: "Acetonitrile",
              volume_ml: 1,
            },
            {
              accent: "sky",
              id: "bench_liquid_4",
              liquidId: "ultrapure_water_rinse",
              name: "Ultrapure water",
              volume_ml: 1,
            },
          ],
        }}
        occupiedSlots={[1, 3, 4, 5]}
        testId="autosampler-rack-illustration"
        tone="active"
      />,
    );

    expect(screen.getByTestId("autosampler-rack-illustration")).toHaveAttribute(
      "data-occupied-count",
      "4",
    );
    expect(screen.getByTestId("autosampler-rack-illustration")).toHaveAttribute(
      "data-tone",
      "active",
    );
    expect(screen.getByTestId("autosampler-rack-illustration-slot-liquid-1")).toHaveAttribute(
      "fill",
      "#fb7185",
    );
    expect(screen.getByTestId("autosampler-rack-illustration-slot-liquid-3")).toHaveAttribute(
      "fill",
      "#10b981",
    );
    expect(screen.getByTestId("autosampler-rack-illustration-slot-liquid-4")).toHaveAttribute(
      "fill",
      "url(#autosampler-rack-illustration-slot-gradient-4)",
    );
    expect(screen.getByTestId("autosampler-rack-illustration-slot-gradient-4").querySelectorAll("stop")).toHaveLength(4);
    expect(screen.getByTestId("autosampler-rack-illustration-slot-liquid-5")).toHaveAttribute(
      "fill",
      "#cbd5e1",
    );
  });

  it("hides the product under a black cap when closed and shows it when open", () => {
    render(
      <AutosamplerRackIllustration
        occupiedSlotLiquids={{
          1: [
            {
              accent: "rose",
              id: "bench_liquid_1",
              liquidId: "apple_extract",
              name: "Apple extract",
              volume_ml: 1,
            },
          ],
          2: [
            {
              accent: "rose",
              id: "bench_liquid_2",
              liquidId: "apple_extract",
              name: "Apple extract",
              volume_ml: 1,
            },
          ],
        }}
        occupiedSlots={[1, 2]}
        openSlots={[2]}
        testId="autosampler-rack-illustration"
      />,
    );

    // Position 1 is capped: a solid black disc covers the vial, and the product
    // only survives as a rim peeking out from behind the cap.
    expect(screen.getByTestId("autosampler-rack-illustration-slot-1")).toHaveAttribute(
      "data-seal-state",
      "sealed",
    );
    const cap = screen.getByTestId("autosampler-rack-illustration-slot-cap-1");
    const cappedProduct = screen.getByTestId("autosampler-rack-illustration-slot-liquid-1");
    expect(cap).toHaveAttribute("fill", "#0b1220");
    expect(cappedProduct).toHaveAttribute("fill", "#fb7185");
    expect(Number(cappedProduct.getAttribute("r"))).toBeGreaterThan(
      Number(cap.getAttribute("r")),
    );
    expect(screen.queryByTestId("autosampler-rack-illustration-slot-open-1")).toBeNull();

    // Position 2 is open: no cap at all, and the product fills the bare mouth.
    expect(screen.getByTestId("autosampler-rack-illustration-slot-2")).toHaveAttribute(
      "data-seal-state",
      "open",
    );
    expect(screen.queryByTestId("autosampler-rack-illustration-slot-cap-2")).toBeNull();
    const openProduct = screen.getByTestId("autosampler-rack-illustration-slot-liquid-2");
    expect(openProduct).toHaveAttribute("fill", "#fb7185");
    expect(Number(openProduct.getAttribute("r"))).toBeGreaterThanOrEqual(9);
    const openMouth = screen.getByTestId("autosampler-rack-illustration-slot-open-2");
    expect(openMouth).toHaveAttribute("stroke", "#f59e0b");
    expect(openMouth.getAttribute("stroke-dasharray")).toBeTruthy();
  });

  it("renders instrument state as data attributes", () => {
    render(
      <LcMsMsInstrumentIllustration
        activeStage="msms"
        status="running"
        testId="lc-msms-instrument-illustration"
      />,
    );

    expect(screen.getByTestId("lc-msms-instrument-illustration")).toHaveAttribute(
      "data-status",
      "running",
    );
    expect(screen.getByTestId("lc-msms-instrument-illustration")).toHaveAttribute(
      "data-active-stage",
      "msms",
    );
  });

  it("renders produce basket state as data attributes", () => {
    render(<ProduceBasketIllustration itemCount={8} testId="produce-basket-illustration" />);

    expect(screen.getByTestId("produce-basket-illustration")).toHaveAttribute(
      "data-item-count",
      "8",
    );
  });

  it("renders cryogenic grinder illustration", () => {
    render(
      <CryogenicGrinderIllustration
        powerButtonLabel="Start grinder"
        powerButtonTestId="grinder-power-button"
        status="ready"
        testId="cryogenic-grinder-illustration"
      />,
    );

    expect(screen.getByTestId("cryogenic-grinder-illustration")).toBeInTheDocument();
    expect(screen.getByTestId("cryogenic-grinder-illustration")).toHaveAttribute(
      "aria-label",
      "Cryogenic grinder illustration",
    );
    expect(screen.getByTestId("cryogenic-grinder-illustration")).toHaveAttribute(
      "data-status",
      "ready",
    );
    expect(screen.getByTestId("grinder-power-button")).toHaveAttribute(
      "aria-label",
      "Start grinder",
    );
  });

  it("renders apple illustration", () => {
    render(<AppleIllustration testId="apple-illustration" />);

    expect(screen.getByTestId("apple-illustration")).toBeInTheDocument();
    expect(screen.getByTestId("apple-illustration")).toHaveAttribute("aria-label", "Apple lot illustration");
    expect(screen.getByTestId("apple-illustration")).toHaveAttribute("data-apple-count", "3");
  });

  it("renders a powder illustration variant for ground produce", () => {
    render(<AppleIllustration testId="apple-powder-illustration" variant="ground" />);

    expect(screen.getByTestId("apple-powder-illustration")).toHaveAttribute("data-variant", "ground");
  });

  it("renders smoke intensity on the ground illustration", () => {
    render(
      <AppleIllustration
        smokeIntensity="medium"
        testId="apple-smoke-illustration"
        variant="ground"
      />,
    );

    expect(screen.getByTestId("apple-smoke-illustration")).toHaveAttribute("data-smoke-intensity", "medium");
  });

  it("renders a reusable item count badge", () => {
    render(<ItemCountBadge count={7} testId="item-count-badge" />);

    expect(screen.getByTestId("item-count-badge")).toHaveTextContent("7");
    expect(screen.getByTestId("item-count-badge")).toHaveClass("rounded-full");
    expect(screen.getByTestId("item-count-badge")).toHaveClass("bg-slate-900");
  });

  it("renders the HDPE storage jar icon on bench assets", () => {
    render(
      <LabAssetIcon
        accent="sky"
        className="h-22 w-16"
        kind="storage_jar"
        produceLots={[]}
        tone="neutral"
      />,
    );

    expect(screen.getByLabelText("storage jar")).toBeInTheDocument();
    expect(screen.getByLabelText("storage jar").parentElement).toHaveAttribute("data-kind", "storage_jar");
  });

  it("renders an optional equipment header action", () => {
    const onStore = vi.fn();

    render(
      <WorkspaceEquipmentWidget
        eyebrow="Autosampler rack"
        headerAction={
          <button aria-label="Store in inventory" onClick={onStore} type="button">
            <span aria-hidden="true">+</span>
          </button>
        }
      >
        <div>Rack body</div>
      </WorkspaceEquipmentWidget>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Store in inventory" }));

    expect(onStore).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Rack body")).toBeInTheDocument();
  });
});
