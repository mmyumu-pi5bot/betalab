export type ToolbarAccent = "amber" | "emerald" | "rose" | "sky" | "violet";
export type DropTargetType =
  | "workbench_slot"
  | "workspace_canvas"
  | "inventory_panel"
  | "rack_slot"
  | "trash_bin"
  | "grinder_widget"
  | "gross_balance_widget"
  | "analytical_balance_widget"
  | "vortex_widget"
  | "centrifuge_widget"
  | "ice_bath_widget"
  | "lcmsms_instrument";

type ToolbarBaseItem = {
  allowedDropTargets: DropTargetType[];
  id: string;
  name: string;
  subtitle: string;
  description: string;
  accent: ToolbarAccent;
};

export type ToolType =
  | "volumetric_flask"
  | "amber_bottle"
  | "sample_vial"
  | "beaker"
  | "centrifuge_tube"
  | "cutting_board"
  | "sample_bag"
  | "storage_jar";

export type LiquidType =
  | "ultrapure_water"
  | "acetonitrile"
  | "methanol"
  | "formic_acid"
  | "matrix_blank"
  | "apple_extract"
  | "dry_ice_pellets"
  | "quechers_salts"
  | "istd_solution"
  | "calibration_solution";

export type WorkspaceWidgetType =
  | "autosampler_rack"
  | "lc_msms_instrument"
  | "cryogenic_grinder"
  | "produce_basket"
  | "lims_terminal"
  | "gross_balance"
  | "analytical_balance"
  | "vortex_mixer"
  | "centrifuge"
  | "ice_bath";
export type ExperimentWorkspaceWidgetId =
  | "workbench"
  | "trash"
  | "rack"
  | "instrument"
  | "grinder"
  | "basket"
  | "lims"
  | "gross_balance"
  | "analytical_balance"
  | "vortex"
  | "centrifuge"
  | "ice_bath";
export type ExperimentWorkspaceWidgetType = "workbench" | "trash" | WorkspaceWidgetType;
export type WidgetAnchor = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type ProduceLotType = string;
export type ProduceMaterialKind = "whole" | "cut" | "ground" | "slurry" | "waste";
export type DragEntityKind =
  | "tool"
  | "liquid"
  | "workspace_widget"
  | "produce"
  | "sample_label"
  | "lims_label_ticket"
  | "rack";
type DragSourceKind =
  | "palette"
  | "debug_palette"
  | "workbench"
  | "rack"
  | "trash"
  | "basket"
  | "grinder"
  | "gross_balance"
  | "analytical_balance"
  | "vortex"
  | "centrifuge"
  | "ice_bath"
  | "lims";

export type DebugProducePresetId = "apple_powder_residual_co2";
export type DebugToolPresetId =
  | "apple_slurry_centrifuge_tube"
  | "vortexed_slurry_centrifuge_tube"
  | "separated_slurry_centrifuge_tube"
  | "calibration_standard_tube"
  | "apple_extract_vial";

export type ToolCatalogItem = ToolbarBaseItem & {
  canReceiveLiquids?: boolean;
  canReceiveProduce?: boolean;
  canSeal?: boolean;
  isDiscardable?: boolean;
  isStorable?: boolean;
  itemType: "tool";
  toolType: ToolType;
  capacity_ml: number;
};

export type LiquidCatalogItem = ToolbarBaseItem & {
  itemType: "liquid";
  liquidType: LiquidType;
  transfer_volume_ml: number;
};

export type WorkspaceWidgetCatalogItem = ToolbarBaseItem & {
  itemType: "workspace_widget";
  widgetType: WorkspaceWidgetType;
};

export type SampleLabelCatalogItem = ToolbarBaseItem & {
  itemType: "sample_label";
};

export type BenchLabel = {
  id: string;
  labelKind: "manual" | "lims";
  text: string;
  receivedDate?: string | null;
  sampleCode?: string | null;
  isDraggable: boolean;
  allowedDropTargets: DropTargetType[];
};

export type ToolbarItem =
  | ToolCatalogItem
  | LiquidCatalogItem
  | WorkspaceWidgetCatalogItem
  | SampleLabelCatalogItem;

export type ToolbarCategory = {
  id: string;
  label: string;
  description: string;
  items: ToolbarItem[];
};

type BaseDragPayload = {
  allowedDropTargets: DropTargetType[];
  entityKind: DragEntityKind;
  sourceId: string;
  sourceKind: DragSourceKind;
};

