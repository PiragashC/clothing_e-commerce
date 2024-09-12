const { Schema, model } = require("mongoose");
const User = require("./user");
const Sales = require("./sales");

const orderDetailSchema = new Schema(
  {
    orderId: {
      type: String,
      required: [true, "Order ID must be provided"],
      unique: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: User,
      required: [true, "UserId No must be provided"]
    },
    productDetail: [Sales.schema],
    billingAmount: {
      type: Number,
      required: [true, "Billing Amount must be provided"]
    },
    paymentMethod: {
      type: String,
      required: [true, "Payment Method must be provided"],
      enum: ["Direct Bank Transfer", "Cash on Delivery", "Credit/Debit Cars"]
    },
    slips: {
      type: Array,
      required: function() {
        return this.paymentMethod === 'Direct Bank Transfer';
      }
    },
    status: {
      type: String,
      required: [true, "Order Status must be provided"],
      enum: ["Pending", "Confirmed", "Delivered", "Cancelled", "Rejected"]
    }
  },
  { timestamps: true }
);

module.exports = model("OrderDetail", orderDetailSchema);
