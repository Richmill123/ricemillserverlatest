import express from 'express';
import {
  createSuspense,
  getSuspense,
  updateSuspense,
  deleteSuspense,
} from '../controllers/suspenseController.js';

const router = express.Router();

router.post('/', createSuspense);
router.get('/', getSuspense);
router.put('/:id', updateSuspense);
router.delete('/:id', deleteSuspense);

export default router;
