const { Schema, model } = require("mongoose");
const User = require("./user");

// Define the review sub-schema
const reviewSchema = new Schema({
    reviewerId: {
      type: Schema.Types.ObjectId,
      ref: User,
      required: [true, "Reviewer Id must be provided"]
    },
    name: {
      type: String,
      required: [true, "Reviewer's name must be provided"]
    },
    email: {
      type: String,
      required: [true, "Reviewer's email must be provided"]
    },
    message: {
      type: String,
      default: ""

    },
    rating: {
      type: Number,
      required: [true, "Review rating must be provided"],
      min: 0,
      max: 5
    },
    date: {
      type: String,
      required: [true, "Review date must be provided"]
    },
    time: {
      type: String,
      required: [true, "Review time must be provided"]
    }
  });

  const productTypeSchema = new Schema({
    imgUrl: {
      type: String,
      required: [true, "imgUrl must be provided"],
      // validate: {
      //   validator: function(value) {
      //     const allowedValues = ['s', 'm', 'l', 'xl', 'xxl', 'xxxl'];
      //     const validURLStart = 'https://res.cloudinary.com';
          
      //     // Check if value is one of the allowed sizes or starts with the specified URL
      //     return allowedValues.includes(value.toLowerCase()) || value.startsWith(validURLStart);
      //   },
      //   message: props => `${props.value} is not a valid type. Must be one of s, m, l, xl, xxl, xxxl, or start with ${'https://res.cloudinary.com'}`
      // }
    },
    total: {
      type: Number,
      required: [true, "quantity must be provided"]
    },
    size: {
      type: [
        {
          type: Object,
          validate: {
            validator: function (sizeObj) {
              // Ensure that the sizeObj has only one key
              const keys = Object.keys(sizeObj);
              const validSizeKeys = ['s', 'm', 'l', 'xl', 'xxl', 'xxxl'];
    
              // Validate the size key and the value
              if (keys.length !== 1 || !validSizeKeys.includes(keys[0])) {
                return false;
              }
    
              // Check that the value is an integer
              const value = sizeObj[keys[0]];
              return Number.isInteger(value);
            },
            message: (props) => `Invalid size format: ${JSON.stringify(props.value)}`,
          },
        },
      ],
    }    
  });
   
  
// Define the main schema
const clothSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Name must be provided"]
    },
    keyWords: {
      type: [String],
      required: [true, "Key words must be provided"]
    },
    rating: {
        type: Number,
        required: [true, "Rating must be provided"],
        min: 0,
        max: 5,
        default: 0
      },
    finalPrice: {
        type: Number,
        required: [true, "Final Price must be provided"]
      },
    price: {
        type: Number,
        required: [true, "Price must be provided"]
      },
    discount: {
        type: Number,
        required: [true, "Discount must be provided"]
      },
    stockStatus: {
        type: String,
        required: [true, "Stock status must be provided"],
        enum: ["In Stock", "Out of Stock", "Comming Soon"]
      },
    promotionType: {
        type: String,
        enum: ["Mega Offer", "Flash Sale", "New Style", "Summer Sale", "Seasonal Sale", "Clearance Sale", "Limited Time Offers", "Holiday Specials", "Exclusive Deals", "Bundle Offers", "Buy One Get One Free", "Weekend Specials", "No Promotion"],
        default: "No Promotion"
      },
    category: {
        type: String,
        required: [true, "Category must be provided"]
      },
    subCategory: {
        type: String,
        required: [true, "Sub category must be provided"]
      },
    design: {
        type: [productTypeSchema],
        required: [true, "design must be provided"]
      },
    desc: {
        type: String,
        default: ""
      },
    stock: {
        type: Number,
        required: [true, "Stock must be provided"]
      },
    quantity: {
        type: Number,
        required: [true, "Quantity must be provided"]
      },
    sellingRatio: {
        type: Number,
        required: [true, "Selling Ratio must be provided"],
        default: 0
      }, 
    brand: {
        type: String,
        required: [true, "Brand must be provided"]
      },
    review: {
        type: [reviewSchema],
        default: []
      },
    images: {
        type: Array,
        required: [true, "Image must be provided"]
      }
  },
  { timestamps: true }
);

module.exports = model("Cloth", clothSchema);
