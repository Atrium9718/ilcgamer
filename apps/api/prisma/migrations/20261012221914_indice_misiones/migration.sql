-- CreateIndex
CREATE INDEX "mission_progress_userId_moduleId_startedAt_idx" ON "mission_progress"("userId", "moduleId", "startedAt");
