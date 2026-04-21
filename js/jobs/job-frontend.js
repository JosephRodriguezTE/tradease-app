/**
 * Tradease Job Frontend Helpers
 * -----------------------------
 * Frontend-only helpers for rendering job meta badges safely.
 */
(function () {
  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Render compact job state tags to keep UI logic reusable.
   */
  function renderJobMetaTags(meta) {
    if (!meta) return '';
    const tags = [];
    if (meta.hasPendingProposal) tags.push('<span class="bst bst-p">Update Proposed</span>');
    if (meta.paymentPending) tags.push('<span class="bst bst-ip">Payment Pending</span>');
    if (meta.paymentCompleted) tags.push('<span class="bst bst-c">Payment Complete</span>');
    if (meta.cancelled) tags.push('<span class="bst bst-d">Cancelled</span>');
    return tags.join('');
  }

  /**
   * Render proposal summary text from structured proposal payload.
   */
  function renderProposalSummary(meta) {
    const p = meta?.latestProposal;
    if (!p) return '';
    const chunks = [];
    if (p.price !== undefined && p.price !== null && p.price !== '') {
      chunks.push(`Updated price: $${esc(p.price)}`);
    }
    if (p.date || p.time) chunks.push(`Schedule: ${esc(p.date || 'TBD')} ${esc(p.time || '')}`.trim());
    if (p.question) chunks.push(`Question: ${esc(p.question)}`);
    if (!chunks.length) return '';
    return `<div class="bk-desc">${chunks.join(' · ')}</div>`;
  }

  window.TradeaseJobFrontend = {
    esc,
    renderJobMetaTags,
    renderProposalSummary,
  };
})();
