const express = require('express');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// MUST match the enum in models/Task.js and the <option> values in your frontend
const STATUSES = ['todo', 'in-progress', 'done'];
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

function cleanBody(body, partial = false) {
  const out = {};
  const errors = [];

  if (!partial || body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (!title) errors.push('Title is required');
    else if (title.length > 100) errors.push('Title must be 100 characters or fewer');
    out.title = title;
  }
  if (body.description !== undefined) {
    out.description = String(body.description || '').trim().slice(0, 1000);
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) errors.push('Invalid status');
    else out.status = body.status;
  }
  if (body.dueDate !== undefined) {
    if (!body.dueDate) out.dueDate = null;
    else if (isNaN(Date.parse(body.dueDate))) errors.push('Invalid due date');
    else out.dueDate = body.dueDate;
  }
  return { out, errors };
}

// GET /api/tasks
router.get('/', async (req, res, next) => {
  try {
    const filter = { userId: req.userId };
    if (req.query.status && STATUSES.includes(req.query.status)) filter.status = req.query.status;
    const tasks = await Task.find(filter).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) { next(err); }
});

// POST /api/tasks
router.post('/', async (req, res, next) => {
  try {
    const { out, errors } = cleanBody(req.body);
    if (errors.length) return res.status(400).json({ error: errors[0], details: errors });

    const task = await Task.create({
      userId: req.userId,
      status: 'todo',
      dueDate: null,
      description: '',
      ...out,
    });
    res.status(201).json(task);
  } catch (err) { next(err); }
});

// PUT /api/tasks/:id
router.put('/:id', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(404).json({ error: 'Task not found' });

    const { out, errors } = cleanBody(req.body, true);
    if (errors.length) return res.status(400).json({ error: errors[0], details: errors });

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: out },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) { next(err); }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(404).json({ error: 'Task not found' });
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;