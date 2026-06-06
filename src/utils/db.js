import { supabase } from '../lib/supabase';
import {
  DEFAULT_SERVICES,
  DEFAULT_PRODUCTS,
  DEFAULT_WORKING_HOURS,
  DEFAULT_ADMIN_SETTINGS,
  DEFAULT_CLINIC_INFO,
  DEFAULT_ABOUT,
  DEFAULT_HERO,
  DEFAULT_TERMS,
} from './defaults';

// ── Mappers ─────────────────────────────────────────────────────
const mapService = s => ({
  id: s.id, name: s.name, duration: s.duration, price: Number(s.price),
  imageUrl: s.image_url || '', parentId: s.parent_id || null,
});

const mapProduct = p => ({
  id: p.id, name: p.name, price: Number(p.price),
  salePrice: p.sale_price ? Number(p.sale_price) : null,
  imageUrl: p.image_url, visible: p.visible,
});

const mapStaff = s => ({ id: s.id, name: s.name, phone: s.phone, imageUrl: s.image_url || '' });

const mapApt = a => ({
  id: a.id, phone: a.phone, userName: a.user_name,
  serviceId: a.service_id, serviceName: a.service_name,
  serviceDuration: a.service_duration,
  date: a.date, time: a.time ? a.time.substring(0, 5) : a.time,
  price: Number(a.price), status: a.status, staffId: a.staff_id,
  addons: Array.isArray(a.addons) ? a.addons : [],
  reminderSent: a.reminder_sent || false, createdAt: a.created_at,
});

const mapOrder = o => ({
  id: o.id, clientName: o.client_name, clientPhone: o.client_phone,
  items: o.items || [], total: Number(o.total),
  status: o.status, createdAt: o.created_at,
});

const mapReview = r => ({
  id: r.id, userName: r.name,
  rating: r.rating, text: r.text,
  status: r.approved ? 'approved' : 'pending',
  createdAt: r.created_at,
});

const mapWaitlist = w => ({
  id: w.id, date: w.date, phone: w.phone,
  userName: w.user_name, serviceId: w.service_id,
  createdAt: w.created_at,
});

const mapUser = u => ({
  id: u.id, firstName: u.first_name, lastName: u.last_name,
  phone: u.phone, email: u.email, birthDate: u.birth_date, gender: u.gender,
  agreedTerms: u.agreed_terms, createdAt: u.created_at,
});

const mapGallery = g => ({ id: g.id, imageUrl: g.image_url, order: g.order || 0, createdAt: g.created_at });