export type ToolbarDragPayload =
  | (BaseDragPayload & {
      entityId: string;
      entityKind: "tool";
      itemId: string;
      itemType: "tool";
      sourceId: string;
      sourceKind: "palette";
      toolType: ToolType;
    })
  | (BaseDragPayload & {
      entityKind: "liquid";
      itemId: string;
      itemType: "liquid";
      liquidType: LiquidType;
      sourceId: string;
      sourceKind: "palette";
    })
  | (BaseDragPayload & {
      entityKind: "workspace_widget";
      itemId: string;
      itemType: "workspace_widget";
      sourceId: string;
      sourceKind: "palette";
      widgetType: WorkspaceWidgetType;
    })
  | (BaseDragPayload & {
      entityKind: "sample_label";
      itemId: string;
      itemType: "sample_label";
      sourceId: string;
      sourceKind: "palette";
    });

export type SampleLabelDragPayload = BaseDragPayload & {
  entityKind: "sample_label";
  label: BenchLabel;
  sampleLabelId: string;
  sampleLabelText: string;
  sourceId: string;
  sourceKind: "workbench" | "trash";
  sourceSlotId?: string;
  trashSampleLabelId?: string;
};

export type LimsLabelTicketDragPayload = BaseDragPayload & {
  entityKind: "lims_label_ticket";
  sourceId: string;
  sourceKind: "lims";
  ticketId: string;
  sampleCode: string;
  labelText: string;
};

export type ProduceDragPayload = BaseDragPayload & {
  debugProducePresetId?: DebugProducePresetId;
  entityKind: "produce";
  produceLotId: string;
  produceType: ProduceLotType;
  sourceId: string;
  sourceKind: "basket" | "workbench" | "trash" | "grinder" | "gross_balance" | "debug_palette";
  sourceSlotId?: string;
  trashProduceLotId?: string;
};

export type WorkspaceLiquidDragPayload = BaseDragPayload & {
  entityKind: "liquid";
  liquidEntryId: string;
  liquidType: LiquidType;
  sourceId: string;
  sourceKind: "grinder";
  widgetId: "grinder";
};

export type BenchToolDragPayload = BaseDragPayload & {
  entityId: string;
  entityKind: "tool";
  sourceSlotId: string;
  sourceId: string;
  sourceKind: "workbench";
  toolId: string;
  toolType: ToolType;
};

export type BasketToolDragPayload = BaseDragPayload & {
  entityId: string;
  entityKind: "tool";
  sourceId: string;
  sourceKind: "basket";
  toolId: string;
  toolType: ToolType;
};

export type RackToolDragPayload = BaseDragPayload & {
  entityId: string;
  entityKind: "tool";
  rackSlotId: string;
  sourceId: string;
  sourceKind: "rack";
  toolId: string;
  toolType: ToolType;
};

export type RackDragPayload = BaseDragPayload & {
  entityKind: "rack";
  rackId: "autosampler_rack";
  sourceId: "autosampler_rack";
  sourceKind: "rack";
};

export type GrossBalanceToolDragPayload = BaseDragPayload & {
  entityId: string;
  entityKind: "tool";
  sourceId: string;
  sourceKind: "gross_balance";
  toolId: string;
  toolType: ToolType;
};

export type AnalyticalBalanceToolDragPayload = BaseDragPayload & {
  entityId: string;
  entityKind: "tool";
  sourceId: string;
  sourceKind: "analytical_balance";
  toolId: string;
  toolType: ToolType;
};

export type VortexToolDragPayload = BaseDragPayload & {
  entityId: string;
  entityKind: "tool";
  sourceId: string;
  sourceKind: "vortex";
  toolId: string;
  toolType: ToolType;
};

export type CentrifugeToolDragPayload = BaseDragPayload & {
  entityId: string;
  entityKind: "tool";
  sourceId: string;
  sourceKind: "centrifuge";
  toolId: string;
  toolType: ToolType;
};

export type IceBathToolDragPayload = BaseDragPayload & {
  entityId: string;
  entityKind: "tool";
  sourceId: string;
  sourceKind: "ice_bath";
  toolId: string;
  toolType: ToolType;
};

export type TrashToolDragPayload = BaseDragPayload & {
  entityId: string;
  entityKind: "tool";
  sourceId: string;
  sourceKind: "trash";
  toolId: string;
  toolType: ToolType;
  trashToolId: string;
};

export type WorkspaceWidgetDragPayload = BaseDragPayload & {
  entityKind: "workspace_widget";
  sourceId: string;
  sourceKind: "trash";
  widgetId: ExperimentWorkspaceWidgetId;
  widgetType: ExperimentWorkspaceWidgetType;
};

