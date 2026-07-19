-- AlterTable
ALTER TABLE "Folder" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Folder_userId_order_idx" ON "Folder"("userId", "order");
