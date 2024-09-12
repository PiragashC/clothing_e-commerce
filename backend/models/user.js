const { Schema, model } = require("mongoose");
const Cloth = require("./clothe");

const cartSchema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: "Cloth",
    required: [true, "Product Id must be provided"]
  },
  designId: {
      type: Schema.Types.ObjectId,
      ref: "Cloth",
      required: [true, "Design Id must be provided"]
    },
  size: {
      type: String,
    },
  quantity: {
      type: Number,
      required: [true, "Quantity must be provided"]
    },
}, 
// { _id: false }
);

const userSchema = new Schema(
  {
    email: {
      type: String,
      unique: true,
      required: [true, "Email must be provided"]
    },
    title: {
      type: String,
      required: function() {
        return this.role === "User";
      },
      enum: ["Mr", "Mrs", "Ms"]
    },
    firstName: {
      type: String,
      required: [true, "First name must be provided"]
    },
    lastName: {
      type: String,
      default: "",
    },
    password: {
      type: String,
      min: 8,
      required: [true, "Password must be provided"],
      select: false // Exclude this field when querying
    },
    mobileNumber: {
      type: Number,
      required: function() {
        return this.role === "User";
      },
    },
    orders: {
      type: Number,
      default: function() {
        return this.role === "User" ? 0 : undefined;
      }
    },
    supTic: {
      type: Number,
      default: function() {
        return this.role === "User" ? 0 : undefined;
      }
    },
    cart: {
      type: [cartSchema],
      set: function(value) {
        console.log(this.role);
        if (this.role !== "User") {
          return undefined;
        }
        return value || [];
      }
    },    
    address: {
      type: String,
      required: function() {
        return this.role === "User";
      },
    },
    role: {
      type: String,
      enum: ["Admin", "User"],
      required: [true, "Role must be provided"]
    },
    city: {
      type: String,
      set: function(value) {
        if (!this.role === "User") {
          return undefined;
        }
        return value || "";
      }
    },
    country: {
      type: String,
      set: function(value) {
        if (!this.role === "User") {
          return undefined;
        }
        return value || "";
      }
    },
    postCode: {
      type: String,
      set: function(value) {
        if (!this.role === "User") {
          return undefined;
        }
        return value || "";
      }
    },
    dp: {
      type: String,
      set: function(value) {
        if (!this.role === "User") {
          return undefined;
        }
        return value || "";
      }
    }
  },
  { timestamps: true }
);

module.exports = model("User", userSchema);
