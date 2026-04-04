const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { verifyToken, verifyTokenAndAdmin } = require('../middleware/auth');

/**
 * @desc    تسجيل مستخدم جديد
 * @route   POST /api/users/register
 */
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'البيانات ناقصة' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: 'هذا البريد مسجل بالفعل' });
    }

    const user = new User({ fullName, email, password });
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '8d' });
    const { password: _, ...userResponse } = user.toObject();

    res.status(201).json({ user: userResponse, token });
  })
);

/**
 * @desc    تسجيل دخول
 * @route   POST /api/users/login
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '8d' });
    const { password: _, ...userResponse } = user.toObject();

    res.status(200).json({ user: userResponse, token });
  })
);

/**
 * @desc    جلب كل المستخدمين
 * @route   GET /api/users
 * @access  Private (Admin Only)
 */
router.get(
  '/',
  verifyTokenAndAdmin,
  asyncHandler(async (req, res) => {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.status(200).json(users);
  })
);

/**
 * @desc    حذف مستخدم
 * @route   DELETE /api/users/:id
 * @access  Private (Admin Only)
 */
router.delete(
  '/:id',
  verifyTokenAndAdmin,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // نصيحة: منع الأدمن من حذف حسابه الشخصي
    if (req.user.id === req.params.id) {
      return res.status(400).json({ message: 'لا يمكنك حذف حسابك الشخصي' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'تم حذف المستخدم بنجاح' });
  })
);

module.exports = router;