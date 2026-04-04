const express = require('express');
const router = express.Router();
const multer = require('multer');
const asyncHandler = require('express-async-handler');
const Caruser = require('../models/Caruser');
const { verifyToken,verifyTokenAndAdmin } = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;

// إعداد multer لتخزين الصور في الذاكرة المؤقتة (RAM)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // حد أقصى 10 ميجا للصورة الواحدة
});

/**
 * دالة مساعدة لرفع الصور من الـ Buffer إلى Cloudinary
 */
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { 
        folder: 'cars_users', // اسم المجلد في Cloudinary
        resource_type: 'auto' 
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary Upload Error:", error);
          return reject(error);
        }
        resolve(result.secure_url);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

// --- [POST] إنشاء سيارة جديدة ---
router.post('/', verifyToken, upload.array('images', 5), asyncHandler(async (req, res) => {
    console.log("🚀 طلب جديد وصل: جاري معالجة البيانات...");
    
    // التأكد من وجود صور
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "يرجى رفع صورة واحدة على الأقل" });
    }

    try {
        console.log(`📸 جاري رفع ${req.files.length} صور إلى Cloudinary...`);
        
        // رفع كل الصور بالتوازي والانتظار حتى تنتهي جميعها
        const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer));
        const imageUrls = await Promise.all(uploadPromises);

        console.log("✅ تم رفع الصور بنجاح، الروابط:", imageUrls);

        // إنشاء سجل السيارة في قاعدة البيانات
        const newCar = new Caruser({
            ...req.body,
            images: imageUrls,
            owner: req.user.id // الـ ID بيجي من الـ verifyToken middleware
        });

        const savedCar = await newCar.save();
        console.log("💾 تم حفظ بيانات السيارة في MongoDB بنجاح!");

        res.status(201).json(savedCar);

    } catch (error) {
        console.error("❌ فشل الرفع أو الحفظ:", error);
        res.status(500).json({ message: "حدث خطأ أثناء معالجة الصور أو حفظ البيانات" });
    }
}));

// --- [GET] جلب سيارات المستخدم الحالي فقط ---
router.get('/my/cars', verifyToken, asyncHandler(async (req, res) => {
    const cars = await Caruser.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(cars);
}));

// --- [GET] جلب كل السيارات المعروضة للبيع ---
router.get('/all-for-sale', asyncHandler(async (req, res) => {
    const cars = await Caruser.find().sort({ createdAt: -1 });
    res.status(200).json(cars);
}));

// --- [GET] جلب بيانات سيارة واحدة بالـ ID ---
router.get('/:id', asyncHandler(async (req, res) => {
    const car = await Caruser.findById(req.params.id);
    if (!car) return res.status(404).json({ message: "السيارة غير موجودة" });
    res.status(200).json(car);
}));

// --- [DELETE] حذف سيارة ---
// نستخدم verifyToken فقط للسماح لكل المستخدمين المسجلين بالدخول
router.delete('/:id', verifyToken, asyncHandler(async (req, res) => {
    const car = await Caruser.findById(req.params.id);
    
    if (!car) return res.status(404).json({ message: "السيارة غير موجودة" });

    // التحقق: هل المستخدم هو صاحب السيارة؟
    const isOwner = car.owner.toString() === req.user.id;
    
    // التحقق: هل المستخدم هو أدمن؟
    const isAdmin = req.user.role === 'admin';

    // لو الشخص مش صاحب العربية "وكمان" مش أدمن.. ارفض الطلب
    if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "غير مسموح لك بحذف هذه السيارة" });
    }

    await Caruser.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "تم حذف السيارة بنجاح" });
}));
// --- [PUT] تحديث بيانات سيارة موجودة ---
router.put('/:id', verifyToken, upload.array('images', 5), asyncHandler(async (req, res) => {
    console.log(`🚀 جاري تحديث السيارة ذات المعرف: ${req.params.id}`);

    let car = await Caruser.findById(req.params.id);

    if (!car) {
        return res.status(404).json({ message: "السيارة غير موجودة" });
    }

    // التأكد إن اللي بيعدل هو صاحب السيارة
    if (car.owner.toString() !== req.user.id) {
        return res.status(403).json({ message: "غير مسموح لك بتعديل هذه السيارة" });
    }

    // لو فيه صور جديدة اترفعت، ارفعها لـ Cloudinary وضيفها للقديم أو استبدلها
    let imageUrls = car.images; // الاحتفاظ بالصور القديمة كبداية
    if (req.files && req.files.length > 0) {
        const newImages = await Promise.all(
            req.files.map(file => uploadToCloudinary(file.buffer))
        );
        imageUrls = [...imageUrls, ...newImages]; // ضيف الصور الجديدة للقديمة
    }

    // تحديث البيانات
    const updatedData = {
        ...req.body,
        images: imageUrls
    };

    const updatedCar = await Caruser.findByIdAndUpdate(
        req.params.id,
        updatedData,
        { new: true, runValidators: true }
    );

    console.log("✅ تم التحديث بنجاح");
    res.status(200).json(updatedCar);
}));

module.exports = router;