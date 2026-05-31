import express from 'express';
const router = express.Router();
import {
  upsertPreference,
  getPreference,
  createPreference,
  getPreferences,
  getPreferenceById,
  updatePreference,
  deletePreference,
} from '../controllers/preferenceController.js';

import { protect } from '../middleware/authMiddleware.js';

// Primary endpoints used by the frontend
router.put('/save', protect, upsertPreference);   // upsert — create or update
router.get('/my',   getPreference);               // single record for clientId (clientId is the auth boundary)

// Legacy / admin endpoints
router.route('/')
  .post(createPreference)
  .get(getPreferences);

router.route('/:id')
  .get(getPreferenceById)
  .put(updatePreference)
  .delete(deletePreference);

export default router;
