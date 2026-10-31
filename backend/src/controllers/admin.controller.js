import * as featured from '../services/featured.service.js';
import * as stats from '../services/adminStats.service.js';
import * as home from '../services/home.service.js';

export const featuredAll = async (req, res) => res.json({ data: { featured: await featured.adminAll() } });
export const setManual = async (req, res) => res.json({ data: { slot: await featured.setManual(req.user, req.valid.params.slot, req.valid.body, req.ip) } });
export const featuredSettings = async (req, res) => res.json({ data: { slot: await featured.updateSettings(req.user, req.valid.params.slot, req.valid.body, req.ip) } });
export const refresh = async (req, res) => res.json({ data: { slot: await featured.forceRefresh(req.user, req.valid.params.slot, req.ip) } });
export const getStats = async (req, res) => res.json({ data: await stats.stats() });
export const getAudit = async (req, res) => res.json({ data: await stats.audit(req.valid.query) });
export const getHome = async (req, res) => res.json({ data: await home.home(req.user) });
