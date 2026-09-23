-- CreateEnum
CREATE TYPE "IngredientType" AS ENUM ('GRAIN', 'HOP', 'YEAST', 'WATER', 'OTHER');

-- CreateEnum
CREATE TYPE "AdditionStage" AS ENUM ('MASH', 'SPARGE', 'BOIL', 'WHIRLPOOL', 'FERMENTATION', 'DRY_HOP', 'PACKAGING');

-- CreateEnum
CREATE TYPE "BrewStatus" AS ENUM ('PLANNING', 'BREWING', 'FERMENTING', 'CONDITIONING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StepType" AS ENUM ('WATER_PREP', 'MASHING', 'SPARGING', 'BOILING', 'COOLING', 'FERMENTATION', 'PACKAGING');

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "IngredientType" NOT NULL,
    "brand" TEXT,
    "supplier" TEXT,
    "notes" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "color" DOUBLE PRECISION,
    "potential" DOUBLE PRECISION,
    "alphaAcid" DOUBLE PRECISION,
    "form" TEXT,
    "attenuation" DOUBLE PRECISION,
    "flocculation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentProfile" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "batchSize" DOUBLE PRECISION NOT NULL,
    "boilOffRate" DOUBLE PRECISION NOT NULL,
    "mashTunDeadspace" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trubLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "efficiency" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "style" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeVersion" (
    "id" SERIAL NOT NULL,
    "recipeId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "equipmentProfileId" INTEGER,
    "batchSize" DOUBLE PRECISION NOT NULL,
    "boilTime" INTEGER NOT NULL DEFAULT 60,
    "targetOg" DOUBLE PRECISION,
    "targetFg" DOUBLE PRECISION,
    "targetIbu" DOUBLE PRECISION,
    "targetSrm" DOUBLE PRECISION,
    "targetCarbonation" DOUBLE PRECISION,
    "waterSource" TEXT,
    "mashWaterL" DOUBLE PRECISION,
    "spargeWaterL" DOUBLE PRECISION,
    "targetMashPh" DOUBLE PRECISION,

    CONSTRAINT "RecipeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" SERIAL NOT NULL,
    "recipeVersionId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "brandSnapshot" TEXT,
    "alphaAcidSnapshot" DOUBLE PRECISION,
    "colorSnapshot" DOUBLE PRECISION,
    "attenuationSnapshot" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "stage" "AdditionStage" NOT NULL,
    "additionTime" INTEGER,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MashStep" (
    "id" SERIAL NOT NULL,
    "recipeVersionId" INTEGER NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "timeMin" INTEGER NOT NULL,

    CONSTRAINT "MashStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrewSession" (
    "id" SERIAL NOT NULL,
    "recipeId" INTEGER NOT NULL,
    "recipeVersionId" INTEGER NOT NULL,
    "clonedFromSessionId" INTEGER,
    "batchNumber" INTEGER NOT NULL,
    "brewDate" TIMESTAMP(3) NOT NULL,
    "status" "BrewStatus" NOT NULL DEFAULT 'PLANNING',
    "actualVolume" DOUBLE PRECISION,
    "actualOg" DOUBLE PRECISION,
    "actualFg" DOUBLE PRECISION,
    "packagingMethod" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrewIngredient" (
    "id" SERIAL NOT NULL,
    "brewSessionId" INTEGER NOT NULL,
    "ingredientId" INTEGER,
    "nameSnapshot" TEXT NOT NULL,
    "plannedAmount" DOUBLE PRECISION,
    "actualAmount" DOUBLE PRECISION,
    "unit" TEXT NOT NULL,
    "stage" "AdditionStage" NOT NULL,
    "additionTime" INTEGER,
    "substitutedForName" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BrewIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrewStep" (
    "id" SERIAL NOT NULL,
    "brewSessionId" INTEGER NOT NULL,
    "type" "StepType" NOT NULL,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "BrewStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Measurement" (
    "id" SERIAL NOT NULL,
    "brewStepId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Problem" (
    "id" SERIAL NOT NULL,
    "brewSessionId" INTEGER NOT NULL,
    "brewStepId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cause" TEXT,
    "action" TEXT,
    "impact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "tags" TEXT[],
    "problemId" INTEGER,
    "brewSessionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FermentationLog" (
    "id" SERIAL NOT NULL,
    "brewStepId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "temperature" DOUBLE PRECISION,
    "gravity" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "activity" TEXT,
    "notes" TEXT,

    CONSTRAINT "FermentationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ingredient_type_isArchived_idx" ON "Ingredient"("type", "isArchived");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeVersion_recipeId_version_key" ON "RecipeVersion"("recipeId", "version");

-- CreateIndex
CREATE INDEX "RecipeIngredient_recipeVersionId_idx" ON "RecipeIngredient"("recipeVersionId");

-- CreateIndex
CREATE INDEX "MashStep_recipeVersionId_idx" ON "MashStep"("recipeVersionId");

-- CreateIndex
CREATE INDEX "BrewSession_brewDate_idx" ON "BrewSession"("brewDate");

-- CreateIndex
CREATE UNIQUE INDEX "BrewSession_recipeId_batchNumber_key" ON "BrewSession"("recipeId", "batchNumber");

-- CreateIndex
CREATE INDEX "BrewIngredient_brewSessionId_idx" ON "BrewIngredient"("brewSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "BrewStep_brewSessionId_type_key" ON "BrewStep"("brewSessionId", "type");

-- CreateIndex
CREATE INDEX "Measurement_brewStepId_idx" ON "Measurement"("brewStepId");

-- CreateIndex
CREATE INDEX "Problem_brewSessionId_idx" ON "Problem"("brewSessionId");

-- CreateIndex
CREATE INDEX "FermentationLog_brewStepId_idx" ON "FermentationLog"("brewStepId");

-- AddForeignKey
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_equipmentProfileId_fkey" FOREIGN KEY ("equipmentProfileId") REFERENCES "EquipmentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeVersionId_fkey" FOREIGN KEY ("recipeVersionId") REFERENCES "RecipeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MashStep" ADD CONSTRAINT "MashStep_recipeVersionId_fkey" FOREIGN KEY ("recipeVersionId") REFERENCES "RecipeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrewSession" ADD CONSTRAINT "BrewSession_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrewSession" ADD CONSTRAINT "BrewSession_recipeVersionId_fkey" FOREIGN KEY ("recipeVersionId") REFERENCES "RecipeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrewSession" ADD CONSTRAINT "BrewSession_clonedFromSessionId_fkey" FOREIGN KEY ("clonedFromSessionId") REFERENCES "BrewSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrewIngredient" ADD CONSTRAINT "BrewIngredient_brewSessionId_fkey" FOREIGN KEY ("brewSessionId") REFERENCES "BrewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrewIngredient" ADD CONSTRAINT "BrewIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrewStep" ADD CONSTRAINT "BrewStep_brewSessionId_fkey" FOREIGN KEY ("brewSessionId") REFERENCES "BrewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_brewStepId_fkey" FOREIGN KEY ("brewStepId") REFERENCES "BrewStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_brewSessionId_fkey" FOREIGN KEY ("brewSessionId") REFERENCES "BrewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_brewStepId_fkey" FOREIGN KEY ("brewStepId") REFERENCES "BrewStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_brewSessionId_fkey" FOREIGN KEY ("brewSessionId") REFERENCES "BrewSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FermentationLog" ADD CONSTRAINT "FermentationLog_brewStepId_fkey" FOREIGN KEY ("brewStepId") REFERENCES "BrewStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
