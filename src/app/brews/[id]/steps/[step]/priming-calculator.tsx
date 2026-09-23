"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui";
import { primingSugar, PRIMING_SUGARS, residualCo2 } from "@/lib/calc";

const toNum = (s: string) => (s.trim() === "" ? NaN : Number(s));

export function PrimingCalculator(props: { volumeL: number; targetCo2: number; maxTempC: number }) {
  const [volume, setVolume] = useState(String(props.volumeL));
  const [co2, setCo2] = useState(String(props.targetCo2));
  const [temp, setTemp] = useState(String(props.maxTempC));
  const [v, c, t] = [toNum(volume), toNum(co2), toNum(temp)];
  const valid = [v, c, t].every(Number.isFinite) && v > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Beer volume (L)">
          <Input type="number" step="0.1" min="0" inputMode="decimal" value={volume} onChange={(e) => setVolume(e.target.value)} />
        </Field>
        <Field label="Target CO₂ (vol)">
          <Input type="number" step="0.1" min="0" inputMode="decimal" value={co2} onChange={(e) => setCo2(e.target.value)} />
        </Field>
        <Field label="Warmest ferment temp (°C)" hint="Sets residual CO₂">
          <Input type="number" step="0.5" inputMode="decimal" value={temp} onChange={(e) => setTemp(e.target.value)} />
        </Field>
      </div>
      {valid && (
        <div role="status" className="grid grid-cols-2 gap-2 text-sm">
          {(Object.keys(PRIMING_SUGARS) as (keyof typeof PRIMING_SUGARS)[]).map((key) => (
            <div key={key} className="rounded-md bg-muted px-3 py-2">
              <div className="text-xs text-muted-foreground">{PRIMING_SUGARS[key].label}</div>
              <div className="text-lg font-semibold">{Math.round(primingSugar(v, c, t, key))} g</div>
            </div>
          ))}
          <p className="col-span-2 text-xs text-muted-foreground">
            Residual CO₂ already in the beer: {residualCo2(t).toFixed(2)} vol. For bottle conditioning; skip when force-carbonating a keg.
          </p>
        </div>
      )}
    </div>
  );
}
