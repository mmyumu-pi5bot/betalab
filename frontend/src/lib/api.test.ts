import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addLiquidToTool,
  closeWorkbenchTool,
  createDebugProduceLotOnWorkbench,
  createDebugProduceLotToWidget,
  createDebugToolPreset,
  createExperiment,
  deleteExperiment,
  getExperiment,
  getToolbarCatalog,
  listExperiments,
  moveObject,
  openWorkbenchTool,
  subscribeToExperimentStream,
} from "@/lib/api";
import type { Experiment, ExperimentListEntry } from "@/types/experiment";

const makeExperiment = (): Experiment => ({
  id: "experiment_test",
  status: "preparing",
  last_simulation_at: "2026-03-28T19:00:00Z",
  snapshot_version: 1,
  workbench: {
    slots: [],
  },
  rack: {
    slots: [],
  },
  trash: {
    children: [],
    discardedFrom: {},
    produceLots: [],
    sampleLabels: [],
  },
  workspace: {
    produceBasketLots: [],
    widgets: [],
  },
  limsReception: {
    id: null,
    orchardName: "",
    harvestDate: "",
    indicativeMassG: 0,
    measuredGrossMassG: null,
    grossMassOffsetG: 0,
    measuredSampleMassG: null,
    labSampleCode: null,
    status: "awaiting_reception",
    printedLabelTicket: null,
  },
  limsEntries: [],
  basketTools: [],
  produceMaterialStates: [],
  spatula: {
    isLoaded: false,
    produceFractions: [],
    sourceToolId: null,
  },
  pipette: { capacityMl: 1, volumeMl: 0, sourceToolId: null },
  analyticalBalance: {
    tareMassG: null,
    taredToolId: null,
  },
  audit_log: [],
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("adds liquid to a container by tool identity", async () => {
    const experiment = makeExperiment();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => experiment,
    });
    vi.stubGlobal("fetch", fetchMock);

    await addLiquidToTool("experiment_test", {
      tool_id: "tool_42",
      liquid_id: "quechers_salts",
      volume_ml: 1,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/experiments/experiment_test/tools/tool_42/liquids",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ liquid_id: "quechers_salts", volume_ml: 1 }),
      }),
    );
  });

  it("creates an empty experiment", async () => {
    const experiment = makeExperiment();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => experiment,
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(createExperiment()).resolves.toEqual(experiment);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/experiments", {
      method: "POST",
    });
  });

  it("lists saved experiments", async () => {
    const experiments: ExperimentListEntry[] = [
      {
        id: "experiment_2",
        status: "preparing",
        last_simulation_at: "2026-04-01T10:00:00Z",
        snapshot_version: 4,
        updated_at: "2026-04-01T10:03:00Z",
        last_audit_entry: "Wide-neck HDPE jar sealed on Station 1.",
      },
      {
        id: "experiment_1",
        status: "preparing",
        last_simulation_at: "2026-04-01T09:00:00Z",
        snapshot_version: 2,
        updated_at: "2026-04-01T09:01:00Z",
        last_audit_entry: null,
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => experiments,
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(listExperiments()).resolves.toEqual(experiments);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/experiments");
  });

  it("fetches and normalizes the toolbar catalog", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "prep_tools",
          label: "Containers",
          description: "Bench containers",
          items: [
            {
              id: "sample_vial_lcms",
              item_type: "tool",
              name: "Autosampler vial",
              subtitle: "Injection ready",
              description: "Injection vial",
              accent: "sky",
              tool_type: "sample_vial",
              capacity_ml: 2,
              can_receive_liquids: true,
              can_receive_produce: false,
              can_seal: true,
              allowed_drop_targets: ["workbench_slot", "rack_slot"],
            },
          ],
        },
      ],
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(getToolbarCatalog()).resolves.toEqual([
      {
        id: "prep_tools",
        label: "Containers",
        description: "Bench containers",
        items: [
          {
            id: "sample_vial_lcms",
            itemType: "tool",
            name: "Autosampler vial",
            subtitle: "Injection ready",
            description: "Injection vial",
            accent: "sky",
            toolType: "sample_vial",
            capacity_ml: 2,
            canReceiveLiquids: true,
            canReceiveProduce: false,
            canSeal: true,
            isDiscardable: true,
            isStorable: false,
            allowedDropTargets: ["workbench_slot", "rack_slot"],
          },
        ],
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/experiments/catalog/toolbar");
  });

  it("normalizes DnD contract fields from the experiment snapshot", async () => {
    const rawExperiment = {
      ...makeExperiment(),
      id: "experiment_dnd_contract",
      workbench: {
        slots: [
          {
            id: "station_1",
            label: "Station 1",
            drop_target_types: ["workbench_slot"],
            tool: {
              id: "bench_tool_1",
              tool_id: "sample_bag_1",
              label: "Sample bag",
              subtitle: "Reception bag",
              accent: "emerald",
              tool_type: "sample_bag",
              capacity_ml: 2500,
              can_receive_contents: false,
              can_receive_liquids: false,
              can_receive_produce: true,
              can_seal: true,
              is_sealed: true,
              is_draggable: false,
              allowed_drop_targets: ["trash_bin"],
              labels: [
                {
                  id: "label_1",
                  label_kind: "manual",
                  text: "Manual note",
                  is_draggable: true,
                  allowed_drop_targets: ["workbench_slot", "analytical_balance_widget", "trash_bin"],
                },
              ],
              produce_lots: [],
              liquids: [],
              produce_fractions: [],
            },
          },
        ],
      },
      limsReception: {
        ...makeExperiment().limsReception,
        printedLabelTicket: {
          id: "ticket_1",
          sampleCode: "APP-2026-001",
          labelText: "APP-2026-001",
          receivedDate: "2026-04-14",
          isDraggable: true,
          allowedDropTargets: ["workbench_slot", "gross_balance_widget", "analytical_balance_widget", "trash_bin"],
        },
      },
      workspace: {
        produceBasketLots: [],
        widgets: [
          {
            id: "gross_balance",
            widget_type: "gross_balance",
            label: "Gross balance",
            drop_target_types: ["gross_balance_widget"],
            anchor: "top-left",
            offset_x: 0,
            offset_y: 0,
            is_present: true,
            is_trashed: false,
            tool: null,
            produce_lots: [],
            liquids: [],
          },
        ],
      },
    } satisfies Record<string, unknown>;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => rawExperiment,
    });

    vi.stubGlobal("fetch", fetchMock);

    const experiment = await getExperiment("experiment_dnd_contract");

    expect(experiment.workbench.slots[0].tool).toMatchObject({
      isDraggable: false,
      canReceiveProduce: true,
      canSeal: true,
      isSealed: true,
      allowedDropTargets: ["trash_bin"],
      labels: [
        {
          id: "label_1",
          isDraggable: true,
          allowedDropTargets: ["workbench_slot", "analytical_balance_widget", "trash_bin"],
        },
      ],
    });
    expect(experiment.workbench.slots[0].dropTargetTypes).toEqual(["workbench_slot"]);
    expect(experiment.limsReception.printedLabelTicket).toMatchObject({
      id: "ticket_1",
      isDraggable: true,
      allowedDropTargets: ["workbench_slot", "gross_balance_widget", "analytical_balance_widget", "trash_bin"],
    });
    expect(experiment.workspace.widgets[0].dropTargetTypes).toEqual(["gross_balance_widget"]);
  });

  it("deletes a saved experiment", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteExperiment("experiment_123")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/experiments/experiment_123", {
      method: "DELETE",
    });
  });

  it("moves a tool through the generic DnD move endpoint", async () => {
    const experiment = makeExperiment();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => experiment,
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      moveObject("experiment_123", {
        destination: { kind: "gross_balance", id: "gross_balance" },
        entity: { kind: "tool", id: "bench_tool_1" },
        source: { kind: "workbench", id: "station_1" },
      }),
    ).resolves.toEqual(experiment);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/experiments/experiment_123/dnd/move",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      destination: { kind: "gross_balance", id: "gross_balance" },
      entity: { kind: "tool", id: "bench_tool_1" },
      source: { kind: "workbench", id: "station_1" },
    });
  });

  it("places a palette tool through the generic DnD move endpoint", async () => {
    const experiment = makeExperiment();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => experiment,
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      moveObject("experiment_123", {
        destination: { kind: "workbench_slot", id: "station_1" },
        entity: { kind: "tool", id: "cutting_board_hdpe" },
        source: { kind: "palette", id: "cutting_board_hdpe" },
      }),
    ).resolves.toEqual(experiment);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/experiments/experiment_123/dnd/move",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      destination: { kind: "workbench_slot", id: "station_1" },
      entity: { kind: "tool", id: "cutting_board_hdpe" },
      source: { kind: "palette", id: "cutting_board_hdpe" },
    });
  });

  it("closes a sealable workbench tool via its dedicated endpoint", async () => {
    const initialExperiment = {
      ...makeExperiment(),
      id: "experiment_123",
      workbench: {
        slots: [
          {
            id: "station_1",
            label: "Station 1",
            tool: {
              id: "bench_tool_1",
              tool_id: "hdpe_storage_jar_2l",
              label: "Wide-neck HDPE jar",
              subtitle: "Bulk powder storage",
              accent: "amber",
              tool_type: "storage_jar",
              capacity_ml: 2000,
              contact_impurity_mg_per_g: 0,
              is_sealed: false,
              closure_faults: [],
              field_label_text: null,
              labels: [],
              produce_lots: [],
              liquids: [],
              produce_fractions: [],
            },
          },
        ],
      },
    } satisfies Experiment;
    const closedExperiment = {
      ...initialExperiment,
      workbench: {
        slots: [
          {
            ...initialExperiment.workbench.slots[0],
            tool: {
              ...initialExperiment.workbench.slots[0].tool!,
              is_sealed: true,
            },
          },
        ],
      },
    } satisfies Experiment;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => initialExperiment,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => closedExperiment,
      });

    vi.stubGlobal("fetch", fetchMock);

    await getExperiment("experiment_123");
    await expect(closeWorkbenchTool("experiment_123", { slot_id: "station_1" })).resolves.toMatchObject({
      workbench: { slots: [{ tool: { isSealed: true } }] },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/experiments/experiment_123/workbench/tools/bench_tool_1/close",
      {
        method: "POST",
      },
    );
  });

  it("opens a sealable workbench tool via its dedicated endpoint", async () => {
    const initialExperiment = {
      ...makeExperiment(),
      id: "experiment_123",
      workbench: {
        slots: [
          {
            id: "station_1",
            label: "Station 1",
            tool: {
              id: "bench_tool_1",
              tool_id: "hdpe_storage_jar_2l",
              label: "Wide-neck HDPE jar",
              subtitle: "Bulk powder storage",
              accent: "amber",
              tool_type: "storage_jar",
              capacity_ml: 2000,
              contact_impurity_mg_per_g: 0,
              is_sealed: true,
              closure_faults: [],
              field_label_text: null,
              labels: [],
              produce_lots: [],
              liquids: [],
              produce_fractions: [],
            },
          },
        ],
      },
    } satisfies Experiment;
    const openedExperiment = {
      ...initialExperiment,
      workbench: {
        slots: [
          {
            ...initialExperiment.workbench.slots[0],
            tool: {
              ...initialExperiment.workbench.slots[0].tool!,
              is_sealed: false,
            },
          },
        ],
      },
    } satisfies Experiment;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => initialExperiment,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => openedExperiment,
      });

    vi.stubGlobal("fetch", fetchMock);

    await getExperiment("experiment_123");
    await expect(openWorkbenchTool("experiment_123", { slot_id: "station_1" })).resolves.toMatchObject({
      id: "experiment_123",
      workbench: {
        slots: [
          {
            id: "station_1",
            tool: {
              id: "bench_tool_1",
              isSealed: false,
              closureFault: null,
              toolId: "hdpe_storage_jar_2l",
              toolType: "storage_jar",
            },
          },
        ],
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/experiments/experiment_123/workbench/tools/bench_tool_1/open",
      {
        method: "POST",
      },
    );
  });

  it("normalizes canonical produce fractions for tools and spatula", async () => {
    const experiment = {
      ...makeExperiment(),
      produceMaterialStates: [
        {
          id: "state_ground",
          produceLotId: "lot_1",
          materialState: "ground",
        },
      ],
      workbench: {
        slots: [
          {
            id: "station_1",
            label: "Station 1",
            tool: {
              id: "bench_tool_1",
              tool_id: "centrifuge_tube_50ml",
              label: "50 mL centrifuge tube",
              subtitle: "Extraction ready",
              accent: "sky",
              tool_type: "centrifuge_tube",
              capacity_ml: 50,
              contact_impurity_mg_per_g: 0.02,
              produce_lots: [],
              produce_fractions: [
                {
                  id: "produce_fraction_1",
                  produce_lot_id: "lot_1",
                  produce_material_state_id: "state_ground",
                  mass_g: 1.25,
                  impurity_mass_mg: 0.08,
                  exposure_container_ids: ["tube_1"],
                },
              ],
              liquids: [],
              labels: [],
            },
          },
        ],
      },
      spatula: {
        is_loaded: true,
        produce_fractions: [
          {
            id: "produce_fraction_2",
            produce_lot_id: "lot_1",
            produce_material_state_id: "state_ground",
            mass_g: 0.4,
            impurity_mass_mg: 0.01,
            exposure_container_ids: ["spatula"],
          },
        ],
        source_tool_id: "bench_tool_1",
      },
    } satisfies Experiment;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => experiment,
    });

    vi.stubGlobal("fetch", fetchMock);

    const normalized = await getExperiment("experiment_123");
    expect(normalized.workbench.slots[0].tool?.produceFractions).toMatchObject([
      {
        id: "produce_fraction_1",
        produceLotId: "lot_1",
        produceMaterialStateId: "state_ground",
        massG: 1.25,
        impurityMassMg: 0.08,
        exposureContainerIds: ["tube_1"],
      },
    ]);
    expect(normalized.spatula.produceFractions).toMatchObject([
      {
        id: "produce_fraction_2",
        produceLotId: "lot_1",
        produceMaterialStateId: "state_ground",
        massG: 0.4,
        impurityMassMg: 0.01,
        exposureContainerIds: ["spatula"],
      },
    ]);
  });

  it("normalizes mixed state on the produce fraction only", async () => {
    const experiment = {
      ...makeExperiment(),
      produceMaterialStates: [
        {
          id: "state_slurry",
          produce_lot_id: "lot_1",
          material_state: "slurry",
        },
      ],
      workbench: {
        slots: [
          {
            id: "station_1",
            label: "Station 1",
            tool: {
              id: "bench_tool_1",
              tool_id: "centrifuge_tube_50ml",
              label: "50 mL centrifuge tube",
              subtitle: "Extraction ready",
              accent: "sky",
              tool_type: "centrifuge_tube",
              capacity_ml: 50,
              produce_lots: [
                {
                  id: "lot_1",
                  label: "Apple slurry lot",
                  produce_type: "apple",
                  total_mass_g: 8,
                },
              ],
              produce_fractions: [
                {
                  id: "fraction_1",
                  produce_lot_id: "lot_1",
                  produce_material_state_id: "state_slurry",
                  mass_g: 8,
                  is_mixed: true,
                },
              ],
              liquids: [],
              labels: [],
            },
          },
        ],
      },
    } as Experiment;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => experiment,
    });

    vi.stubGlobal("fetch", fetchMock);

    const normalized = await getExperiment("experiment_123");
    expect("isMixed" in ((normalized.produceMaterialStates?.[0] ?? {}) as Record<string, unknown>)).toBe(false);
    expect(normalized.workbench.slots[0].tool?.produceFractions?.[0]?.isMixed).toBe(true);
    expect("isMixed" in ((normalized.workbench.slots[0].tool ?? {}) as Record<string, unknown>)).toBe(false);
  });

  it("prefers the fraction material state over the lot-level state when normalizing produce lots", async () => {
    const experiment = {
      ...makeExperiment(),
      produceMaterialStates: [
        {
          id: "state_ground",
          produceLotId: "lot_1",
          materialState: "ground",
        },
        {
          id: "state_slurry",
          produceLotId: "lot_1",
          materialState: "slurry",
        },
      ],
      workbench: {
        slots: [
          {
            id: "station_1",
            label: "Station 1",
            tool: {
              id: "bench_tool_1",
              tool_id: "hdpe_storage_jar_2l",
              label: "Wide-neck HDPE jar",
              subtitle: "Bulk powder storage",
              accent: "slate",
              tool_type: "storage_jar",
              capacity_ml: 180,
              produce_lots: [
                {
                  id: "lot_1",
                  label: "Apple powder lot",
                  produce_type: "apple",
                  total_mass_g: 8,
                },
              ],
              produce_fractions: [
                {
                  id: "produce_fraction_1",
                  produce_lot_id: "lot_1",
                  produce_material_state_id: "state_ground",
                  mass_g: 8,
                },
              ],
              liquids: [],
              labels: [],
            },
          },
        ],
      },
    } satisfies Experiment;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => experiment,
    });

    vi.stubGlobal("fetch", fetchMock);

    const normalized = await getExperiment("experiment_123");
    expect(normalized.workbench.slots[0].tool?.produceLots[0]?.materialState).toBe("ground");
    expect(normalized.workbench.slots[0].tool?.powderMassG).toBe(8);
    expect(normalized.workbench.slots[0].tool?.containsSlurry).toBe(false);
  });

  it("sends debug produce overrides when spawning on the workbench", async () => {
    const experiment = makeExperiment();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => experiment,
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createDebugProduceLotOnWorkbench("experiment_123", {
        preset_id: "apple_powder_residual_co2",
        total_mass_g: 2450,
        residual_co2_mass_g: 24,
        target_slot_id: "station_1",
        temperature_c: -70,
      }),
    ).resolves.toEqual(experiment);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/experiments/experiment_123/debug/produce-presets/apple_powder_residual_co2/spawn-on-workbench",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target_slot_id: "station_1",
          total_mass_g: 2450,
          temperature_c: -70,
          residual_co2_mass_g: 24,
        }),
      },
    );
  });

  it("sends debug produce overrides when spawning on a widget", async () => {
    const experiment = makeExperiment();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => experiment,
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createDebugProduceLotToWidget("experiment_123", {
        preset_id: "apple_powder_residual_co2",
        total_mass_g: 2450,
        residual_co2_mass_g: 12,
        temperature_c: -55,
        widget_id: "grinder",
      }),
    ).resolves.toEqual(experiment);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/experiments/experiment_123/debug/produce-presets/apple_powder_residual_co2/spawn-on-widget",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          widget_id: "grinder",
          total_mass_g: 2450,
          temperature_c: -55,
          residual_co2_mass_g: 12,
        }),
      },
    );
  });

  it("sends debug slurry tube attributes and destination", async () => {
    const experiment = makeExperiment();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => experiment,
    });
    vi.stubGlobal("fetch", fetchMock);

    await createDebugToolPreset("experiment_123", {
      preset_id: "apple_slurry_centrifuge_tube",
      destination_kind: "workbench_slot",
      destination_id: "station_1",
      produce_mass_g: 10,
      temperature_c: 4,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/experiments/experiment_123/debug/tool-presets/apple_slurry_centrifuge_tube/spawn",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination_kind: "workbench_slot",
          destination_id: "station_1",
          produce_mass_g: 10,
          temperature_c: 4,
        }),
      },
    );
  });

  it("fetches an experiment by id", async () => {
    const experiment = makeExperiment();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => experiment,
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(getExperiment("experiment_123")).resolves.toEqual(experiment);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/experiments/experiment_123");
  });

  it("normalizes snake_case workbench payloads from the backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...makeExperiment(),
        workbench: {
          slots: [
            {
              id: "station_1",
              label: "Station 1",
              tool: {
                id: "bench_tool_1",
                tool_id: "sample_vial_lcms",
                label: "Autosampler vial",
                subtitle: "Injection ready",
                accent: "sky",
                tool_type: "sample_vial",
                capacity_ml: 2,
                quechers_state: {
                  salts_added: true,
                  phase: "reacting",
                  temperature_c: 61.5,
                  cementation_progress: 0.4,
                  thermal_degradation_progress: 0.12,
                  reaction_elapsed_seconds: 6,
                  faults: [],
                  is_usable: true,
                },
                liquids: [
                  {
                    id: "bench_liquid_1",
                    liquid_id: "acetonitrile_extraction",
                    name: "Acetonitrile",
                    volume_ml: 2,
                    accent: "amber",
                  },
                ],
              },
            },
          ],
        },
        rack: {
          slots: [
            {
              id: "rack_slot_1",
              label: "Position 1",
              tool: {
                id: "bench_tool_2",
                tool_id: "sample_vial_lcms",
                label: "Autosampler vial",
                subtitle: "Injection ready",
                accent: "sky",
                tool_type: "sample_vial",
                capacity_ml: 2,
                liquids: [],
              },
            },
          ],
        },
        trash: {
          produce_lots: [
            {
              id: "trash_produce_lot_1",
              origin_label: "Sealed sampling bag",
              produce_lot: {
                id: "produce_1",
                label: "Apple lot 1",
                produce_type: "apple",
                total_mass_g: 2450.0,
                unit_count: 12,
              },
            },
          ],
          children: [
            {
              id: "bench_tool_3",
              tool_id: "sample_vial_lcms",
              label: "Autosampler vial",
              subtitle: "Injection ready",
              accent: "sky",
              tool_type: "sample_vial",
              capacity_ml: 2,
              liquids: [],
            },
          ],
          discarded_from: { "bench_tool_3": "Station 1" },
        },
        workspace: {
          produce_basket_lots: [
            {
              id: "produce_1",
              label: "Apple lot 1",
              produce_type: "apple",
              total_mass_g: 2450.0,
              unit_count: 12,
              grind_quality_label: "powder_fine",
              homogeneity_score: 0.94,
            },
          ],
          widgets: [
            {
              id: "rack",
              widget_type: "autosampler_rack",
              label: "Autosampler rack",
              anchor: "top-left",
              offset_x: 234,
              offset_y: 886,
              is_present: false,
              is_trashed: true,
            },
          ],
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const experiment = await getExperiment("experiment_123");

    expect(experiment.workbench.slots[0].tool?.toolId).toBe("sample_vial_lcms");
    expect(experiment.workbench.slots[0].tool?.toolType).toBe("sample_vial");
    expect(experiment.workbench.slots[0].tool?.liquids[0].liquidId).toBe(
      "acetonitrile_extraction",
    );
    expect(experiment.workbench.slots[0].tool?.quechersState).toMatchObject({
      saltsAdded: true,
      phase: "reacting",
      temperatureC: 61.5,
      cementationProgress: 0.4,
      thermalDegradationProgress: 0.12,
      isUsable: true,
    });
    expect(experiment.rack.slots[0].tool?.toolId).toBe("sample_vial_lcms");
    expect(experiment.trash.discardedFrom["bench_tool_3"]).toBe("Station 1");
    expect(experiment.trash.produceLots[0]?.originLabel).toBe("Sealed sampling bag");
    expect(experiment.trash.produceLots[0]?.produceLot.label).toBe("Apple lot 1");
    expect(experiment.workspace.widgets[0]?.widgetType).toBe("autosampler_rack");
    expect(experiment.workspace.widgets[0]?.anchor).toBe("top-left");
    expect(experiment.workspace.widgets[0]?.offsetX).toBe(234);
    expect(experiment.workspace.widgets[0]?.isTrashed).toBe(true);
    expect(experiment.workspace.produceBasketLots[0]?.produceType).toBe("apple");
    expect(experiment.workspace.produceBasketLots[0]?.label).toBe("Apple lot 1");
    expect(experiment.workspace.produceBasketLots[0]?.unitCount).toBe(12);
    expect(experiment.workspace.produceBasketLots[0]?.totalMassG).toBe(2450);
    expect(experiment.workspace.produceBasketLots[0]?.grindQualityLabel).toBe("powder_fine");
    expect(experiment.workspace.produceBasketLots[0]?.homogeneityScore).toBe(0.94);
  });

  it("throws when experiment creation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    );

    await expect(createExperiment()).rejects.toThrow("Failed to create experiment");
  });

  it("throws when command execution fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    );

    await expect(
      moveObject("experiment_123", {
        destination: { kind: "gross_balance", id: "gross_balance" },
        entity: { kind: "tool", id: "bench_tool_1" },
        source: { kind: "workbench", id: "station_1" },
      }),
    ).rejects.toThrow("Failed to send experiment mutation");
  });

  it("subscribes to the experiment stream over WebSocket", () => {
    const onMessage = vi.fn();
    const close = vi.fn();
    const socket = {
      close,
      onerror: null,
      onmessage: null,
    };
    const webSocketMock = vi.fn(() => socket);

    vi.stubGlobal("WebSocket", webSocketMock);

    const unsubscribe = subscribeToExperimentStream("experiment_123", { onMessage });

    expect(webSocketMock).toHaveBeenCalledWith("ws://localhost:8000/experiments/experiment_123/stream");
    unsubscribe();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("reconnects the experiment stream after an unexpected socket close", () => {
    vi.useFakeTimers();

    const sockets: Array<{
      close: ReturnType<typeof vi.fn>;
      onclose: null | (() => void);
      onerror: null | (() => void);
      onmessage: null | ((event: { data: string }) => void);
      onopen: null | (() => void);
      readyState: number;
    }> = [];
    const webSocketMock = vi.fn(() => {
      const socket = {
        close: vi.fn(),
        onclose: null,
        onerror: null,
        onmessage: null,
        onopen: null,
        readyState: 1,
      };
      sockets.push(socket);
      return socket;
    });

    vi.stubGlobal("WebSocket", webSocketMock);

    const unsubscribe = subscribeToExperimentStream("experiment_123", { onMessage: vi.fn() });

    expect(webSocketMock).toHaveBeenCalledTimes(1);

    sockets[0]?.onclose?.();

    vi.advanceTimersByTime(1000);

    expect(webSocketMock).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it("surfaces backend error detail for command execution failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ detail: "Experiment not found" }),
      }),
    );

    await expect(
      moveObject("experiment_123", {
        destination: { kind: "gross_balance", id: "gross_balance" },
        entity: { kind: "tool", id: "bench_tool_1" },
        source: { kind: "workbench", id: "station_1" },
      }),
    ).rejects.toThrow("Experiment not found");
  });

  it("throws when experiment loading fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    );

    await expect(getExperiment("experiment_123")).rejects.toThrow("Failed to fetch experiment");
  });
});