export type DragDescriptor =
  | (BaseDragPayload & {
      entityKind: "rack";
      rackId: "autosampler_rack";
    })
  | (BaseDragPayload & {
      entityId: string;
      entityKind: "tool";
      toolId: string;
      toolType: ToolType;
    })
  | (BaseDragPayload & {
      entityKind: "liquid";
      liquidId: string;
      liquidType: LiquidType;
      liquidEntryId?: string;
      widgetId?: "grinder";
    })
  | (BaseDragPayload & {
      entityKind: "workspace_widget";
      widgetId: string;
      widgetType: ExperimentWorkspaceWidgetType | WorkspaceWidgetType;
    })
  | (BaseDragPayload & {
      entityKind: "sample_label";
      label?: BenchLabel;
      sampleLabelId: string;
      sampleLabelText?: string;
      sourceSlotId?: string;
      trashSampleLabelId?: string;
    })
  | (BaseDragPayload & {
      entityKind: "lims_label_ticket";
      ticketId: string;
      sampleCode: string;
      labelText: string;
    })
  | (BaseDragPayload & {
      entityKind: "produce";
      debugProducePresetId?: DebugProducePresetId;
      produceLotId: string;
      produceType: ProduceLotType;
      sourceSlotId?: string;
      trashProduceLotId?: string;
    });

export type ContainedEntity = {
  entityKind: DragEntityKind;
  id: string;
  liquidType?: LiquidType | null;
  produceType?: ProduceLotType | null;
  toolType?: ToolType | null;
};

export type ContainmentRule = {
  entityKind: DragEntityKind;
  liquidType?: LiquidType | null;
  toolType?: ToolType | null;
};

export type Containment = {
  accepts: ContainmentRule[];
  blockedReason?: string | null;
  canReceive: boolean;
  capacity: number;
  children: ContainedEntity[];
  remainingCapacity: number;
};

export type BenchLiquidPortion = {
  id: string;
  liquidId: string;
  name: string;
  volume_ml: number;
  accent: ToolbarAccent;
};

export type BenchToolInstance = {
  id: string;
  toolId: string;
  label: string;
  subtitle: string;
  accent: ToolbarAccent;
  toolType: ToolType;
  capacity_ml: number;
  canReceiveLiquids: boolean;
  canReceiveProduce: boolean;
  canSeal: boolean;
  contactImpurityMgPerG?: number;
  internalPressureBar?: number;
  trappedCo2MassG?: number;
  isSealed?: boolean;
  closureFault?: string | null;
  fieldLabelText?: string | null;
  isDraggable: boolean;
  isDiscardable?: boolean;
  isStorable?: boolean;
  canStore?: boolean;
  allowedDropTargets: DropTargetType[];
  containment?: Containment | null;
  labels?: BenchLabel[];
  produceLots?: ExperimentProduceLot[];
  produceFractions?: ProduceFraction[];
  powderMassG?: number;
  containsSlurry?: boolean;
  liquids: BenchLiquidPortion[];
  quechersState?: QuechersState;
  istdPhaseAdded?: "pre_solvent" | "pre_salts" | "post_salts" | null;
  quechersExtractionResult?: QuechersExtractionResult | null;
  injectionContext?: InjectionContext | null;
  calibrationContext?: CalibrationContext | null;
};

export type QuechersState = {
  saltsAdded: boolean;
  phase:
    | "idle"
    | "armed"
    | "reacting"
    | "mixing"
    | "mixed"
    | "separating"
    | "separated"
    | "cemented"
    | "contaminated";
  temperatureC: number;
  /** Temperature of the mixture when the salts went in; sets how high the exotherm climbs. */
  startTemperatureC: number;
  cementationProgress: number;
  thermalDegradationProgress: number;
  reactionElapsedSeconds: number;
  separationProgress: number;
  faults: string[];
  isUsable: boolean;
};

export type CalibrationContext = {
  levelNgPerMl: number;
  compoundIds: string[];
};

export type QuechersExtractionResult = {
  extractionManipFactor: number;
  istdManipFactor: number | null;
  istdPhase: "pre_solvent" | "pre_salts" | "post_salts" | null;
};

export type InjectionContext = {
  sourceTubeId: string;
  sampleMassG: number;
  extractVolumeml: number;
  effectiveResiduesUgPerKg: Record<string, number>;
  extractionResult: QuechersExtractionResult | null;
  istdVolumeMl: number | null;
  istdReferenceConcNgPerMl: number;
};

