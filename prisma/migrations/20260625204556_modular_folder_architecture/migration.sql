/*
  Warnings:

  - You are about to drop the column `folderId` on the `Problem` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,name,type]` on the table `Folder` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[url]` on the table `Problem` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "FolderType" AS ENUM ('AUTO', 'CUSTOM');

-- DropForeignKey
ALTER TABLE "Problem" DROP CONSTRAINT "Problem_folderId_fkey";

-- DropIndex
DROP INDEX "Folder_userId_name_key";

-- DropIndex
DROP INDEX "Problem_folderId_idx";

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "type" "FolderType" NOT NULL DEFAULT 'AUTO';

-- AlterTable
ALTER TABLE "Problem" DROP COLUMN "folderId";

-- CreateTable
CREATE TABLE "FolderProblem" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FolderProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE INDEX "FolderProblem_folderId_idx" ON "FolderProblem"("folderId");

-- CreateIndex
CREATE INDEX "FolderProblem_problemId_idx" ON "FolderProblem"("problemId");

-- CreateIndex
CREATE UNIQUE INDEX "FolderProblem_folderId_problemId_key" ON "FolderProblem"("folderId", "problemId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Folder_userId_name_type_key" ON "Folder"("userId", "name", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Problem_url_key" ON "Problem"("url");

-- AddForeignKey
ALTER TABLE "FolderProblem" ADD CONSTRAINT "FolderProblem_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolderProblem" ADD CONSTRAINT "FolderProblem_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
