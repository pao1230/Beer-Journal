import { calcRecipe, type CalcIngredient } from "@/lib/calc";
import type { AdditionStage, IngredientType } from "@/generated/prisma/enums";

type Specs = {
  type: IngredientType;
  potential: number | null;
  waterSalt: string | null;
  alphaAcid: number | null;
  color: number | null;
  attenuation: number | null;
  unfermentable: boolean;
};

/** Recipe lines use their saved snapshots; potential and salt come from the ingredient itself. */
export function recipeLineToCalc(line: {
  nameSnapshot: string;
  amount: number;
  unit: string;
  stage: AdditionStage;
  additionTime: number | null;
  alphaAcidSnapshot: number | null;
  colorSnapshot: number | null;
  attenuationSnapshot: number | null;
  ingredient: Specs | null;
}): CalcIngredient {
  return {
    name: line.nameSnapshot,
    type: line.ingredient?.type ?? null,
    amount: line.amount,
    unit: line.unit,
    stage: line.stage,
    additionTime: line.additionTime,
    alphaAcid: line.alphaAcidSnapshot ?? line.ingredient?.alphaAcid ?? null,
    color: line.colorSnapshot ?? line.ingredient?.color ?? null,
    attenuation: line.attenuationSnapshot ?? line.ingredient?.attenuation ?? null,
    potential: line.ingredient?.potential ?? null,
    waterSalt: line.ingredient?.waterSalt ?? null,
    unfermentable: line.ingredient?.unfermentable ?? false,
  };
}

export function calcVersion(v: {
  batchSize: number;
  targetOg: number | null;
  mashWaterL: number | null;
  spargeWaterL: number | null;
  equipmentProfile: { efficiency: number; trubLoss: number } | null;
  ingredients: Parameters<typeof recipeLineToCalc>[0][];
}) {
  return calcRecipe({
    batchSize: v.batchSize,
    targetOg: v.targetOg,
    efficiency: v.equipmentProfile?.efficiency ?? null,
    trubLoss: v.equipmentProfile?.trubLoss ?? null,
    mashWaterL: v.mashWaterL,
    spargeWaterL: v.spargeWaterL,
    ingredients: v.ingredients.map(recipeLineToCalc),
  });
}

export const INGREDIENT_SPECS = {
  select: { type: true, potential: true, waterSalt: true, alphaAcid: true, color: true, attenuation: true, unfermentable: true },
} as const;
