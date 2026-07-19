/*
  Warnings:

  - A unique constraint covering the columns `[userId,url]` on the table `Problem` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Problem_url_key";

-- CreateIndex
CREATE UNIQUE INDEX "Problem_userId_url_key" ON "Problem"("userId", "url");
