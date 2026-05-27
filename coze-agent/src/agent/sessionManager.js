const sessions = new Map();
const SESSION_TTL = 30 * 60 * 1000;
const MAX_HISTORY = 40;

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { messages: [], createdAt: Date.now() });
  }
  const s = sessions.get(sessionId);
  s.lastAccess = Date.now();
  return s;
}

function deleteSession(sessionId) {
  return sessions.delete(sessionId);
}

function getSessionCount() {
  return sessions.size;
}

function appendMessage(sessionId, role, content) {
  const session = getSession(sessionId);
  session.messages.push({ role, content });
  if (session.messages.length > MAX_HISTORY) {
    session.messages = session.messages.slice(-MAX_HISTORY);
  }
}

function getHistory(sessionId, limit = 20) {
  const session = getSession(sessionId);
  return session.messages.slice(-limit);
}

// 定期清理过期会话
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - (s.lastAccess || s.createdAt) > SESSION_TTL) {
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);

export { getSession, deleteSession, getSessionCount, appendMessage, getHistory };
