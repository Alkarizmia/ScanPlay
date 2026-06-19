import { useEffect, useState } from 'react';
import { getPlan, PLAN_CHANGED_EVENT } from '../lib/planLimits';
import type { Plan } from '../types';

export function usePlan(refreshKey = 0): Plan {
  const [plan, setPlanState] = useState<Plan>(() => getPlan());

  useEffect(() => {
    setPlanState(getPlan());
  }, [refreshKey]);

  useEffect(() => {
    const onChange = () => setPlanState(getPlan());
    window.addEventListener(PLAN_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(PLAN_CHANGED_EVENT, onChange);
  }, []);

  return plan;
}
