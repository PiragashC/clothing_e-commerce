const { Schema, model } = require("mongoose");
const Cloth = require("./clothe");

const salesDetailSchema = new Schema(
  {
    orderId: {
      type: String,
      required: [true, "Order ID must be provided"],
      unique: true
    },
    productId: {
        type: Schema.Types.ObjectId,
        ref: Cloth,
        required: [true, "Product Id must be provided"]
      },
    designId: {
        type: Schema.Types.ObjectId,
        ref: Cloth,
        required: [true, "Design Id must be provided"]
      },
    size: {
        type: String,
      },
    name: {
        type: String,
        required: [true, "Product name must be provided"]
      },
    quantity: {
        type: Number,
        required: [true, "Quantity must be provided"]
      },
    totalPrice: {
        type: Number,
        required: [true, "Total Price must be provided"]
      },
    promotionType: {
        type: String,
        enum: ["Mega Offer", "Flash Sale", "New Style", "Summer Sale", "Seasonal Sale", "Clearance Sale", "Limited Time Offers", "Holiday Specials", "Exclusive Deals", "Bundle Offers", "Buy One Get One Free", "Weekend Specials", "No Promotion"],
        default: "No Promotion"
      },
    saleDate: {
        type: Date,
        required: [true, "Sale Date must be provided"]
    },
    design: {
      type: String,
      required: [true, "Design must be provided"]
    }
  },
  { timestamps: true }
);

module.exports = model("Sales", salesDetailSchema);
