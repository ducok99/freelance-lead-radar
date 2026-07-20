import {
  CircuitBreakerSchema,
  SystemStateSchema,
  type CircuitBreaker,
  type SystemState,
  type WarningReason,
} from "@flr/shared";

export type PipelineStopReason = "emergency_stop" | "circuit_breaker";

export const tripCircuitBreaker = (
  current: CircuitBreaker,
  reason: WarningReason,
  trippedAt: string,
): CircuitBreaker => {
  if (current.state === "tripped") return current;
  return CircuitBreakerSchema.parse({ state: "tripped", reason, trippedAt });
};

export const resetCircuitBreaker = (
  current: CircuitBreaker,
  userConfirmed: boolean,
): CircuitBreaker => {
  if (!userConfirmed) {
    throw new Error("Circuit breaker chỉ được reset sau xác nhận thủ công");
  }
  return current.state === "armed"
    ? current
    : CircuitBreakerSchema.parse({ state: "armed" });
};

export const setEmergencyStop = (
  state: SystemState,
  enabled: boolean,
): SystemState => SystemStateSchema.parse({ ...state, emergencyStop: enabled });

export const getPipelineStopReasons = (
  state: SystemState,
): PipelineStopReason[] => {
  const reasons: PipelineStopReason[] = [];
  if (state.emergencyStop) reasons.push("emergency_stop");
  if (state.circuitBreaker.state === "tripped") {
    reasons.push("circuit_breaker");
  }
  return reasons;
};

export const isPipelineStopped = (state: SystemState): boolean =>
  getPipelineStopReasons(state).length > 0;