// ── db API ───────────────────────────────────────────────────────
export const db = {

  // ── Services ────────────────────────────────────────────────────
  services: {
    list: async () => {
      const { data } = await supabase.from('services').select().order('created_at');
      return (data || []).map(mapService);
    },
    create: async ({ name, duration, price, imageUrl, parentId = null }) => {
      const { data, error } = await supabase.from('services')
        .insert({ name, duration: Number(duration), price: Number(price), image_url: imageUrl || null, parent_id: parentId || null })
        .select().single();
      if (error) {
        console.error('[db.services.create]', error);
        // Surface the failure to the caller so the UI can show feedback
        // instead of silently dropping the row.
        throw new Error(error.message || 'יצירת שירות נכשלה');
      }
      return data ? mapService(data) : null;
    },
    update: async (id, { name, duration, price, imageUrl, parentId = null }) => {
      await supabase.from('services')
        .update({ name, duration: Number(duration), price: Number(price), image_url: imageUrl || null, parent_id: parentId || null }).eq('id', id);
    },
    delete: async (id) => { await supabase.from('services').delete().eq('id', id); },
  },

  // ── Products ────────────────────────────────────────────────────
  products: {
    list: async (visibleOnly = false) => {
      let q = supabase.from('products').select().order('created_at');
      if (visibleOnly) q = q.eq('visible', true);
      const { data } = await q;
      return (data || []).map(mapProduct);
    },
    create: async ({ name, price, salePrice, imageUrl, visible }) => {
      const { data } = await supabase.from('products')
        .insert({ name, price: Number(price), sale_price: salePrice ? Number(salePrice) : null, image_url: imageUrl, visible })
        .select().single();
      return data ? mapProduct(data) : null;
    },
    update: async (id, { name, price, salePrice, imageUrl, visible }) => {
      await supabase.from('products')
        .update({ name, price: Number(price), sale_price: salePrice ? Number(salePrice) : null, image_url: imageUrl, visible })
        .eq('id', id);
    },
    delete: async (id) => { await supabase.from('products').delete().eq('id', id); },
  },

  // ── Staff ───────────────────────────────────────────────────────
  staff: {
    list: async () => {
      const { data } = await supabase.from('staff').select().order('created_at');
      return (data || []).map(mapStaff);
    },
    create: async ({ name, phone, imageUrl }) => {
      const { data } = await supabase.from('staff')
        .insert({ name, phone: phone || null, image_url: imageUrl || null })
        .select().single();
      return data ? mapStaff(data) : null;
    },
    update: async (id, { name, phone, imageUrl }) => {
      await supabase.from('staff')
        .update({ name, phone: phone || null, image_url: imageUrl || null })
        .eq('id', id);
    },
    delete: async (id) => { await supabase.from('staff').delete().eq('id', id); },
  },

  // ── Appointments ────────────────────────────────────────────────
  appointments: {
    list: async () => {
      const { data } = await supabase.from('appointments').select()
        .order('created_at', { ascending: false });
      return (data || []).map(mapApt);
    },
    byPhone: async (phone) => {
      const { data } = await supabase.from('appointments').select()
        .eq('phone', phone).order('created_at', { ascending: false });
      return (data || []).map(mapApt);
    },
    // Digits-only match: catches appointments stored with different phone formatting
    byPhoneDigits: async (phone) => {
      try {
        const d = String(phone || '').replace(/\D/g, '');
        if (!d) return [];
        const { data } = await supabase.from('appointments').select()
          .order('created_at', { ascending: false });
        return (data || []).filter(a => String(a.phone || '').replace(/\D/g, '') === d).map(mapApt);
      } catch { return []; }
    },
    byDate: async (date, staffId = null) => {
      let q = supabase.from('appointments').select()
        .eq('date', date).in('status', ['confirmed', 'pending']);
      if (staffId) q = q.eq('staff_id', staffId);
      const { data } = await q;
      return (data || []).map(mapApt);
    },
    // Returns the next N available slots across all services (for urgent booking)
    nextAvailable: async (limit = 7) => {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10);
      const { data } = await supabase.from('appointments').select()
        .gte('date', dateStr).eq('status', 'confirmed')
        .order('date').order('time');
      return (data || []).map(mapApt).slice(0, limit);
    },
    create: async (apt) => {
      const { data } = await supabase.from('appointments')
        .insert({
          phone: apt.phone, user_name: apt.userName,
          service_id: apt.serviceId, service_name: apt.serviceName,
          service_duration: apt.serviceDuration,
          date: apt.date, time: apt.time, price: apt.price,
          status: apt.status || 'confirmed', staff_id: apt.staffId || null,
          addons: apt.addons || [],
        })
        .select().single();
      return data ? mapApt(data) : null;
    },
    approve: async (id) => {
      await supabase.from('appointments').update({ status: 'confirmed' }).eq('id', id);
    },
    cancel: async (id) => {
      await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
    },
    // Mark all future confirmed appts of a phone as cancelled. Past appts preserved.
    cancelFuture: async (phone) => {
      try {
        const d = String(phone || '').replace(/\D/g, '');
        if (!d) return 0;
        const today = new Date().toISOString().slice(0, 10);
        const { data: rows } = await supabase.from('appointments')
          .select('id, phone, date, status').eq('status', 'confirmed').gte('date', today);
        if (!rows) return 0;
        const ids = rows.filter(r => String(r.phone || '').replace(/\D/g, '') === d).map(r => r.id);
        if (ids.length === 0) return 0;
        const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).in('id', ids);
        if (error) { console.error('[appointments.cancelFuture]', error); return 0; }
        return ids.length;
      } catch (e) { console.error('[appointments.cancelFuture] exception:', e); return 0; }
    },
  },

  // ── Clients ─────────────────────────────────────────────────────
  clients: {
    list: async () => {
      const { data } = await supabase.from('clients').select();
      return data || [];
    },
    // Digits-only lookup against clients (accounts live here).
    // Returns a normalized record or null.
    findByDigits: async (digits) => {
      try {
        const d = String(digits || '').replace(/\D/g, '');
        if (!d) return null;
        const { data } = await supabase.from('clients').select();
        if (!data) return null;
        const match = data.find(r => String(r.phone || '').replace(/\D/g, '') === d);
        return match || null;
      } catch (e) { console.error('[clients.findByDigits]', e); return null; }
    },
    // Create/upsert a clients record (account marker). Phone stored digits-only.
    create: async ({ phone, name }) => {
      try {
        const d = String(phone || '').replace(/\D/g, '');
        if (!d) return null;
        const { data, error } = await supabase.from('clients').upsert(
          { phone: d, name, is_blocked: false, no_show_count: 0, updated_at: new Date().toISOString() },
          { onConflict: 'phone' }
        ).select().single();
        if (error) { console.error('[clients.create]', error); return null; }
        return data || null;
      } catch (e) { console.error('[clients.create] exception:', e); return null; }
    },
    isBlocked: async (phone) => {
      const { data } = await supabase.from('clients').select('is_blocked')
        .eq('phone', phone).maybeSingle();
      return data?.is_blocked || false;
    },
    markNoShow: async (phone, name) => {
      const { data: existing } = await supabase.from('clients').select('no_show_count, is_blocked')
        .eq('phone', phone).maybeSingle();
      const count = (existing?.no_show_count || 0) + 1;
      await supabase.from('clients').upsert(
        { phone, name, no_show_count: count, is_blocked: existing?.is_blocked || false, updated_at: new Date().toISOString() },
        { onConflict: 'phone' }
      );
      return count;
    },
    decrementNoShow: async (phone) => {
      const { data: existing } = await supabase.from('clients').select('no_show_count, is_blocked')
        .eq('phone', phone).maybeSingle();
      const count = Math.max(0, (existing?.no_show_count || 0) - 1);
      // Use .update() (not upsert) — row must already exist when noShows > 0.
      // Avoids silent insert failures that caused stale reads on the next markNoShow call.
      await supabase.from('clients')
        .update({ no_show_count: count, updated_at: new Date().toISOString() })
        .eq('phone', phone);
      return count;
    },
    block: async (phone, name) => {
      await supabase.from('clients').upsert(
        { phone, name, is_blocked: true, updated_at: new Date().toISOString() },
        { onConflict: 'phone' }
      );
    },
    unblock: async (phone) => {
      await supabase.from('clients')
        .update({ is_blocked: false, updated_at: new Date().toISOString() }).eq('phone', phone);
    },
  },

  // ── Orders ──────────────────────────────────────────────────────
  orders: {
    list: async () => {
      const { data } = await supabase.from('orders').select()
        .order('created_at', { ascending: false });
      return (data || []).map(mapOrder);
    },
    create: async ({ clientName, clientPhone, items, total }) => {
      const { data } = await supabase.from('orders')
        .insert({ client_name: clientName, client_phone: clientPhone, items, total: Number(total), status: 'pending' })
        .select().single();
      return data ? mapOrder(data) : null;
    },
    updateStatus: async (id, status) => {
      await supabase.from('orders').update({ status }).eq('id', id);
    },
  },

  // ── Users (extended registration) ───────────────────────────────
  users: {
    get: async (phone) => {
      try {
        const { data } = await supabase.from('users').select()
          .eq('phone', phone).maybeSingle();
        return data ? mapUser(data) : null;
      } catch { return null; }
    },
    // Digits-only lookup: tolerates different phone formatting in storage
    findByDigits: async (digits) => {
      try {
        const d = String(digits || '').replace(/\D/g, '');
        if (!d) return null;
        // Exact match against digits
        const { data: exact } = await supabase.from('users').select()
          .eq('phone', d).maybeSingle();
        if (exact) return mapUser(exact);
        // Pull all and filter — works regardless of stored formatting
        const { data } = await supabase.from('users').select();
        if (!data) return null;
        const match = data.find(u => String(u.phone || '').replace(/\D/g, '') === d);
        return match ? mapUser(match) : null;
      } catch (e) { console.error('[users.findByDigits]', e); return null; }
    },
    // Account records live in the `clients` table only (no users table in this project).
    // Returns: 'deleted' | 'not_found' | 'rls_blocked' | 'error'
    deleteByPhone: async (phone) => {
      const tag = '[clients.deleteByPhone]';
      try {
        const d = String(phone || '').replace(/\D/g, '');
        if (!d) { console.warn(`${tag} EXIT no digits`); return 'error'; }
        const { data: rows, error: selErr } = await supabase.from('clients').select('id, phone, name');
        if (selErr) { console.error(`${tag} SELECT failed:`, selErr); return 'error'; }
        if (!rows || rows.length === 0) { console.warn(`${tag} clients table is empty`); return 'not_found'; }
        const matches = rows.filter(r => String(r.phone || '').replace(/\D/g, '') === d);
        if (matches.length === 0) {
          console.warn(`${tag} no row in clients with digits=${d}. All phones in DB:`,
            rows.map(r => `${r.phone} (digits=${String(r.phone||'').replace(/\D/g,'')})`).slice(0, 20));
          return 'not_found';
        }
        const ids = matches.map(r => r.id);
        const { error: delErr } = await supabase.from('clients').delete().in('id', ids);
        if (delErr) { console.error(`${tag} DELETE error:`, delErr); return 'error'; }
        const { data: after } = await supabase.from('clients').select('id').in('id', ids);
        if (after && after.length > 0) {
          console.error(`${tag} RLS blocked DELETE silently. ${after.length} row(s) survived.`);
          return 'rls_blocked';
        }
        return 'deleted';
      } catch (e) { console.error(`${tag} exception:`, e); return 'error'; }
    },
    // Permanent delete: removes client + future appointments only. History preserved.
    permanentDelete: async (phone) => {
      const tag = '[clients.permanentDelete]';
      try {
        const d = String(phone || '').replace(/\D/g, '');
        if (!d) return { ok: false, error: 'no_phone' };
        const today = new Date().toISOString().slice(0, 10);
        // 1) clients
        const { data: clientRows } = await supabase.from('clients').select('id, phone');
        const clientIds = (clientRows || []).filter(r => String(r.phone || '').replace(/\D/g, '') === d).map(r => r.id);
        if (clientIds.length > 0) {
          await supabase.from('clients').delete().in('id', clientIds);
        }
        // 2) future appointments
        const { data: aptRows } = await supabase.from('appointments').select('id, phone, date').gte('date', today);
        const aptIds = (aptRows || []).filter(r => String(r.phone || '').replace(/\D/g, '') === d).map(r => r.id);
        if (aptIds.length > 0) {
          await supabase.from('appointments').delete().in('id', aptIds);
        }
        // verify
        const { data: clientsLeft } = clientIds.length > 0
          ? await supabase.from('clients').select('id').in('id', clientIds)
          : { data: [] };
        const { data: aptsLeft } = aptIds.length > 0
          ? await supabase.from('appointments').select('id').in('id', aptIds)
          : { data: [] };
        if ((clientsLeft && clientsLeft.length > 0) || (aptsLeft && aptsLeft.length > 0)) {
          return { ok: false, error: 'rls_blocked' };
        }
        return { ok: true, deleted: { clients: clientIds.length, appointments: aptIds.length } };
      } catch (e) {
        console.error(`${tag} exception:`, e);
        return { ok: false, error: e.message };
      }
    },
    create: async ({ firstName, lastName, phone, email, birthDate }) => {
      try {
        const payload = { first_name: firstName, last_name: lastName, phone, birth_date: birthDate, agreed_terms: true };
        if (email) payload.email = email;
        let { data, error } = await supabase.from('users').insert(payload).select().single();
        if (error && email && String(error.message || '').toLowerCase().includes('email')) {
          delete payload.email;
          const r = await supabase.from('users').insert(payload).select().single();
          data = r.data; error = r.error;
        }
        if (error) { console.error('[users.create]', error); return null; }
        return data ? mapUser(data) : null;
      } catch (e) { console.error('[users.create] exception:', e); return null; }
    },
    update: async (phone, { firstName, lastName, email, birthDate }) => {
      try {
        const d = String(phone || '').replace(/\D/g, '');
        if (!d) return null;
        const payload = { first_name: firstName, last_name: lastName, birth_date: birthDate };
        if (email !== undefined) payload.email = email;
        const { data, error } = await supabase.from('users').update(payload).eq('phone', d).select().single();
        if (error) { console.error('[users.update]', error); return null; }
        return data ? mapUser(data) : null;
      } catch (e) { console.error('[users.update] exception:', e); return null; }
    },
  },

  // ── Reviews ─────────────────────────────────────────────────────
  reviews: {
    list: async (approvedOnly = false) => {
      try {
        let q = supabase.from('reviews').select().order('created_at', { ascending: false });
        if (approvedOnly) q = q.eq('approved', true);
        const { data } = await q;
        return (data || []).map(mapReview);
      } catch { return []; }
    },
    create: async ({ userName, rating, text }) => {
      try {
        const { error } = await supabase.from('reviews')
          .insert({ name: userName, rating, text, approved: false });
        if (error) { console.error('reviews.create error:', error); return { ok: false, error }; }
        return { ok: true };
      } catch (e) {
        console.error('reviews.create exception:', e);
        return { ok: false, error: { message: e.message } };
      }
    },
    createApproved: async ({ userName, rating, text }) => {
      try {
        const { error } = await supabase.from('reviews')
          .insert({ name: userName, rating, text, approved: true });
        if (error) { console.error('reviews.createApproved error:', error); return { ok: false, error }; }
        return { ok: true };
      } catch (e) {
        console.error('reviews.createApproved exception:', e);
        return { ok: false, error: { message: e.message } };
      }
    },
    approve: async (id) => {
      try { await supabase.from('reviews').update({ approved: true }).eq('id', id); } catch {}
    },
    delete: async (id) => {
      try { await supabase.from('reviews').delete().eq('id', id); } catch {}
    },
  },

  // ── Gallery ─────────────────────────────────────────────────────
  gallery: {
    list: async () => {
      try {
        const { data } = await supabase.from('gallery').select().order('order').order('created_at');
        return (data || []).map(mapGallery);
      } catch { return []; }
    },
    add: async (imageUrl) => {
      const { data, error } = await supabase.from('gallery')
        .insert({ image_url: imageUrl, order: 0 }).select().single();
      if (error) {
        console.error('[db.gallery.add] INSERT failed:', error);
        return { ok: false, error };
      }
      return { ok: true, item: mapGallery(data) };
    },
    delete: async (id) => {
      try { await supabase.from('gallery').delete().eq('id', id); } catch {}
    },
    updateOrder: async (items) => {
      // items: [{id, order}]
      try {
        await Promise.all(
          items.map(({ id, order }) =>
            supabase.from('gallery').update({ order }).eq('id', id)
          )
        );
      } catch (e) { console.error('[db.gallery.updateOrder]', e); }
    },
  },

  // ── Waitlist ────────────────────────────────────────────────────
  waitlist: {
    add: async ({ date, phone, userName, serviceId }) => {
      try {
        const { data } = await supabase.from('waitlist')
          .insert({ date, phone, user_name: userName, service_id: serviceId || null })
          .select().single();
        return data ? mapWaitlist(data) : null;
      } catch { return null; }
    },
    byDate: async (date) => {
      try {
        const { data } = await supabase.from('waitlist').select()
          .eq('date', date).order('created_at');
        return (data || []).map(mapWaitlist);
      } catch { return []; }
    },
    list: async () => {
      try {
        const { data } = await supabase.from('waitlist').select()
          .order('date').order('created_at');
        return (data || []).map(mapWaitlist);
      } catch { return []; }
    },
    delete: async (id) => {
      try { await supabase.from('waitlist').delete().eq('id', id); } catch {}
    },
  },

  // ── Settings ────────────────────────────────────────────────────
  settings: {
    get: async (key, fallback = null) => {
      const { data } = await supabase.from('settings').select('value')
        .eq('key', key).maybeSingle();
      return data?.value ?? fallback;
    },
    set: async (key, value) => {
      await supabase.from('settings').upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    },
  },

  // ── Analytics ───────────────────────────────────────────────────
  analytics: {
    summary: async () => {
      const [apts, clients] = await Promise.all([
        supabase.from('appointments').select().order('created_at', { ascending: false }),
        supabase.from('clients').select(),
      ]);
      const all = (apts.data || []).map(mapApt);
      const confirmed = all.filter(a => a.status === 'confirmed');
      const cancelled = all.filter(a => a.status === 'cancelled');
      const revenue   = confirmed.reduce((s, a) => s + a.price, 0);
      const noShows   = (clients.data || []).reduce((s, c) => s + (c.no_show_count || 0), 0);

      // Monthly buckets (last 6 months)
      const monthMap = {};
      all.forEach(a => {
        const m = a.date ? a.date.slice(0, 7) : null;
        if (!m) return;
        if (!monthMap[m]) monthMap[m] = { bookings: 0, revenue: 0, cancellations: 0 };
        if (a.status === 'confirmed') { monthMap[m].bookings++; monthMap[m].revenue += a.price; }
        if (a.status === 'cancelled') monthMap[m].cancellations++;
      });
      const months = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b)).slice(-6)
        .map(([month, v]) => ({ month, ...v }));

      return { total: all.length, confirmed: confirmed.length, cancelled: cancelled.length, revenue: Math.round(revenue), noShows, months };
    },
  },

  // ── Seed defaults ───────────────────────────────────────────────
  seedDefaults: async () => {
    const [svcRes, prodRes, whRes, asRes, ciRes, aboutRes, heroRes, termsRes, logoRes, otpStoreRes, sentRecRes] = await Promise.all([
      supabase.from('services').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('settings').select('key').eq('key', 'workingHours').maybeSingle(),
      supabase.from('settings').select('key').eq('key', 'adminSettings').maybeSingle(),
      supabase.from('settings').select('key').eq('key', 'clinicInfo').maybeSingle(),
      supabase.from('settings').select('key').eq('key', 'about').maybeSingle(),
      supabase.from('settings').select('key').eq('key', 'hero').maybeSingle(),
      supabase.from('settings').select('key').eq('key', 'terms').maybeSingle(),
      supabase.from('settings').select('key').eq('key', 'businessLogo').maybeSingle(),
      supabase.from('settings').select('key').eq('key', 'otp_store').maybeSingle(),
      supabase.from('settings').select('key').eq('key', 'sentReceipts').maybeSingle(),
    ]);

    const tasks = [];
    if (!svcRes.count)     tasks.push(supabase.from('services').insert(DEFAULT_SERVICES.map(s => ({ name: s.name, duration: s.duration, price: s.price }))));
    if (!prodRes.count)    tasks.push(supabase.from('products').insert(DEFAULT_PRODUCTS.map(p => ({ name: p.name, price: p.price, sale_price: p.salePrice || null, image_url: p.imageUrl, visible: p.visible }))));
    if (!whRes.data)       tasks.push(supabase.from('settings').insert({ key: 'workingHours', value: DEFAULT_WORKING_HOURS }));
    if (!asRes.data)       tasks.push(supabase.from('settings').insert({ key: 'adminSettings', value: DEFAULT_ADMIN_SETTINGS }));
    if (!ciRes.data)       tasks.push(supabase.from('settings').insert({ key: 'clinicInfo',    value: DEFAULT_CLINIC_INFO }));
    if (!aboutRes.data)    tasks.push(supabase.from('settings').insert({ key: 'about',         value: DEFAULT_ABOUT }));
    if (!heroRes.data)     tasks.push(supabase.from('settings').insert({ key: 'hero',          value: DEFAULT_HERO }));
    if (!termsRes.data)    tasks.push(supabase.from('settings').insert({ key: 'terms',         value: DEFAULT_TERMS }));
    if (!logoRes.data)     tasks.push(supabase.from('settings').insert({ key: 'businessLogo',  value: '' }));
    if (!otpStoreRes.data) tasks.push(supabase.from('settings').insert({ key: 'otp_store',     value: {} }));
    if (!sentRecRes.data)  tasks.push(supabase.from('settings').insert({ key: 'sentReceipts',  value: {} }));

    if (tasks.length) await Promise.all(tasks);
  },
};
