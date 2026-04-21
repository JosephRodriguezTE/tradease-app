/**
 * Tradease Job Backend
 * --------------------
 * Backend-facing logic for the contractor/customer job workflow.
 * This module only handles data reads/writes and message event encoding.
 */
(function () {
  const EVENT_PREFIX = '[JOB_EVENT]';
  const JOB_TERMINAL_STATUSES = new Set(['cancelled', 'completed']);

  function safeJsonParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }

  function encodeEvent(type, payload) {
    return `${EVENT_PREFIX}${JSON.stringify({ type, payload, ts: new Date().toISOString() })}`;
  }

  function decodeEvent(body) {
    if (!body || !body.startsWith(EVENT_PREFIX)) return null;
    return safeJsonParse(body.slice(EVENT_PREFIX.length), null);
  }

  class TradeaseJobBackend {
    constructor(sb) {
      this.sb = sb;
    }

    static create(sb) {
      return new TradeaseJobBackend(sb);
    }

    /**
     * Normalize and validate actor role for message safety.
     */
    normalizeActorRole(actorRole) {
      return actorRole === 'contractor' ? 'contractor' : 'customer';
    }

    /**
     * Throw on Supabase response error to keep caller behavior explicit.
     */
    assertNoError(response, context) {
      if (response?.error) {
        throw new Error(`${context}: ${response.error.message || 'Unknown error'}`);
      }
      return response;
    }

    /**
     * Lightweight read-only lookup for an existing conversation.
     * Does not create a new record.
     */
    async findConversationForBooking(booking) {
      const contractorId = String(booking.contractor_id);
      const customerId = String(booking.customer_id);
      const existing = await this.sb
        .from('conversations')
        .select('*')
        .eq('contractor_id', contractorId)
        .eq('customer_id', customerId)
        .maybeSingle();
      this.assertNoError(existing, 'findConversationForBooking');
      return existing.data || null;
    }

    /**
     * Ensure there is a conversation tied to a booking's customer/contractor pair.
     */
    async ensureConversationForBooking(booking) {
      const contractorId = String(booking.contractor_id);
      const customerId = String(booking.customer_id);
      const existing = await this.findConversationForBooking(booking);
      if (existing) return existing;

      const created = await this.sb
        .from('conversations')
        .insert({
          contractor_id: contractorId,
          customer_id: customerId,
          contractor_name: booking.contractor_name || 'Contractor',
          customer_name: booking.customer_name || 'Customer',
          status: 'accepted',
          last_message: 'Job conversation created.',
          last_message_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      this.assertNoError(created, 'ensureConversationForBooking');
      return created.data;
    }

    /**
     * Push a structured system event into the messages stream.
     */
    async pushSystemEvent(conversationId, senderId, senderRole, type, payload) {
      const body = encodeEvent(type, payload);
      const safeRole = this.normalizeActorRole(senderRole);
      const insertRes = await this.sb.from('messages').insert({
        conversation_id: conversationId,
        sender_id: String(senderId),
        sender_role: safeRole,
        body,
      });
      this.assertNoError(insertRes, 'pushSystemEvent.insert');
      const convRes = await this.sb
        .from('conversations')
        .update({
          last_message: `[${type}]`,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', conversationId);
      this.assertNoError(convRes, 'pushSystemEvent.updateConversation');
    }

    /**
     * Send normal job text message.
     */
    async sendMessage(conversationId, senderId, senderRole, text) {
      const safeRole = this.normalizeActorRole(senderRole);
      const insertRes = await this.sb.from('messages').insert({
        conversation_id: conversationId,
        sender_id: String(senderId),
        sender_role: safeRole,
        body: text,
      });
      this.assertNoError(insertRes, 'sendMessage.insert');
      const convRes = await this.sb
        .from('conversations')
        .update({
          last_message: text,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', conversationId);
      this.assertNoError(convRes, 'sendMessage.updateConversation');
    }

    /**
     * Create quote/schedule/question update proposal.
     */
    async proposeUpdate(booking, actorRole, actorId, proposal) {
      const conversation = await this.ensureConversationForBooking(booking);
      await this.pushSystemEvent(conversation.id, actorId, actorRole, 'proposal', {
        bookingId: booking.id,
        ...proposal,
        accepted: false,
      });
    }

    /**
     * Accept latest proposal and optionally apply schedule/status update on booking.
     */
    async acceptLatestProposal(booking, actorRole, actorId, latestProposal) {
      if (!latestProposal || typeof latestProposal !== 'object') {
        throw new Error('acceptLatestProposal: latestProposal is required');
      }
      const conversation = await this.ensureConversationForBooking(booking);

      const bookingUpdates = { status: 'accepted' };
      if (latestProposal?.date) bookingUpdates.booking_date = latestProposal.date;
      if (latestProposal?.time) bookingUpdates.booking_time = latestProposal.time;

      const bookingRes = await this.sb.from('bookings').update(bookingUpdates).eq('id', booking.id);
      this.assertNoError(bookingRes, 'acceptLatestProposal.updateBooking');

      await this.pushSystemEvent(conversation.id, actorId, actorRole, 'proposal_accepted', {
        bookingId: booking.id,
        proposal: latestProposal || null,
      });
    }

    /**
     * Update basic job status.
     */
    async setJobStatus(bookingId, status) {
      const res = await this.sb.from('bookings').update({ status }).eq('id', bookingId);
      this.assertNoError(res, 'setJobStatus');
    }

    /**
     * Cancel job and notify both parties in conversation.
     */
    async cancelJob(booking, actorRole, actorId, reason) {
      const bookingRes = await this.sb.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id);
      this.assertNoError(bookingRes, 'cancelJob.updateBooking');
      const conversation = await this.ensureConversationForBooking(booking);
      await this.pushSystemEvent(conversation.id, actorId, actorRole, 'cancelled', {
        bookingId: booking.id,
        reason: reason || 'No reason provided',
      });
    }

    /**
     * Mark payment as pending after work phase.
     */
    async markPaymentPending(booking, actorRole, actorId, amount) {
      if (JOB_TERMINAL_STATUSES.has(String(booking.status || '').toLowerCase())) {
        throw new Error('markPaymentPending: cannot request payment on terminal jobs');
      }
      const conversation = await this.ensureConversationForBooking(booking);
      await this.pushSystemEvent(conversation.id, actorId, actorRole, 'payment_pending', {
        bookingId: booking.id,
        amount: Number(amount) || 0,
      });
    }

    /**
     * Confirm payment and finish booking lifecycle.
     */
    async confirmPaymentCompleted(booking, actorRole, actorId, amount) {
      const bookingRes = await this.sb.from('bookings').update({ status: 'completed' }).eq('id', booking.id);
      this.assertNoError(bookingRes, 'confirmPaymentCompleted.updateBooking');
      const conversation = await this.ensureConversationForBooking(booking);
      await this.pushSystemEvent(conversation.id, actorId, actorRole, 'payment_completed', {
        bookingId: booking.id,
        amount: Number(amount) || 0,
      });
    }

    /**
     * Read latest job events by booking from conversation messages.
     */
    async getJobsMetaForBookings(bookings) {
      const metaByBooking = {};
      for (const booking of bookings || []) {
        const conversation = await this.findConversationForBooking(booking);
        if (!conversation) {
          metaByBooking[String(booking.id)] = {
            conversationId: null,
            latestProposal: null,
            acceptedProposal: null,
            paymentPending: null,
            paymentCompleted: null,
            cancelled: null,
            hasPendingProposal: false,
          };
          continue;
        }

        const res = await this.sb
          .from('messages')
          .select('body,created_at')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: true });
        this.assertNoError(res, 'getJobsMetaForBookings.fetchMessages');

        const events = (res.data || [])
          .map((m) => {
            const evt = decodeEvent(m.body);
            if (!evt) return null;
            return { ...evt, created_at: m.created_at || null };
          })
          .filter(Boolean)
          .filter((e) => String(e?.payload?.bookingId) === String(booking.id));

        const latestProposalEvt = [...events].reverse().find((e) => e.type === 'proposal') || null;
        const acceptedProposalEvt = [...events].reverse().find((e) => e.type === 'proposal_accepted') || null;
        const latestProposal = latestProposalEvt?.payload || null;
        const acceptedProposal = acceptedProposalEvt?.payload || null;
        const paymentPending = [...events].reverse().find((e) => e.type === 'payment_pending')?.payload || null;
        const paymentCompleted = [...events].reverse().find((e) => e.type === 'payment_completed')?.payload || null;
        const cancelled = [...events].reverse().find((e) => e.type === 'cancelled')?.payload || null;
        const hasPendingProposal = !!latestProposalEvt && (
          !acceptedProposalEvt ||
          (latestProposalEvt.created_at && acceptedProposalEvt.created_at && latestProposalEvt.created_at > acceptedProposalEvt.created_at)
        );

        metaByBooking[String(booking.id)] = {
          conversationId: conversation.id,
          latestProposal,
          acceptedProposal,
          paymentPending,
          paymentCompleted,
          cancelled,
          hasPendingProposal,
        };
      }
      return metaByBooking;
    }
  }

  window.TradeaseJobBackend = TradeaseJobBackend;
})();
