-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'local',
    "providerId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "verificationToken" TEXT,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "age" INTEGER,
    "occupation" TEXT,
    "college" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRelationshipState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'stranger',
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "affinityScore" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "relationshipHealth" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "interactionDepth" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "totalTurnsCount" INTEGER NOT NULL DEFAULT 0,
    "signalsJson" TEXT NOT NULL DEFAULT '{}',
    "profileJson" TEXT NOT NULL DEFAULT '{}',
    "boundariesJson" TEXT NOT NULL DEFAULT '{}',
    "milestonesJson" TEXT NOT NULL DEFAULT '[]',
    "eventsJson" TEXT NOT NULL DEFAULT '[]',
    "historyJson" TEXT NOT NULL DEFAULT '[]',
    "lastInteractionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRelationshipState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryFact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "importance" INTEGER NOT NULL DEFAULT 5,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reflection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sentiment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reflection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT DEFAULT 'New Conversation',
    "currentTopic" TEXT DEFAULT 'General',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "lastInteractionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessageRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "emotion" TEXT DEFAULT 'neutral',
    "topic" TEXT DEFAULT 'General',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'obsidian',
    "accentColor" TEXT NOT NULL DEFAULT '#3b82f6',
    "avatarEyeColor" TEXT NOT NULL DEFAULT '#4338ca',
    "avatarGlowColor" TEXT NOT NULL DEFAULT '#3b82f6',
    "fontSize" TEXT NOT NULL DEFAULT 'medium',
    "animationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "soundFxEnabled" BOOLEAN NOT NULL DEFAULT true,
    "memoryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoSave" BOOLEAN NOT NULL DEFAULT true,
    "longTermMemory" BOOLEAN NOT NULL DEFAULT true,
    "sensitiveMemory" BOOLEAN NOT NULL DEFAULT false,
    "reviewBeforeSave" BOOLEAN NOT NULL DEFAULT false,
    "responseLength" TEXT NOT NULL DEFAULT 'medium',
    "personality" TEXT NOT NULL DEFAULT 'aura-gentle',
    "creativity" INTEGER NOT NULL DEFAULT 70,
    "empathy" INTEGER NOT NULL DEFAULT 90,
    "conversationStyle" TEXT NOT NULL DEFAULT 'empathic',
    "selectedMicrophone" TEXT NOT NULL DEFAULT 'default',
    "selectedSpeaker" TEXT NOT NULL DEFAULT 'default',
    "noiseSuppression" BOOLEAN NOT NULL DEFAULT true,
    "echoCancellation" BOOLEAN NOT NULL DEFAULT true,
    "selectedCamera" TEXT NOT NULL DEFAULT 'default',
    "eyeTracking" BOOLEAN NOT NULL DEFAULT true,
    "gestureTracking" BOOLEAN NOT NULL DEFAULT false,
    "visionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "cameraSensitivity" INTEGER NOT NULL DEFAULT 80,
    "desktopNotifications" BOOLEAN NOT NULL DEFAULT true,
    "reminderSettings" TEXT NOT NULL DEFAULT 'daily',
    "notificationSound" BOOLEAN NOT NULL DEFAULT true,
    "cameraPermission" BOOLEAN NOT NULL DEFAULT true,
    "microphonePermission" BOOLEAN NOT NULL DEFAULT true,
    "connectorsEnabled" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceSessionRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationSessionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "turnsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceSessionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRelationshipState_userId_key" ON "UserRelationshipState"("userId");

-- CreateIndex
CREATE INDEX "MemoryFact_userId_category_idx" ON "MemoryFact"("userId", "category");
CREATE INDEX "MemoryFact_userId_lastUsedAt_idx" ON "MemoryFact"("userId", "lastUsedAt");

-- CreateIndex
CREATE INDEX "Reflection_userId_idx" ON "Reflection"("userId");

-- CreateIndex
CREATE INDEX "ConversationSession_userId_lastInteractionAt_idx" ON "ConversationSession"("userId", "lastInteractionAt");

-- CreateIndex
CREATE INDEX "ChatMessageRecord_sessionId_createdAt_idx" ON "ChatMessageRecord"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_userId_key" ON "Settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceSessionRecord_sessionId_key" ON "VoiceSessionRecord"("sessionId");
CREATE INDEX "VoiceSessionRecord_userId_createdAt_idx" ON "VoiceSessionRecord"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRelationshipState" ADD CONSTRAINT "UserRelationshipState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryFact" ADD CONSTRAINT "MemoryFact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reflection" ADD CONSTRAINT "Reflection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationSession" ADD CONSTRAINT "ConversationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessageRecord" ADD CONSTRAINT "ChatMessageRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConversationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceSessionRecord" ADD CONSTRAINT "VoiceSessionRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
