import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ToolbarPanel } from "@/components/toolbar-panel";
import type { ToolbarCategory } from "@/types/workbench";

const categories: ToolbarCategory[] = [
  {
    id: "glassware",
    label: "Glassware",
    description: "Core containers for standards and samples.",
    items: [
      {
        id: "volumetric_flask",
        allowedDropTargets: ["workbench_slot"],
        itemType: "tool",
        name: "Volumetric flask",
        subtitle: "100 mL calibration prep",
        description: "Build standard dilutions with a fixed final volume.",
        accent: "sky",
        toolType: "volumetric_flask",
        capacity_ml: 100,
      },
    ],
  },
  {
    id: "liquids",
    label: "Liquids",
    description: "Solvents and matrices available on the bench.",
    items: [
      {
        id: "acetonitrile",
        allowedDropTargets: ["workbench_slot"],
        itemType: "liquid",
        name: "Acetonitrile",
        subtitle: "Organic modifier",
        description: "Common LC solvent for sample prep and rinsing.",
        accent: "amber",
        liquidType: "acetonitrile",
        transfer_volume_ml: 10,
      },
      {
        id: "dry_ice_pellets",
        allowedDropTargets: [],
        itemType: "liquid",
        name: "Dry ice pellets (CO2)",
        subtitle: "Cryogenic cooling",
        description: "Solid CO2 pellets for chilled handling.",
        accent: "sky",
        liquidType: "dry_ice_pellets",
        transfer_volume_ml: 0,
      },
    ],
  },
  {
    id: "workspace_equipment",
    label: "Workspace equipment",
    description: "Larger systems dropped directly into the workspace.",
    items: [
      {
        id: "autosampler_rack_widget",
        allowedDropTargets: ["workspace_canvas"],
        itemType: "workspace_widget",
        name: "Autosampler rack",
        subtitle: "Sequence staging",
        description: "Stages vials before the instrument.",
        accent: "sky",
        widgetType: "autosampler_rack",
      },
    ],
  },
  {
    id: "misc",
    label: "MISC",
    description: "Supporting lab supplies.",
    items: [
      {
        id: "sampling_bag_label",
        allowedDropTargets: ["workbench_slot"],
        itemType: "sample_label",
        name: "Sampling label",
        subtitle: "Traceability",
        description: "Adhesive lot label for sealed sample bags.",
        accent: "sky",
      },
    ],
  },
];

describe("ToolbarPanel", () => {
  it("starts with categories collapsed and lets the user expand them", async () => {
    render(<ToolbarPanel categories={categories} />);

    expect(screen.getByText("Inventory")).toBeInTheDocument();
    expect(screen.getByText("Glassware")).toBeInTheDocument();
    expect(screen.getByText("Liquids")).toBeInTheDocument();
    expect(screen.getByText("Workspace equipment")).toBeInTheDocument();
    expect(screen.getByText("MISC")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-category-panel-glassware")).toHaveClass("hidden");
    expect(screen.getByTestId("toolbar-category-panel-liquids")).toHaveClass("hidden");
    expect(screen.getByTestId("toolbar-category-panel-workspace_equipment")).toHaveClass("hidden");
    expect(screen.getByTestId("toolbar-category-panel-misc")).toHaveClass("hidden");
    expect(screen.queryByText("Core containers for standards and samples.")).not.toBeInTheDocument();
    expect(screen.queryByText("Solvents and matrices available on the bench.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Glassware/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: /Liquids/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    await userEvent.click(screen.getByRole("button", { name: /Glassware/i }));

    expect(screen.getByRole("button", { name: /Glassware/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByTestId("toolbar-category-panel-glassware")).not.toHaveClass("hidden");
    expect(screen.getByTestId("toolbar-item-volumetric_flask")).toHaveAttribute("draggable", "true");
    expect(screen.getByTestId("toolbar-category-panel-liquids")).toHaveClass("hidden");

    await userEvent.click(screen.getByRole("button", { name: /Liquids/i }));

    expect(screen.getByTestId("toolbar-item-acetonitrile")).toHaveAttribute("draggable", "true");
    expect(screen.getByTestId("toolbar-item-dry_ice_pellets")).toHaveAttribute("draggable", "true");

    await userEvent.click(screen.getByRole("button", { name: /Workspace equipment/i }));

    expect(screen.getByTestId("toolbar-item-autosampler_rack_widget")).toHaveAttribute(
      "draggable",
      "true",
    );

    await userEvent.click(screen.getByRole("button", { name: /MISC/i }));

    expect(screen.getByTestId("toolbar-item-sampling_bag_label")).toHaveAttribute(
      "draggable",
      "true",
    );
    expect(screen.getByTestId("toolbar-item-volumetric_flask")).toHaveAttribute(
      "title",
      "100 mL calibration prep",
    );
    expect(
      screen
        .getByTestId("toolbar-item-volumetric_flask")
        .querySelector("[data-kind='volumetric_flask']"),
    ).toHaveAttribute("data-tone", "neutral");
    expect(
      screen.getByTestId("toolbar-item-acetonitrile").querySelector("[data-kind='acetonitrile']"),
    ).toHaveAttribute("data-tone", "accent");
    expect(
      screen
        .getByTestId("toolbar-item-autosampler_rack_widget")
        .querySelector("[data-widget-type='autosampler_rack']"),
    ).toBeInTheDocument();
    expect(screen.getByText("Sequence staging")).toBeInTheDocument();
    expect(
      screen.getByTestId("toolbar-item-sampling_bag_label").querySelector("[data-kind='sample_label']"),
    ).toBeInTheDocument();
    expect(screen.queryByText("100 mL calibration prep")).not.toBeInTheDocument();
    expect(screen.queryByText("Organic modifier")).not.toBeInTheDocument();
    expect(screen.queryByText("Traceability")).not.toBeInTheDocument();
    expect(screen.queryByText("tool")).not.toBeInTheDocument();
    expect(screen.queryByText("liquid")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Glassware/i }));
    expect(screen.getByTestId("toolbar-category-panel-glassware")).toHaveClass("hidden");

    await userEvent.click(screen.getByRole("button", { name: /Glassware/i }));
    expect(screen.getByTestId("toolbar-category-panel-glassware")).not.toHaveClass("hidden");
  });

  it("renders sealable palette tools as visually closed", async () => {
    render(
      <ToolbarPanel
        categories={[
          {
            id: "containers",
            label: "Containers",
            description: "Sealable containers.",
            items: [
              {
                id: "sample_vial_lcms",
                allowedDropTargets: ["workbench_slot", "rack_slot", "trash_bin"],
                itemType: "tool",
                name: "Autosampler vial",
                subtitle: "Injection ready",
                description: "Sealed vial.",
                accent: "sky",
                toolType: "sample_vial",
                capacity_ml: 2,
                canSeal: true,
              },
              {
                id: "hdpe_storage_jar_2l",
                allowedDropTargets: ["workbench_slot", "trash_bin"],
                itemType: "tool",
                name: "Wide-neck HDPE jar",
                subtitle: "Bulk powder storage",
                description: "Sealed jar.",
                accent: "sky",
                toolType: "storage_jar",
                capacity_ml: 2000,
                canSeal: true,
              },
            ],
          },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Containers/i }));

    expect(
      screen.getByTestId("toolbar-item-sample_vial_lcms").querySelector("[data-kind='sample_vial']"),
    ).toHaveAttribute("data-seal-state", "sealed");
    expect(
      screen
        .getByTestId("toolbar-item-hdpe_storage_jar_2l")
        .querySelector("[data-kind='storage_jar']"),
    ).toHaveAttribute("data-seal-state", "sealed");
  });
});
