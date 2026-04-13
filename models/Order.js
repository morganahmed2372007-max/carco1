const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  productId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'productModel' },
  
  productModel: { type: String, enum: ['Car', 'Caruser'], required: true },
  
  orderType: { type: String, enum: ['Sale', 'Rent'], required: true },
  
  price: { type: Number, required: true },
  
  rentStart: { type: Date },
  rentEnd: { type: Date },
  
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'], 
    default: 'pending' 
  },
  
  payment: {
    method: { type: String, required: true },
    notes: { type: String }
  },
  
  statusHistory: {
    type: [
      {
        status: String,
        at: { type: Date, default: Date.now },
        note: { type: String }
      }
    ],
    default: []
  },
  
  customerDetails: {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String }
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);