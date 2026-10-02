-- CreateTable
CREATE TABLE "FermentationStep" (
    "id" SERIAL NOT NULL,
    "recipeVersionId" INTEGER NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION,
    "days" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "FermentationStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FermentationStep_recipeVersionId_idx" ON "FermentationStep"("recipeVersionId");

-- AddForeignKey
ALTER TABLE "FermentationStep" ADD CONSTRAINT "FermentationStep_recipeVersionId_fkey" FOREIGN KEY ("recipeVersionId") REFERENCES "RecipeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
