from __future__ import annotations

import math
from dataclasses import dataclass
from math import exp

from app.domain.models import ProduceLot, ProduceMaterialState, WorkbenchTool, WorkspaceWidget
from app.services.helpers.lookups import round_volume
from app.services.helpers.produce_material_states import find_material_state, get_material_state_name, get_temperature_c, update_material_state


@dataclass(frozen=True, slots=True)
class ContainerClosureRisk:
    should_pop: bool
    residual_co2_mass_g: float


@dataclass(frozen=True, slots=True)
class ContainerPressureEvent:
    fault: str
    pressure_bar: float
    lost_mass_g: float
    vented_co2_mass_g: float


class PhysicalSimulationService:
    grinder_cycle_duration_seconds = 30.0
    grinder_optimal_temperature_c = -40.0
    grinder_start_threshold_c = -20.0
    grinder_jam_threshold_c = -10.0
    ambient_temperature_c = 20.0
    dry_ice_temperature_c = -78.5
    dry_ice_latent_heat_kj_per_kg = 571.0
    thawed_apple_specific_heat_kj_per_kg_c = 3.59
    frozen_apple_specific_heat_kj_per_kg_c = 1.88
    apple_water_mass_fraction = 0.84
    water_latent_heat_fusion_kj_per_kg = 333.55
    freeze_start_temperature_c = 0.0
    freeze_end_temperature_c = -2.0
    heat_transfer_ua_kj_per_s_c = 1.5
    warming_rate_per_second = 0.014
    ambient_sublimation_g_per_second = 0.04
    residual_degassing_g_per_second = 12.0
    sealed_pressure_degassing_g_per_second = 0.03
    grinding_friction_heating_c_per_second = 0.4
    grinding_sublimation_boost = 15.0
    grinding_buffer_absorption_ratio = 0.2
    fine_powder_temperature_c = -60.0
    granular_temperature_c = -40.0
    poor_grind_temperature_c = -20.0
    minimum_container_headspace_ml = 100.0
    co2_molar_mass_g_per_mol = 44.01
    gas_constant_j_per_mol_k = 8.314
    atmospheric_pressure_bar = 1.0
    pressure_pop_homogeneity_cap = 0.25
    pressure_vent_homogeneity_cap = 0.55
    quechers_peak_temperature_c = 65.0
    quechers_heat_rise_seconds = 7.5
    quechers_cementation_seconds = 15.0
    quechers_degradation_threshold_c = 45.0
    quechers_full_degradation_seconds_at_peak = 30.0
    quechers_cooling_rate_per_second = 0.025

    def check_explosion_risk(
        self,
        tool: WorkbenchTool,
        *,
        material_states: list[ProduceMaterialState] | None = None,
    ) -> ContainerClosureRisk:
        return self._check_container_pressure_risk(tool, material_states=material_states)

    def advance_widget(
        self,
        widget: WorkspaceWidget,
        elapsed_seconds: float,
        *,
        material_states: list[ProduceMaterialState] | None = None,
    ) -> None:
        self._advance_widget_cryogenics(widget, elapsed_seconds, material_states=material_states)

    def advance_quechers_tool(self, tool: WorkbenchTool, elapsed_seconds: float) -> None:
        state = tool.quechers_state
        elapsed_seconds = max(float(elapsed_seconds), 0.0)
        if elapsed_seconds <= 0 or not state.salts_added:
            return
        if state.phase == "armed" and (tool.liquids or tool.produce_lots or tool.produce_fractions):
            state.phase = "cemented"
            state.faults = ["dry_salts_wetted"]
            state.cementation_progress = 1.0
            return
        if state.phase == "contaminated":
            return
        if state.phase == "armed" or (state.phase == "cemented" and state.reaction_elapsed_seconds <= 0):
            return

        state.reaction_elapsed_seconds += elapsed_seconds
        if state.reaction_elapsed_seconds <= self.quechers_heat_rise_seconds:
            ratio = state.reaction_elapsed_seconds / self.quechers_heat_rise_seconds
            state.temperature_c = self.ambient_temperature_c + (
                self.quechers_peak_temperature_c - self.ambient_temperature_c
            ) * ratio
        else:
            cooling_seconds = state.reaction_elapsed_seconds - self.quechers_heat_rise_seconds
            state.temperature_c = self.ambient_temperature_c + (
                self.quechers_peak_temperature_c - self.ambient_temperature_c
            ) * math.exp(-self.quechers_cooling_rate_per_second * cooling_seconds)

        if state.phase == "reacting":
            state.cementation_progress = min(
                state.reaction_elapsed_seconds / self.quechers_cementation_seconds,
                1.0,
            )
            if state.cementation_progress >= 1.0:
                state.phase = "cemented"
                state.faults = ["cemented"]

        if state.temperature_c > self.quechers_degradation_threshold_c:
            severity = (state.temperature_c - self.quechers_degradation_threshold_c) / (
                self.quechers_peak_temperature_c - self.quechers_degradation_threshold_c
            )
            state.thermal_degradation_progress = min(
                state.thermal_degradation_progress
                + elapsed_seconds * severity / self.quechers_full_degradation_seconds_at_peak,
                1.0,
            )

    def advance_grinding_widget(
        self,
        widget: WorkspaceWidget,
        elapsed_seconds: float,
        *,
        material_states: list[ProduceMaterialState] | None = None,
    ) -> None:
        self._advance_grinding_cryogenics(widget, elapsed_seconds, material_states=material_states)

    def advance_sealed_tool(
        self,
        tool: WorkbenchTool,
        elapsed_seconds: float,
        *,
        material_states: list[ProduceMaterialState] | None = None,
    ) -> ContainerPressureEvent | None:
        if not tool.is_sealed:
            self._reset_container_pressure(tool)
            return None

        self._warm_sealed_tool_produce(tool, elapsed_seconds, material_states=material_states)
        tool.internal_pressure_bar = self._calculate_container_pressure_bar(
            tool,
            material_states=material_states,
        )
        risk = self._check_container_pressure_risk(tool, material_states=material_states)
        if not risk.should_pop:
            return None

        lost_mass_g = 0.0
        for produce_lot in tool.produce_lots:
            material_state_record = find_material_state(material_states or [], produce_lot.id)
            previous_mass_g = produce_lot.total_mass_g
            produce_lot.total_mass_g = round_volume(max(produce_lot.total_mass_g * 0.8, 0.0))
            if material_state_record is not None:
                material_state_record.residual_co2_mass_g = round_volume(max(material_state_record.residual_co2_mass_g * 0.8, 0.0))
            self._degrade_pressure_exposed_homogeneity(
                produce_lot,
                self.pressure_pop_homogeneity_cap,
                material_states=material_states,
            )
            lost_mass_g += max(previous_mass_g - produce_lot.total_mass_g, 0.0)

        pressure_bar = tool.internal_pressure_bar
        vented_co2_mass_g = tool.trapped_co2_mass_g
        tool.is_sealed = False
        tool.closure_fault = "pressure_pop"
        self._reset_container_pressure(tool)
        return ContainerPressureEvent(
            fault="pressure_pop",
            pressure_bar=pressure_bar,
            lost_mass_g=round_volume(lost_mass_g),
            vented_co2_mass_g=round_volume(vented_co2_mass_g),
        )

    def vent_opened_tool(
        self,
        tool: WorkbenchTool,
        *,
        material_states: list[ProduceMaterialState] | None = None,
    ) -> ContainerPressureEvent | None:
        pressure_bar = max(tool.internal_pressure_bar, self.atmospheric_pressure_bar)
        trapped_co2_mass_g = round_volume(max(tool.trapped_co2_mass_g, 0.0))
        if pressure_bar <= 1.05 and trapped_co2_mass_g <= 0:
            self._reset_container_pressure(tool)
            return None

        lost_mass_g = 0.0
        overpressure_bar = max(pressure_bar - self.atmospheric_pressure_bar, 0.0)
        for produce_lot in tool.produce_lots:
            material_state = get_material_state_name(material_states or [], produce_lot.id)
            if material_state == "ground":
                loss_ratio = min(overpressure_bar * 0.05, 0.4)
            elif material_state == "cut":
                loss_ratio = min(overpressure_bar * 0.02, 0.2)
            else:
                loss_ratio = 0.0
            if loss_ratio <= 0:
                continue

            previous_mass_g = produce_lot.total_mass_g
            produce_lot.total_mass_g = round_volume(max(produce_lot.total_mass_g * (1.0 - loss_ratio), 0.0))
            self._degrade_pressure_exposed_homogeneity(
                produce_lot,
                self.pressure_vent_homogeneity_cap,
                material_states=material_states,
            )
            lost_mass_g += max(previous_mass_g - produce_lot.total_mass_g, 0.0)

        self._reset_container_pressure(tool)
        return ContainerPressureEvent(
            fault="pressure_vent",
            pressure_bar=pressure_bar,
            lost_mass_g=round_volume(lost_mass_g),
            vented_co2_mass_g=trapped_co2_mass_g,
        )

    def score_grind_result(self, state: ProduceMaterialState) -> tuple[float | None, str | None]:
        if state.grinding_elapsed_seconds <= 0:
            return None, None

        average_temperature_c = state.grinding_temperature_integral / state.grinding_elapsed_seconds
        if average_temperature_c <= -75.0:
            return 0.97, "powder_fine"
        if average_temperature_c <= self.fine_powder_temperature_c:
            return (
                self._interpolate_score(
                    average_temperature_c,
                    -75.0,
                    self.fine_powder_temperature_c,
                    0.97,
                    0.85,
                ),
                "powder_fine",
            )
        if average_temperature_c <= self.granular_temperature_c:
            return (
                self._interpolate_score(
                    average_temperature_c,
                    self.fine_powder_temperature_c,
                    self.granular_temperature_c,
                    0.85,
                    0.55,
                ),
                "granular",
            )
        if average_temperature_c <= self.poor_grind_temperature_c:
            return (
                self._interpolate_score(
                    average_temperature_c,
                    self.granular_temperature_c,
                    self.poor_grind_temperature_c,
                    0.55,
                    0.2,
                ),
                "coarse",
            )
        return (
            self._interpolate_score(
                average_temperature_c,
                self.poor_grind_temperature_c,
                self.grinder_jam_threshold_c,
                0.2,
                0.05,
            ),
            "pasty",
        )

    def warm_produce_lots(
        self,
        produce_lots: list[ProduceLot],
        elapsed_seconds: float,
        *,
        material_states: list[ProduceMaterialState] | None = None,
    ) -> None:
        for lot in produce_lots:
            self._warm_open_produce_lot(lot, elapsed_seconds, material_states=material_states)

    def _check_container_pressure_risk(
        self,
        tool: WorkbenchTool,
        *,
        material_states: list[ProduceMaterialState] | None = None,
    ) -> ContainerClosureRisk:
        residual_co2_mass_g = round_volume(
            sum(
                max((s.residual_co2_mass_g if (s := find_material_state(material_states or [], lot.id)) is not None else 0.0), 0.0)
                for lot in tool.produce_lots
            )
        )
        should_pop = tool.internal_pressure_bar >= self._get_container_pop_threshold_bar(tool.tool_type)
        return ContainerClosureRisk(
            should_pop=should_pop,
            residual_co2_mass_g=residual_co2_mass_g,
        )

    def _advance_widget_cryogenics(
        self,
        widget: WorkspaceWidget,
        elapsed_seconds: float,
        *,
        material_states: list[ProduceMaterialState] | None = None,
    ) -> None:
        total_produce_mass_g = sum(lot.total_mass_g for lot in widget.produce_lots)
        dry_ice = next(
            (liquid for liquid in widget.liquids if liquid.liquid_id == "dry_ice_pellets"),
            None,
        )

        if dry_ice is not None and dry_ice.volume_ml > 0:
            if total_produce_mass_g > 0:
                self._cool_widget_produce(
                    widget=widget,
                    dry_ice_mass_g=dry_ice.volume_ml,
                    elapsed_seconds=elapsed_seconds,
                    total_produce_mass_g=total_produce_mass_g,
                    material_states=material_states,
                )
                dry_ice.volume_ml = round_volume(
                    max(
                        dry_ice.volume_ml - self._calculate_ambient_sublimation_mass_loss(elapsed_seconds),
                        0.0,
                    )
                )
                self._remove_empty_liquids(widget)
                return

            dry_ice.volume_ml = round_volume(
                max(
                    dry_ice.volume_ml - self._calculate_ambient_sublimation_mass_loss(elapsed_seconds),
                    0.0,
                )
            )
            self._remove_empty_liquids(widget)
            return

        self.warm_produce_lots(widget.produce_lots, elapsed_seconds, material_states=material_states)

    def _advance_grinding_cryogenics(
        self,
        widget: WorkspaceWidget,
        elapsed_seconds: float,
        *,
        material_states: list[ProduceMaterialState] | None = None,
    ) -> None:
        total_produce_mass_g = sum(lot.total_mass_g for lot in widget.produce_lots)
        if total_produce_mass_g <= 0:
            self._sublimate_dry_ice(
                widget,
                elapsed_seconds,
                boost=self.grinding_sublimation_boost,
            )
            return

        dry_ice = next(
            (liquid for liquid in widget.liquids if liquid.liquid_id == "dry_ice_pellets"),
            None,
        )
        dry_ice_mass_g = dry_ice.volume_ml if dry_ice is not None else 0.0
        buffer_factor = min(dry_ice_mass_g / max(total_produce_mass_g * 0.08, 1.0), 1.0)
        absorbed_heat_ratio = self.grinding_buffer_absorption_ratio * buffer_factor
        base_heat_gain_c = self.grinding_friction_heating_c_per_second * elapsed_seconds
        effective_heat_gain_c = base_heat_gain_c * (1.0 - absorbed_heat_ratio)

        for lot in widget.produce_lots:
            previous_temperature_c = get_temperature_c(material_states or [], lot.id)
            next_temperature_c = previous_temperature_c + effective_heat_gain_c
            average_step_temperature_c = (previous_temperature_c + next_temperature_c) / 2.0
            existing_state = find_material_state(material_states or [], lot.id)
            update_material_state(
                material_states or [],
                lot.id,
                temperature_c=next_temperature_c,
                grinding_temperature_integral=(
                    (existing_state.grinding_temperature_integral if existing_state is not None else 0.0)
                    + (average_step_temperature_c * elapsed_seconds)
                ),
                grinding_elapsed_seconds=((existing_state.grinding_elapsed_seconds if existing_state is not None else 0.0) + elapsed_seconds),
            )

        absorbed_heat_kj = 0.0
        for lot in widget.produce_lots:
            thermal_mass_kg = max(lot.total_mass_g, 0.0) / 1000.0
            if thermal_mass_kg <= 0:
                continue
            absorbed_heat_kj += thermal_mass_kg * self.thawed_apple_specific_heat_kj_per_kg_c * base_heat_gain_c * absorbed_heat_ratio

        self._sublimate_dry_ice(
            widget,
            elapsed_seconds,
            boost=self.grinding_sublimation_boost,
            extra_mass_loss_g=(absorbed_heat_kj / self.dry_ice_latent_heat_kj_per_kg) * 1000.0,
        )

    def _interpolate_score(
        self,
        value: float,
        min_value: float,
        max_value: float,
        min_score: float,
        max_score: float,
    ) -> float:
        if max_value <= min_value:
            return round(min_score, 3)

        ratio = min(max((value - min_value) / (max_value - min_value), 0.0), 1.0)
        return round(min_score + ((max_score - min_score) * ratio), 3)

    def _cool_widget_produce(
        self,
        *,
        widget: WorkspaceWidget,
        dry_ice_mass_g: float,
        elapsed_seconds: float,
        total_produce_mass_g: float,
        material_states: list[ProduceMaterialState] | None = None,
    ) -> None:
        contact_factor = min(dry_ice_mass_g / max(total_produce_mass_g, 1.0), 1.0)
        available_thermal_energy_kj = max(dry_ice_mass_g, 0.0) / 1000.0 * self.dry_ice_latent_heat_kj_per_kg
        requested_heat_removal_kj = 0.0
        lot_requests: list[tuple[ProduceLot, float, float]] = []

        for lot in widget.produce_lots:
            current_temperature_c = get_temperature_c(material_states or [], lot.id)
            temperature_gap_c = max(current_temperature_c - self.dry_ice_temperature_c, 0.0)
            if temperature_gap_c <= 0:
                lot_requests.append((lot, 0.0, current_temperature_c))
                continue

            mass_fraction = lot.total_mass_g / max(total_produce_mass_g, 1.0)
            thermal_mass_kg = max(lot.total_mass_g, 0.0) / 1000.0
            if thermal_mass_kg <= 0:
                lot_requests.append((lot, 0.0, current_temperature_c))
                continue

            effective_cp = self._get_effective_specific_heat(current_temperature_c)
            cooling_rate = self.heat_transfer_ua_kj_per_s_c * contact_factor * mass_fraction / max(thermal_mass_kg * effective_cp, 1e-9)
            candidate_temperature_c = self.dry_ice_temperature_c + (current_temperature_c - self.dry_ice_temperature_c) * exp(
                -cooling_rate * elapsed_seconds
            )
            lot_heat_request_kj = thermal_mass_kg * max(
                self._get_specific_enthalpy(current_temperature_c) - self._get_specific_enthalpy(candidate_temperature_c),
                0.0,
            )
            lot_requests.append((lot, lot_heat_request_kj, candidate_temperature_c))
            requested_heat_removal_kj += lot_heat_request_kj

        usable_heat_removal_kj = min(requested_heat_removal_kj, available_thermal_energy_kj)
        scaling_factor = usable_heat_removal_kj / requested_heat_removal_kj if requested_heat_removal_kj > 0 else 0.0

        for lot, requested_heat_kj, candidate_temperature_c in lot_requests:
            actual_heat_kj = requested_heat_kj * scaling_factor
            if actual_heat_kj <= 0:
                continue

            thermal_mass_kg = max(lot.total_mass_g, 0.0) / 1000.0
            if thermal_mass_kg <= 0:
                continue

            if scaling_factor >= 0.999:
                update_material_state(
                    material_states or [],
                    lot.id,
                    temperature_c=max(candidate_temperature_c, self.dry_ice_temperature_c),
                )
                continue

            current_temperature_c = get_temperature_c(material_states or [], lot.id)
            current_enthalpy = self._get_specific_enthalpy(current_temperature_c)
            next_enthalpy = current_enthalpy - (actual_heat_kj / thermal_mass_kg)
            update_material_state(
                material_states or [],
                lot.id,
                temperature_c=self._get_temperature_from_specific_enthalpy(next_enthalpy),
            )

        thermal_mass_loss_g = usable_heat_removal_kj / self.dry_ice_latent_heat_kj_per_kg * 1000.0
        dry_ice = next(
            (liquid for liquid in widget.liquids if liquid.liquid_id == "dry_ice_pellets"),
            None,
        )
        if dry_ice is not None:
            dry_ice.volume_ml = round_volume(max(dry_ice.volume_ml - thermal_mass_loss_g, 0.0))
            self._remove_empty_liquids(widget)

    def _calculate_ambient_sublimation_mass_loss(self, elapsed_seconds: float) -> float:
        return self.ambient_sublimation_g_per_second * elapsed_seconds

    def _warm_open_produce_lot(
        self,
        lot: ProduceLot,
        elapsed_seconds: float,
        *,
        material_states: list[ProduceMaterialState] | None = None,
    ) -> None:
        warming_progress = min(self.warming_rate_per_second * elapsed_seconds, 0.95)
        current_temperature_c = get_temperature_c(material_states or [], lot.id)
        current_state = find_material_state(material_states or [], lot.id)
        current_residual_co2_mass_g = current_state.residual_co2_mass_g if current_state is not None else 0.0
        update_material_state(
            material_states or [],
            lot.id,
            temperature_c=min(
                current_temperature_c + ((self.ambient_temperature_c - current_temperature_c) * warming_progress),
                self.ambient_temperature_c,
            ),
            residual_co2_mass_g=round_volume(
                max(
                    current_residual_co2_mass_g - (self.residual_degassing_g_per_second * elapsed_seconds),
                    0.0,
                )
            ),
        )

    def _warm_sealed_tool_produce(
        self,
        tool: WorkbenchTool,
        elapsed_seconds: float,
        *,
        material_states: list[ProduceMaterialState] | None = None,
    ) -> None:
        for lot in tool.produce_lots:
            warming_progress = min(self.warming_rate_per_second * elapsed_seconds, 0.95)
            current_temperature_c = get_temperature_c(material_states or [], lot.id)
            next_temperature_c = min(
                current_temperature_c + ((self.ambient_temperature_c - current_temperature_c) * warming_progress),
                self.ambient_temperature_c,
            )
            degassing_rate_g_per_second = self._get_sealed_degassing_rate(next_temperature_c)
            existing_state = find_material_state(material_states or [], lot.id)
            trapped_mass_g = min(
                max((existing_state.residual_co2_mass_g if existing_state is not None else 0.0), 0.0),
                degassing_rate_g_per_second * elapsed_seconds,
            )
            update_material_state(
                material_states or [],
                lot.id,
                temperature_c=next_temperature_c,
                residual_co2_mass_g=round_volume(
                    max(
                        (existing_state.residual_co2_mass_g if existing_state is not None else 0.0) - trapped_mass_g,
                        0.0,
                    )
                ),
            )
            if trapped_mass_g <= 0:
                continue
            tool.trapped_co2_mass_g = round_volume(tool.trapped_co2_mass_g + trapped_mass_g)

    def _get_sealed_degassing_rate(self, temperature_c: float) -> float:
        if temperature_c <= -70.0:
            return self.sealed_pressure_degassing_g_per_second * 0.35
        if temperature_c <= -40.0:
            return self.sealed_pressure_degassing_g_per_second * 0.7
        if temperature_c <= 0.0:
            return self.sealed_pressure_degassing_g_per_second
        return self.sealed_pressure_degassing_g_per_second * 1.5

    def _calculate_container_pressure_bar(
        self,
        tool: WorkbenchTool,
        *,
        material_states: list[ProduceMaterialState] | None = None,
    ) -> float:
        trapped_co2_mass_g = max(tool.trapped_co2_mass_g, 0.0)
        if trapped_co2_mass_g <= 0:
            return self.atmospheric_pressure_bar

        gas_moles = trapped_co2_mass_g / self.co2_molar_mass_g_per_mol
        mean_temperature_c = (
            sum(get_temperature_c(material_states or [], lot.id) for lot in tool.produce_lots) / len(tool.produce_lots)
            if tool.produce_lots
            else self.ambient_temperature_c
        )
        temperature_k = max(mean_temperature_c + 273.15, 1.0)
        free_volume_m3 = (
            self._get_free_container_volume_ml(
                tool,
                material_states=material_states,
            )
            / 1_000_000.0
        )
        pressure_pa = (gas_moles * self.gas_constant_j_per_mol_k * temperature_k) / max(
            free_volume_m3,
            1e-9,
        )
        return round_volume(pressure_pa / 100000.0)

    def _get_free_container_volume_ml(
        self,
        tool: WorkbenchTool,
        *,
        material_states: list[ProduceMaterialState] | None = None,
    ) -> float:
        occupied_volume_ml = sum(
            self._estimate_lot_occupied_volume_ml(
                lot,
                material_states=material_states,
            )
            for lot in tool.produce_lots
        )
        liquid_volume_ml = sum(max(liquid.volume_ml, 0.0) for liquid in tool.liquids)
        return max(
            tool.capacity_ml - occupied_volume_ml - liquid_volume_ml,
            self.minimum_container_headspace_ml,
        )

    def _estimate_lot_occupied_volume_ml(
        self,
        lot: ProduceLot,
        *,
        material_states: list[ProduceMaterialState] | None = None,
    ) -> float:
        density_g_per_ml = self._get_apparent_density_g_per_ml(
            lot,
            material_states=material_states,
        )
        return max(lot.total_mass_g, 0.0) / max(density_g_per_ml, 1e-6)

    def _get_apparent_density_g_per_ml(
        self,
        lot: ProduceLot,
        *,
        material_states: list[ProduceMaterialState] | None = None,
    ) -> float:
        return self._get_apparent_density_g_per_ml_for_state(
            get_material_state_name(material_states or [], lot.id),
        )

    def _get_apparent_density_g_per_ml_for_state(self, material_state: str) -> float:
        if material_state == "ground":
            return 0.5
        if material_state == "cut":
            return 0.72
        return 0.85

    def _get_container_pop_threshold_bar(self, tool_type: str) -> float:
        if tool_type == "storage_jar":
            return 5.0
        if tool_type == "sample_bag":
            return 1.4
        if tool_type == "sample_vial":
            return 3.5
        if tool_type == "cleanup_tube":
            return 2.4
        if tool_type == "centrifuge_tube":
            return 2.8
        return 5.0

    def _degrade_pressure_exposed_homogeneity(
        self,
        produce_lot: ProduceLot,
        cap: float,
        *,
        material_states: list[ProduceMaterialState] | None = None,
    ) -> None:
        if get_material_state_name(material_states or [], produce_lot.id) != "ground":
            return
        current_state = find_material_state(material_states or [], produce_lot.id)
        if current_state is None or current_state.homogeneity_score is None:
            update_material_state(material_states or [], produce_lot.id, homogeneity_score=round(cap, 3))
            return
        update_material_state(
            material_states or [],
            produce_lot.id,
            homogeneity_score=round(min(current_state.homogeneity_score, cap), 3),
        )

    def _reset_container_pressure(self, tool: WorkbenchTool) -> None:
        tool.internal_pressure_bar = self.atmospheric_pressure_bar
        tool.trapped_co2_mass_g = 0.0

    def _remove_empty_liquids(self, widget: WorkspaceWidget) -> None:
        widget.liquids = [liquid for liquid in widget.liquids if liquid.volume_ml > 0]

    def _sublimate_dry_ice(
        self,
        widget: WorkspaceWidget,
        elapsed_seconds: float,
        *,
        boost: float = 1.0,
        extra_mass_loss_g: float = 0.0,
    ) -> None:
        dry_ice = next(
            (liquid for liquid in widget.liquids if liquid.liquid_id == "dry_ice_pellets"),
            None,
        )
        if dry_ice is None:
            return

        dry_ice.volume_ml = round_volume(
            max(
                dry_ice.volume_ml - (self._calculate_ambient_sublimation_mass_loss(elapsed_seconds) * boost) - extra_mass_loss_g,
                0.0,
            )
        )
        self._remove_empty_liquids(widget)

    def _get_effective_specific_heat(self, temperature_c: float) -> float:
        if temperature_c >= self.freeze_start_temperature_c:
            return self.thawed_apple_specific_heat_kj_per_kg_c

        if temperature_c <= self.freeze_end_temperature_c:
            return self.frozen_apple_specific_heat_kj_per_kg_c

        phase_band_width_c = self.freeze_start_temperature_c - self.freeze_end_temperature_c
        latent_component = (self.apple_water_mass_fraction * self.water_latent_heat_fusion_kj_per_kg) / phase_band_width_c
        sensible_component = (self.thawed_apple_specific_heat_kj_per_kg_c + self.frozen_apple_specific_heat_kj_per_kg_c) / 2.0
        return latent_component + sensible_component

    def _get_specific_enthalpy(self, temperature_c: float) -> float:
        frozen_band_span_c = self.freeze_end_temperature_c - self.dry_ice_temperature_c
        frozen_enthalpy_at_phase_start = self.frozen_apple_specific_heat_kj_per_kg_c * frozen_band_span_c
        latent_enthalpy = self.apple_water_mass_fraction * self.water_latent_heat_fusion_kj_per_kg

        if temperature_c <= self.freeze_end_temperature_c:
            return self.frozen_apple_specific_heat_kj_per_kg_c * (temperature_c - self.dry_ice_temperature_c)

        if temperature_c <= self.freeze_start_temperature_c:
            phase_progress = (temperature_c - self.freeze_end_temperature_c) / (self.freeze_start_temperature_c - self.freeze_end_temperature_c)
            return frozen_enthalpy_at_phase_start + (phase_progress * latent_enthalpy)

        return (
            frozen_enthalpy_at_phase_start
            + latent_enthalpy
            + (temperature_c - self.freeze_start_temperature_c) * self.thawed_apple_specific_heat_kj_per_kg_c
        )

    def _get_temperature_from_specific_enthalpy(
        self,
        specific_enthalpy_kj_per_kg: float,
    ) -> float:
        frozen_band_span_c = self.freeze_end_temperature_c - self.dry_ice_temperature_c
        frozen_enthalpy_at_phase_start = self.frozen_apple_specific_heat_kj_per_kg_c * frozen_band_span_c
        latent_enthalpy = self.apple_water_mass_fraction * self.water_latent_heat_fusion_kj_per_kg
        thawed_enthalpy_at_zero = frozen_enthalpy_at_phase_start + latent_enthalpy

        if specific_enthalpy_kj_per_kg <= frozen_enthalpy_at_phase_start:
            return self.dry_ice_temperature_c + (specific_enthalpy_kj_per_kg / self.frozen_apple_specific_heat_kj_per_kg_c)

        if specific_enthalpy_kj_per_kg <= thawed_enthalpy_at_zero:
            phase_progress = (specific_enthalpy_kj_per_kg - frozen_enthalpy_at_phase_start) / latent_enthalpy
            return self.freeze_end_temperature_c + (phase_progress * (self.freeze_start_temperature_c - self.freeze_end_temperature_c))

        return self.freeze_start_temperature_c + (
            (specific_enthalpy_kj_per_kg - thawed_enthalpy_at_zero) / self.thawed_apple_specific_heat_kj_per_kg_c
        )
