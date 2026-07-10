class QLicense extends QBase {
  // ---------- licensing (offline ECDSA P-256, verified via SubtleCrypto) ----------

  async loadLicense() {
    const token = (window.QUARRY_LICENSE && String(window.QUARRY_LICENSE)) ||
      (() => { try { return localStorage.getItem('quarry_license') || ''; } catch (e) { return ''; } })();
    if (!token) {
      return this.setState({ license: {
        status: QUARRY_LICENSE_REQUIRED ? 'unlicensed' : 'trial',
        clientId: '', plan: 'trial', quota: 0, period: '', used: 0, expiresAt: '',
        features: [], reason: QUARRY_LICENSE_REQUIRED ? 'No license found.' : '',
        unlimited: !QUARRY_LICENSE_REQUIRED
      } });
    }
    let claims;
    try { claims = await this.verifyLicense(token); }
    catch (e) {
      return this.setState({ license: { status: 'invalid', clientId: '', plan: '', quota: 0, period: '', used: 0, expiresAt: '', features: [], reason: 'License signature is invalid.', unlimited: false } });
    }
    const exp = Date.parse(claims.expires_at || '') || 0;
    if (exp && Date.now() > exp) {
      return this.setState({ license: { status: 'expired', clientId: claims.client_id || '', plan: claims.plan || '', quota: claims.quota || 0, period: claims.period || '', used: 0, expiresAt: claims.expires_at || '', features: claims.features || [], reason: 'License expired ' + (claims.expires_at || '') + '.', unlimited: false } });
    }
    this.setState({ license: {
      status: 'active', clientId: claims.client_id || '', plan: claims.plan || 'monthly',
      quota: claims.quota || 0, period: claims.period || 'monthly', used: this.readUsage(claims),
      expiresAt: claims.expires_at || '', features: claims.features || [], reason: '', unlimited: false
    } });
  }

  async verifyLicense(token) {
    const parts = String(token).split('.');
    if (parts.length !== 2) throw new Error('bad token');
    const payloadBytes = this.b64uToBytes(parts[0]);
    const sigBytes = this.b64uToBytes(parts[1]);
    const rawKey = Uint8Array.from(atob(QUARRY_LICENSE_PUBKEY), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', rawKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sigBytes, payloadBytes);
    if (!ok) throw new Error('signature mismatch');
    return JSON.parse(new TextDecoder().decode(payloadBytes));
  }

  b64uToBytes(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return Uint8Array.from(atob(s), c => c.charCodeAt(0));
  }

  usageStorageKey(lic) {
    let period = 'all';
    if ((lic.period || 'monthly') === 'monthly') {
      const d = new Date();
      period = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
    }
    return 'quarry_usage_' + (lic.client_id || lic.clientId || 'anon') + '_' + period;
  }

  readUsage(lic) {
    try { return parseInt(localStorage.getItem(this.usageStorageKey(lic)) || '0', 10) || 0; } catch (e) { return 0; }
  }

  writeUsage(lic, n) {
    try { localStorage.setItem(this.usageStorageKey(lic), String(n)); } catch (e) {}
  }

  licenseAllows() {
    const L = this.state.license;
    if (L.unlimited) return { ok: true };
    if (L.status === 'active') {
      if (L.quota && L.used >= L.quota) return { ok: false, reason: `You've used all ${L.quota} analyses for this ${L.period === 'monthly' ? 'month' : 'plan'}. Reach out to add more.` };
      return { ok: true };
    }
    if (L.status === 'expired') return { ok: false, reason: L.reason || 'Your license has expired. Reach out to renew.' };
    if (L.status === 'invalid') return { ok: false, reason: 'This license could not be verified. Reach out for a new one.' };
    return { ok: false, reason: 'No active license. Reach out to get set up.' };
  }

  recordAnalysis() {
    const L = this.state.license;
    if (L.unlimited || L.status !== 'active') return;
    const used = L.used + 1;
    this.writeUsage({ client_id: L.clientId, period: L.period }, used);
    this.setState({ license: { ...L, used } });
  }

  refundAnalysis() {
    const L = this.state.license;
    if (L.unlimited || L.status !== 'active' || L.used <= 0) return;
    const used = L.used - 1;
    this.writeUsage({ client_id: L.clientId, period: L.period }, used);
    this.setState({ license: { ...L, used } });
  }

  licenseLabelText() {
    const L = this.state.license;
    return ({ active: L.clientId || 'Licensed', trial: 'Trial — unlimited', expired: 'Expired', invalid: 'Invalid license', unlicensed: 'No license' })[L.status] || 'Checking…';
  }

  usageLabelText() {
    const L = this.state.license;
    if (L.status === 'active') return L.quota ? (L.used + ' / ' + L.quota) : String(L.used);
    if (L.status === 'trial') return '∞';
    return '—';
  }

  usageColor() {
    const L = this.state.license;
    if (L.status === 'active' && L.quota) {
      if (L.used >= L.quota) return '#f0616c';
      if (L.used >= L.quota * 0.9) return '#f0a93b';
      return '#8ea4d6';
    }
    if (['expired', 'invalid', 'unlicensed'].includes(L.status)) return '#f0616c';
    return '#6b7484';
  }
}