export type TraceAcquisitionMetadata = {
  runDurationS: number;
  pointCount: number;
  samplingIntervalS: number;
  dwellTimeMs: number;
  polarity: "positive" | "negative";
  /** The declared (Q1, Q3) pair addresses a real reference channel. */
  matchedReferenceTransition: boolean;
  /** The declared retention window covers the moment the compound truly elutes. */
  acquiredInRetentionWindow: boolean;
};

/** Raw chromatogram recorded on one MRM channel — no integration, no concentration. */
export type TransitionTrace = {
  injectionId: string;
  transition: MrmTransition;
  timesS: number[];
  intensities: number[];
  acquisition: TraceAcquisitionMetadata;
};

export type InjectionMeasurement = {
  id: string;
  vialId: string;
  vialLabel: string;
  rackSlotId: string;
  status: "ok" | "no_extract_context" | "calibration" | "insufficient_volume";
  traces: TransitionTrace[];
  sampleName: string;
  injectionVolumeUl: number;
  replicateIndex: number;
  outputFilename: string;
  /** When this injection starts, in instrument seconds since the sequence began. */
  startOffsetS: number;
};

export type MrmTransition = {
  id: string;
  compoundId: string;
  compoundLabel: string;
  compoundKind: "analyte" | "internal_standard";
  q1Mz: number;
  q3Mz: number;
  polarity: "positive" | "negative";
  role: "quantifier" | "qualifier";
  collisionEnergyV: number;
  dwellTimeMs: number;
  expectedRetentionTimeS: number;
  retentionWindowS: number;
  internalStandardId: string | null;
  provenance: string;
};

export type GradientStep = {
  timeS: number;
  mobilePhaseBPercent: number;
};

export type LiquidChromatographyParameters = {
  columnLabel: string;
  columnTemperatureC: number;
  mobilePhaseA: string;
  mobilePhaseB: string;
  flowMlPerMin: number;
  gradient: GradientStep[];
};

export type IonSourceParameters = {
  sourceType: string;
  ionSprayVoltageV: number;
  sourceTemperatureC: number;
  nebulizerGasPsi: number;
  heaterGasPsi: number;
  curtainGasPsi: number;
};

export type AcquisitionMethod = {
  id: string;
  name: string;
  version: string;
  runtimeS: number;
  isEducational: boolean;
  provenanceNote: string;
  isBuiltIn: boolean;
  liquidChromatography: LiquidChromatographyParameters;
  ionSource: IonSourceParameters;
  transitions: MrmTransition[];
  /** Declared calibration ladder, in the order it was typed. Empty means the
   *  method declares none, and the exported method file carries no
   *  concentration column at all. */
  calibrationLevelsNgPerMl: number[];
};

export type MethodWarning = {
  code: string;
  transitionId: string;
  message: string;
};

export type SavedAcquisitionMethod = {
  method: AcquisitionMethod;
  warnings: MethodWarning[];
};

export type ReferenceCompound = {
  compoundId: string;
  compoundLabel: string;
  compoundKind: "analyte" | "internal_standard";
  transitions: {
    q1Mz: number;
    q3Mz: number;
    polarity: "positive" | "negative";
    role: "quantifier" | "qualifier";
    collisionEnergyV: number;
    expectedRetentionTimeS: number;
    provenance: string;
  }[];
};

export type AcquisitionMethodSummary = {
  id: string;
  name: string;
  version: string;
  runtimeS: number;
  isEducational: boolean;
  provenanceNote: string;
  isBuiltIn: boolean;
  compoundCount: number;
  transitionCount: number;
};

export type SequenceRun = {
  id: string;
  injections: InjectionMeasurement[];
  methodId: string;
  /** Immutable copy of the method this run was acquired with. */
  methodSnapshot: AcquisitionMethod;
  /** Instrument seconds the whole sequence takes: one run duration per injection. */
  totalDurationS: number;
  /** Instrument seconds recorded so far. Equal to totalDurationS once finished. */
  elapsedS: number;
};

export type SpatulaState = {
  allowedLoadSourceToolTypes?: ToolType[];
  allowedPourTargetToolTypes?: ToolType[];
  canDiscard?: boolean;
  clickIncrementMuG?: number;
  clickIncrementSigmaG?: number;
  holdInitialRateG?: number;
  holdIntervalMs?: number;
  holdLiftRateGPerPx?: number;
  holdMaxRateG?: number;
  holdThresholdMs?: number;
  isLoaded: boolean;
  produceFractions?: ProduceFraction[];
  sourceToolId: string | null;
};

export type PipetteState = {
  calibrationContext?: CalibrationContext | null;
  capacityMl: number;
  liquids?: BenchLiquidPortion[];
  produceFractions?: ProduceFraction[];
  produceLots?: ExperimentProduceLot[];
  volumeMl: number;
  sourceToolId: string | null;
};

