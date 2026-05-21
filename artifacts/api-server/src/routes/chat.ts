import { Router } from "express";
import { db } from "@workspace/db";
import { chatChannelsTable, chatMessagesTable, usersTable } from "@workspace/db";
import { eq, and, or, sql, isNull, isNotNull, asc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// GET /chat/channels
router.get("/channels", requireAuth, async (req, res) => {
  try {
    const channels = await db.select().from(chatChannelsTable)
      .where(eq(chatChannelsTable.companyId, req.companyId!))
      .orderBy(asc(chatChannelsTable.createdAt));

    const currentUserId = req.userId!;
    const withUnread = await Promise.all(channels.map(async (ch) => {
      const [row] = await db.select({ count: sql<number>`count(*)::int` })
        .from(chatMessagesTable)
        .where(and(
          eq(chatMessagesTable.channelId, ch.id),
          eq(chatMessagesTable.isRead, false),
          sql`${chatMessagesTable.fromUserId} != ${currentUserId}`
        ));
      return { ...ch, unreadCount: Number(row?.count ?? 0) };
    }));

    res.json(withUnread);
  } catch (err) {
    req.log.error({ err }, "List channels error");
    res.status(500).json({ error: "Server error" });
  }
});

// POST /chat/channels
router.post("/channels", requireAuth, async (req, res) => {
  try {
    const { name, description, type = "public" } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ error: "Bad Request", message: "اسم القناة مطلوب" });
      return;
    }
    const inserted = await db.insert(chatChannelsTable).values({
      companyId: req.companyId!,
      name: name.trim(),
      description: description?.trim() || null,
      type,
      createdByUserId: req.userId,
    }).returning();
    res.status(201).json(inserted[0]);
  } catch (err) {
    req.log.error({ err }, "Create channel error");
    res.status(500).json({ error: "Server error" });
  }
});

// GET /chat/channels/:id/messages
router.get("/channels/:id/messages", requireAuth, async (req, res) => {
  try {
    const channelId = parseInt(req.params.id);
    const currentUserId = req.userId!;

    const messages = await db.select({
      id: chatMessagesTable.id,
      content: chatMessagesTable.content,
      fromUserId: chatMessagesTable.fromUserId,
      fromUserName: usersTable.name,
      createdAt: chatMessagesTable.createdAt,
      isRead: chatMessagesTable.isRead,
    })
      .from(chatMessagesTable)
      .leftJoin(usersTable, eq(chatMessagesTable.fromUserId, usersTable.id))
      .where(and(
        eq(chatMessagesTable.channelId, channelId),
        eq(chatMessagesTable.companyId, req.companyId!)
      ))
      .orderBy(asc(chatMessagesTable.createdAt))
      .limit(100);

    // Mark messages from others as read
    await db.update(chatMessagesTable)
      .set({ isRead: true })
      .where(and(
        eq(chatMessagesTable.channelId, channelId),
        eq(chatMessagesTable.companyId, req.companyId!),
        eq(chatMessagesTable.isRead, false),
        sql`${chatMessagesTable.fromUserId} != ${currentUserId}`
      ));

    res.json(messages);
  } catch (err) {
    req.log.error({ err }, "Get channel messages error");
    res.status(500).json({ error: "Server error" });
  }
});

// POST /chat/channels/:id/messages
router.post("/channels/:id/messages", requireAuth, async (req, res) => {
  try {
    const channelId = parseInt(req.params.id);
    const { content } = req.body;
    if (!content?.trim()) {
      res.status(400).json({ error: "Bad Request", message: "محتوى الرسالة مطلوب" });
      return;
    }
    const inserted = await db.insert(chatMessagesTable).values({
      companyId: req.companyId!,
      channelId,
      fromUserId: req.userId!,
      content: content.trim(),
    }).returning();
    res.status(201).json(inserted[0]);
  } catch (err) {
    req.log.error({ err }, "Send channel message error");
    res.status(500).json({ error: "Server error" });
  }
});

