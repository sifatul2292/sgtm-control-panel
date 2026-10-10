import { randomUUID } from 'node:crypto';

function inputText(value, label, limit) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > limit) {
    throw Object.assign(new Error(`${label} is required and must be at most ${limit} characters.`), { status: 400 });
  }
  return value.trim();
}

export function communicationFeed(data, session) {
  const owner = session.role === 'owner';
  const tickets = (data.supportTickets || []).filter(ticket => owner || ticket.tenantId === session.tenantId);
  const announcements = data.announcements || [];
  const seenAt = data.notificationSeenAt?.[session.tenantId] || '';
  const notifications = owner ? [] : [
    ...announcements.map(item => ({ ...item, kind: 'announcement' })),
    ...tickets.flatMap(ticket => ticket.messages.filter(message => message.role === 'owner').map(message => ({
      ...message, title: `Reply: ${ticket.subject}`, kind: 'reply', ticketId: ticket.id
    })))
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { tickets: [...tickets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), announcements: [...announcements].reverse(), notifications,
    unread: notifications.filter(item => item.createdAt > seenAt).length, seenAt };
}

export function updateCommunication(data, session, action, body, now = new Date().toISOString()) {
  const owner = session.role === 'owner';
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(new Error('Invalid request.'), { status: 400 });
  if (!owner && (session.role !== 'customer' || !session.tenantId)) throw Object.assign(new Error('Account required.'), { status: 403 });
  if (action === 'announcement') {
    if (!owner) throw Object.assign(new Error('Owner access required.'), { status: 403 });
    const item = { id: randomUUID(), title: inputText(body.title, 'Title', 160), text: inputText(body.text, 'Announcement', 5000), createdAt: now };
    (data.announcements ||= []).push(item);
  } else if (action === 'read') {
    if (owner) throw Object.assign(new Error('Customer access required.'), { status: 403 });
    // Use the snapshot displayed by the client so a concurrent new notification stays unread.
    const newest = communicationFeed(data, session).notifications.find(item => item.id === body.notificationId);
    if (newest) (data.notificationSeenAt ||= {})[session.tenantId] = [data.notificationSeenAt?.[session.tenantId] || '', newest.createdAt].sort().at(-1);
  } else if (action === 'ticket') {
    if (owner) throw Object.assign(new Error('Customer access required.'), { status: 403 });
    const ticket = { id: randomUUID(), tenantId: session.tenantId, customer: session.username || session.tenantId,
      subject: inputText(body.subject, 'Subject', 160), status: 'open', createdAt: now, updatedAt: now,
      messages: [{ id: randomUUID(), role: 'customer', text: inputText(body.text, 'Message', 5000), createdAt: now }] };
    (data.supportTickets ||= []).push(ticket);
  } else {
    const ticket = (data.supportTickets || []).find(item => item.id === body.ticketId && (owner || item.tenantId === session.tenantId));
    if (!ticket) throw Object.assign(new Error('Ticket not found.'), { status: 404 });
    if (action === 'reply') {
      if (ticket.messages.length >= 200) throw Object.assign(new Error('This conversation is full. Please create a new ticket.'), { status: 400 });
      ticket.messages.push({ id: randomUUID(), role: session.role, text: inputText(body.text, 'Reply', 5000), createdAt: now });
      ticket.status = 'open';
    } else if (action === 'status' && owner && ['open', 'closed'].includes(body.status)) {
      ticket.status = body.status;
    } else throw Object.assign(new Error('Invalid action.'), { status: 400 });
    ticket.updatedAt = now;
  }
  return communicationFeed(data, session);
}
