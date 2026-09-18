const express = require('express');
const mongoose = require('mongoose');

const Task = require('../models/Task');
const requireAuth = require('../middleware/auth');

const router = express.Router();
const STATUSES = ['todo', 'in-progress', 'done'];

// Every task route needs a logged-in user.
router.use(requireAuth);

// Validates and cleans the request body.
// partial = true (updates): only fields that were sent are checked.
function readTaskInput(body, partial) {
  const errors = [];
  const data = {};

  if (!partial || body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (!title) errors.push('Title is required');
    else if (title.length > 100) errors.push('Title must be 100 characters or fewer');
    else data.title = title;
  }

  if (body.description !== undefined) {
    const description = String(body.description || '').trim();
    if (description.length > 500) errors.push('Description must be 500 characters or fewer');
    else data.description = description;
  }

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) errors.push('Status must be todo, in-progress or done');
    else data.status = body.status;
  }

  if (body.dueDate !== undefined) {
    if (body.dueDate === null || body.dueDate === '') {
      data.dueDate = null;
    } else {
      const d = new Date(body.dueDate);
      if (Number.isNaN(d.getTime())) errors.push('Due date is not a valid date');
      else data.dueDate = d;
    }
  }

  return { errors, data };
}

function checkId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }
  next();
}

// CREATE  POST /api/tasks
router.post('/', async (req, res, next) => {
  try {
    const { errors, data } = readTaskInput(req.body, false);
    if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

    const task = await Task.create({ ...data, owner: req.userId });
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
});

// READ ALL  GET /api/tasks?status=todo
router.get('/', async (req, res, next) => {
  try {
    const filter = { owner: req.userId };
    if (req.query.status) {
      if (!STATUSES.includes(req.query.status)) {
        return res.status(400).json({ error: 'Invalid status filter' });
      }
      filter.status = req.query.status;
    }
    const tasks = await Task.find(filter).sort({ createdAt: -1 });
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
});

// READ ONE  GET /api/tasks/:id
router.get('/:id', checkId, async (req, res, next) => {
  try {
    // Filtering by owner means users can never see someone else's task, even with its ID.
    const task = await Task.findOne({ _id: req.params.id, owner: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ task });
  } catch (err) {
    next(err);
  }
});

// UPDATE  PUT /api/tasks/:id
router.put('/:id', checkId, async (req, res, next) => {
  try {
    const { errors, data } = readTaskInput(req.body, true);
    if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId },
      data,
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ task });
  } catch (err) {
    next(err);
  }
});

// DELETE  DELETE /api/tasks/:id
router.delete('/:id', checkId, async (req, res, next) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, owner: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
