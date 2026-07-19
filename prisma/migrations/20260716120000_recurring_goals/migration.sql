-- CreateTable
CREATE TABLE "RecurringGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringGoal_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "DailyGoal" ADD COLUMN "recurringGoalId" TEXT;

-- CreateIndex
CREATE INDEX "RecurringGoal_userId_active_idx" ON "RecurringGoal"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "DailyGoal_recurringGoalId_targetDate_key" ON "DailyGoal"("recurringGoalId", "targetDate");

-- AddForeignKey
ALTER TABLE "RecurringGoal" ADD CONSTRAINT "RecurringGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyGoal" ADD CONSTRAINT "DailyGoal_recurringGoalId_fkey" FOREIGN KEY ("recurringGoalId") REFERENCES "RecurringGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
