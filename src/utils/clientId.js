import Admin from '../models/adminModel.js';

const OBJECT_ID = /^[a-f\d]{24}$/i;

export function millIdFromUsername(username) {
  const value = String(username || '').trim().toLowerCase();
  if (!value) return '';
  const slash = value.indexOf('/');
  return slash === -1 ? value : value.slice(0, slash);
}

export async function resolveMillClientId(clientId) {
  const raw = String(clientId || '').trim();
  if (!raw) return raw;

  if (!OBJECT_ID.test(raw)) {
    return millIdFromUsername(raw) || raw;
  }

  const admin = await Admin.findById(raw).select('username').lean();
  const millId = millIdFromUsername(admin?.username);
  return millId || raw;
}

export async function normalizeRequestClientId(req, res, next) {
  try {
    if (req.query?.clientId) {
      req.query.clientId = await resolveMillClientId(req.query.clientId);
    }
    if (req.body && typeof req.body === 'object' && req.body.clientId) {
      req.body.clientId = await resolveMillClientId(req.body.clientId);
    }
    next();
  } catch (err) {
    next(err);
  }
}