// GET /chat/dm/:userId
router.get("/dm/:userId", requireAuth, async (req, res) => {
  try {
    const otherUserId = parseInt(req.params.userId);
    const currentUserId = req.userId!;

    const messages = await db.select({
      id: chatMessagesTable.id,
      content: chatMessagesTable.content,
      fromUserId: chatMessagesTable.fromUserId,
      fromUserName: usersTable.name,
      toUserId: chatMessagesTable.toUserId,
      isRead: chatMessagesTable.isRead,
      createdAt: chatMessagesTable.createdAt,
    })
      .from(chatMessagesTable)
      .leftJoin(usersTable, eq(chatMessagesTable.fromUserId, usersTable.id))
      .where(and(
        eq(chatMessagesTable.companyId, req.companyId!),
        isNull(chatMessagesTable.channelId),
        or(
          and(eq(chatMessagesTable.fromUserId, currentUserId), eq(chatMessagesTable.toUserId, otherUserId)),
          and(eq(chatMessagesTable.fromUserId, otherUserId), eq(chatMessagesTable.toUserId, currentUserId))
        )
      ))
      .orderBy(asc(chatMessagesTable.createdAt))
      .limit(100);

    // Mark messages from other user as read
    await db.update(chatMessagesTable)
      .set({ isRead: true })
      .where(and(
        eq(chatMessagesTable.companyId, req.companyId!),
        isNull(chatMessagesTable.channelId),
        eq(chatMessagesTable.fromUserId, otherUserId),
        eq(chatMessagesTable.toUserId, currentUserId),
        eq(chatMessagesTable.isRead, false)
      ));

    res.json(messages);
  } catch (err) {
    req.log.error({ err }, "Get DM error");
    res.status(500).json({ error: "Server error" });
  }
});

// POST /chat/dm/:userId
router.post("/dm/:userId", requireAuth, async (req, res) => {
  try {
    const toUserId = parseInt(req.params.userId);
    const { content } = req.body;
    if (!content?.trim()) {
      res.status(400).json({ error: "Bad Request", message: "محتوى الرسالة مطلوب" });
      return;
    }
    const inserted = await db.insert(chatMessagesTable).values({
      companyId: req.companyId!,
      fromUserId: req.userId!,
      toUserId,
      content: content.trim(),
    }).returning();
    res.status(201).json(inserted[0]);
  } catch (err) {
    req.log.error({ err }, "Send DM error");
    res.status(500).json({ error: "Server error" });
  }
});

// GET /chat/unread-counts
router.get("/unread-counts", requireAuth, async (req, res) => {
  try {
    const currentUserId = req.userId!;

    const [dmRow] = await db.select({ count: sql<number>`count(*)::int` })
      .from(chatMessagesTable)
      .where(and(
        eq(chatMessagesTable.companyId, req.companyId!),
        isNull(chatMessagesTable.channelId),
        eq(chatMessagesTable.toUserId, currentUserId),
        eq(chatMessagesTable.isRead, false)
      ));

    const channelRows = await db.select({
      channelId: chatMessagesTable.channelId,
      count: sql<number>`count(*)::int`,
    })
      .from(chatMessagesTable)
      .where(and(
        eq(chatMessagesTable.companyId, req.companyId!),
        isNotNull(chatMessagesTable.channelId),
        eq(chatMessagesTable.isRead, false),
        sql`${chatMessagesTable.fromUserId} != ${currentUserId}`
      ))
      .groupBy(chatMessagesTable.channelId);

    const channelUnread: Record<number, number> = {};
    for (const r of channelRows) {
      if (r.channelId) channelUnread[r.channelId] = Number(r.count);
    }

    res.json({ dmUnread: Number(dmRow?.count ?? 0), channelUnread });
  } catch (err) {
    req.log.error({ err }, "Unread counts error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
