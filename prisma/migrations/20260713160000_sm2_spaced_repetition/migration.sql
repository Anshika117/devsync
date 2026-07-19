-- AlterTable
ALTER TABLE "ProblemProgress" ADD COLUMN "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5;
ALTER TABLE "ProblemProgress" ADD COLUMN "intervalDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProblemProgress" ADD COLUMN "nextReviewAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ProblemProgress_nextReviewAt_idx" ON "ProblemProgress"("nextReviewAt");
