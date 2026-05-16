const mongoose = require('mongoose');
const Orders = require('./models/Orders');
require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected');
  
  const userIdStr = '69dc9147634eceb27fc2b3fb'; // Actual user ID
  const userIdObj = mongoose.Types.ObjectId.isValid(userIdStr) ? new mongoose.Types.ObjectId(userIdStr) : null;
  
  const query = {
    $and: [
      {
        $or: [
          { userId: userIdStr },
          { user: userIdStr },
          ...(userIdObj ? [{ userId: userIdObj }, { user: userIdObj }] : [])
        ]
      },
      { status: { $in: ['confirmed', 'processing'] } }
    ]
  };
  
  console.log('Query:', JSON.stringify(query, null, 2));
  const count = await Orders.countDocuments(query);
  console.log('Count:', count);
  
  const allOrders = await Orders.find({ $or: [{ userId: userIdStr }, { user: userIdStr }] });
  console.log('Total orders for user:', allOrders.length);
  console.log('Statuses:', allOrders.map(o => o.status));
  
  process.exit();
}

test().catch(err => { console.error(err); process.exit(1); });