export type ProduceMaterialState = {
  id: string;
  produceLotId: string;
  materialState?: ProduceMaterialKind;
  grindQualityLabel?: string | null;
  residualCo2MassG?: number;
  pesticideDegradationFactors?: Record<string, number>;
};

export type ProduceFraction = {
  id: string;
  produceLotId: string;
  /** How warm this body of material is. A lot split across two places has two. */
  temperatureC?: number;
  produceMaterialStateId: string;
  materialState?: ProduceMaterialKind;
  massG: number;
  unitCount?: number | null;
  isContaminated?: boolean;
  impurityMassMg?: number;
  exposureContainerIds?: string[];
  locationKind?:
    | "basket_tool"
    | "produce_basket"
    | "rack_tool"
    | "pipette"
    | "spatula"
    | "trash"
    | "workbench_surface"
    | "workbench_tool"
    | "workspace_widget"
    | "workspace_widget_tool"
    | null;
  locationId?: string | null;
  containerId?: string | null;
  containerLabel?: string | null;
};

export type BenchSlot = {
  children?: ContainedEntity[];
  containment?: Containment | null;
  id: string;
  label: string;
  dropTargetTypes?: DropTargetType[];
  surfaceProduceLots?: ExperimentProduceLot[];
  tool: BenchToolInstance | null;
};

export type RackSlot = {
  children?: ContainedEntity[];
  containment?: Containment | null;
  id: string;
  label: string;
  dropTargetTypes?: DropTargetType[];
  tool: BenchToolInstance | null;
};


export type PrintedLabelTicket = {
  id: string;
  sampleCode: string;
  labelText: string;
  receivedDate: string;
  isDraggable: boolean;
  allowedDropTargets: DropTargetType[];
};

export type LimsReception = {
  id: string | null;
  orchardName: string;
  harvestDate: string;
  indicativeMassG: number;
  measuredGrossMassG: number | null;
  packagingTareMassG: number;
  grossMassOffsetG: number;
  measuredSampleMassG: number | null;
  labSampleCode: string | null;
  status: "awaiting_reception" | "awaiting_label_application" | "received";
  printedLabelTicket: PrintedLabelTicket | null;
  /** Whether the operator vouched for the gross / tare / net calculation now on screen. */
  isMassCheckAcknowledged: boolean;
};

export type AnalyticalBalanceState = {
  tareMassG: number | null;
  taredToolId: string | null;
};

export type TrashProduceLotEntry = {
  id: string;
  originLabel: string;
  produceLot: ExperimentProduceLot;
};

export type TrashSampleLabelEntry = {
  id: string;
  originLabel: string;
  label: BenchLabel;
};

export type ExperimentWorkspaceWidget = {
  children?: ContainedEntity[];
  containment?: Containment | null;
  id: ExperimentWorkspaceWidgetId;
  widgetType: ExperimentWorkspaceWidgetType;
  label: string;
  dropTargetTypes?: DropTargetType[];
  isDraggable: boolean;
  allowedDropTargets: DropTargetType[];
  isStorable: boolean;
  canStore: boolean;
  anchor: WidgetAnchor;
  offsetX: number;
  offsetY: number;
  grinderRunDurationMs?: number;
  grinderRunRemainingMs?: number;
  grinderFault?: string | null;
  grinderCanStart?: boolean;
  grinderStartBlockReason?: string | null;
  grinderDisplayMode?: string | null;
  vortexRunDurationMs?: number;
  vortexRunRemainingMs?: number;
  centrifugeRunDurationMs?: number;
  centrifugeRunRemainingMs?: number;
  centrifugeSpeedRpm?: number;
  centrifugeCanStart?: boolean;
  centrifugeStartBlockReason?: string | null;
  isPresent: boolean;
  isTrashed: boolean;
  tool?: BenchToolInstance | null;
  produceLots?: ExperimentProduceLot[];
  liquids?: BenchLiquidPortion[];
  sequenceRuns?: SequenceRun[];
};

export type ExperimentProduceLot = {
  materialState?: ProduceMaterialKind;
  grindQualityLabel?: string | null;
  id: string;
  isContaminated?: boolean;
  isDraggable: boolean;
  allowedDropTargets: DropTargetType[];
  label: string;
  produceType: ProduceLotType;
  residualCo2MassG?: number;
  temperatureC?: number;
  totalMassG: number;
  unitCount: number | null;
  pesticideResidues?: Record<string, number>;
  pesticideDegradationFactors?: Record<string, number>;
};
