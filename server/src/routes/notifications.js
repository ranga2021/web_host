import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { queries } from '../db.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json({
    items: queries.listNotifications.all(),
    unread: queries.countUnreadNotifications.get().n,
  });
});

router.get('/unread-count', (req, res) => {
  res.json({ unread: queries.countUnreadNotifications.get().n });
});

router.post('/:id/read', (req, res) => {
  queries.markNotificationRead.run(Number(req.params.id));
  res.json({ ok: true });
});

router.post('/read-all', (req, res) => {
  queries.markAllNotificationsRead.run();
  res.json({ ok: true });
});

export default router;
