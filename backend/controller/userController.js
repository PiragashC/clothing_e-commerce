const Order = require("../models/order");
const User = require("../models/user");
const Cloth = require("../models/clothe");
const SupportTic = require("../models/supportTic");
const { generateToken, decodeToken } = require("../common/jwt");
const { register, login } = require("./authController");
const {handleUpload, deleteOldImage} = require("../utils/cloudinaryUtils");
const { generateClothDetails, updateClothProducts, fetchAndValidateProduct } = require("../common/cloth");
const sendEmail = require("../common/mailService");
const bcrypt = require("bcrypt");
const dotenv = require('dotenv');
const EmailVerify = require("../models/emailVerify");
const mongoose = require("mongoose");
const ForgotUserEmail = require("../models/forgotUserEmail");
const ContactForm = require("../models/contact");
const Faq = require("../models/faq");

// Load environment variables from .env file
dotenv.config();

/* create a fumction to add the product to the cart */
const addToCartFunction = async (req, res) => {
  try {
    const { userDetail, productDetail } = req.body;

    if (!userDetail || !productDetail) {
      return res.status(400).json({ message: "Please provide required fields" });
    }

    const { email, title, firstName, lastName, password, mobileNumber, address, city, country, postCode, accessToken, registeredStatus } = userDetail;
    let user;

    if (accessToken) {
      try {
        user = await decodeToken(accessToken, process.env.JWT_SECRET);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        if (user.role === "Admin") {
          return res.status(401).json({ error: "You are not authorized" });
        }
        // token = accessToken;
      } catch (error) {
        return res.status(401).json({ error: "Invalid token" });
      }
    } else if (registeredStatus) {
      const result = await login(email, password, "User");
      if (result.status !== 200) {
        return res.status(result.status).json({ error: result.error });
      }
      if (result.user.role === "Admin") {
        return res.status(401).json({ error: "You are not authorized" });
      }
      user = result.user;
      // token = result.token;
    } else {
      const result = await register(email, title, firstName, lastName, password, mobileNumber, address, city, country, postCode, "User");
      if (result.status !== 201) {
        return res.status(result.status).json({ error: result.error });
      }
      user = result.user;
      // token = generateToken(user, process.env.JWT_SECRET);
    }

    const [newProductDetails] = await generateClothDetails([productDetail], "","buy");

    if (user) { 
      // Initialize the cart if it doesn't exist
      const cart = user.cart || [];

      // Add the new product details to the cart
      cart.push({
        productId: newProductDetails.productId,
        designId: newProductDetails.designId,
        ...(newProductDetails.size && { size: newProductDetails.size }),
        quantity: newProductDetails.quantity,
      });

      // Update the user's cart in the database
      const updatingUser = await User.findById(user._id || user.id);

      updatingUser.cart = cart;
      await updatingUser.save();

     const token = generateToken(updatingUser, process.env.JWT_SECRET);

      return res.status(201).json({
        message: "Product added successfully to the cart!",
        updatedUser: updatingUser.toObject(),
        token,
      });
    } else {
      return res.status(400).json({ error: "User not found" });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* remove item from the cart */
const removeItemFromCart = async (req, res) => {
  try {
    const { id } = req.user; // User ID
    const { cartId } = req.params; // Cart item ID to remove

    // Use the $pull operator to remove the item from the cart array
    const user = await User.findByIdAndUpdate(
      id,
      { $pull: { cart: { _id: cartId } } },
      { new: true } // Return the modified document after update
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const token = generateToken(user, process.env.JWT_SECRET);

    res.status(200).json({ message: "Item removed from cart successfully", user, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* change the quantity of the product in a cart */
const changeQuantity = async (req, res) => {
  try {
    const { id } = req.user; // User ID
    const { cartId, quantity } = req.body; // Cart item ID and new quantity from request body

    // Find the user and the specific cart item by cartId
    const user = await User.findOne({ _id: id, "cart._id": cartId });

    if (!user) {
      return res.status(404).json({ error: "User or cart item not found" });
    }

    // Get the specific cart item
    const cartItem = user.cart.id(cartId);

    if (!cartItem) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    // Validate the product before updating the quantity
    await fetchAndValidateProduct(
      cartItem.productId,
      cartItem.designId,
      cartItem.size,
      quantity,
      "buy" // Specify the type as "buy" for validation
    );

    // If validation passes, update the quantity
    cartItem.quantity = quantity;

    // Save the updated user document
    await user.save();

    const token = generateToken(user, process.env.JWT_SECRET);

    res.status(200).json({ message: "Cart item quantity updated successfully", user, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* clear cart */
const clearCart = async (req, res) => {
  try {
    const { id } = req.user; // User ID

    // Find the user by ID and clear the cart by setting it to an empty array
    const user = await User.findById(
      id
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.cart = [];
    await user.save();

    const token = generateToken(user, process.env.JWT_SECRET);

    res.status(200).json({ message: "Cart cleared successfully", user, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



/* generating orderId */
async function generateOrderId() {
  const latestOrder = await Order.findOne().sort({ createdAt: -1 }).select("orderId").exec();
  if (latestOrder && latestOrder.orderId) {
    const lastIdNumber = parseInt(latestOrder.orderId.split("-")[1]);
    const newIdNumber = lastIdNumber + 1;
    return `#Order-${newIdNumber.toString().padStart(6, "0")}`;
  } else {
    return "#Order-000100";
  }
}

const orderIdCreationApi = async(req, res) => {
  try{
    const orderId = await generateOrderId();
    res.status(200).json({ orderId });
  }catch(err){
    console.log(err);
    res.status(500).json({ error: err.message });
  };
};

/* create a document for an order */
const orderDetail = async (req, res) => {
    try {
        const { orderId, paymentMethod } = req.body;
        const { role, id } = req.user;

        if(role !== "User"){
          return res.status(403).json({ error: "You are not authorized" });
        }

        if(!orderId || !paymentMethod){
          return res.status(400).json({ message:"Invalid order" });
        };

        const parsedOrderId = JSON.parse(orderId);
        const parsedPaymentMethod = JSON.parse(paymentMethod);

        if (parsedPaymentMethod === "Direct Bank Transfer" && (!req.files || req.files.length === 0)) {
            return res.status(400).json({ error: 'Payment slip proof needs to be attached' });
        }

        const orderingUser = await User.findById(id);

        if (orderingUser.cart.length===0) {
            return res.status(404).json({ error: 'Your cart is empty!' });
        }

        const newProductDetails = await generateClothDetails(orderingUser.cart, parsedOrderId, "buy");

        const slips = [];

        if (req.files) {
            for (const file of req.files) {
                const b64 = Buffer.from(file.buffer).toString("base64");
                const dataURI = `data:${file.mimetype};base64,${b64}`;
                const cldRes = await handleUpload(dataURI);
                slips.push(cldRes.secure_url);
            }
        }

        const billingAmount = newProductDetails.reduce((acc, product) => acc + product.totalPrice, 0);

        const newOrder = new Order({
            orderId: parsedOrderId,
            userId: orderingUser._id,
            productDetail: newProductDetails,
            billingAmount,
            paymentMethod: parsedPaymentMethod,
            ...(parsedPaymentMethod === "Direct Bank Transfer" && { slips }),
            status: "Pending"
        });

        await newOrder.save();

        await updateClothProducts(orderingUser.cart, "buy"); 

        orderingUser.cart = [];
        await orderingUser.save();
        
        const token = generateToken(orderingUser, process.env.JWT_SECRET);

        const emailResponse = await sendEmail(
          orderingUser.email,
          'Order Confirmation - SHOPNAME',
          `
              <div style="padding: 20px; font-family: Calibri, sans-serif;">
                  <div style="text-align: center;">
                      <a href="webaddress"><img src="logo" alt="Shopname Logo" width="80" height="80"></a>
                  </div>
                  <div style="margin-top: 40px; font-size: 15px;">
                      <p>Dear ${orderingUser.title} ${orderingUser.firstName} ${orderingUser.lastName},</p>
                      <p>Thank you for your order (Order ID: ${parsedOrderId}). We are currently reviewing your order and payment details. You will receive an update soon. You can also track your order in your dashboard.</p>
                      <p>Order Details:</p>
                      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                          <thead>
                              <tr>
                                  <th style="border: 1px solid #ddd; padding: 8px;">No.</th>
                                  <th style="border: 1px solid #ddd; padding: 8px;">Design</th>
                                  <th style="border: 1px solid #ddd; padding: 8px;">Name</th>
                                  <th style="border: 1px solid #ddd; padding: 8px;">Size</th>
                                  <th style="border: 1px solid #ddd; padding: 8px;">Qty</th>
                                  <th style="border: 1px solid #ddd; padding: 8px;">Promotion Type</th>
                                  <th style="border: 1px solid #ddd; padding: 8px;">Price (LKR)</th>
                              </tr>
                          </thead>
                          <tbody>
                              ${newOrder.productDetail.map((product, index) => `
                                  <tr>
                                      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${index + 1}</td>
                                      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;"><img src="${product.design}" alt="Product Design" width="50" height="50"></td>
                                      <td style="border: 1px solid #ddd; padding: 8px;">${product.name}</td>
                                      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${product.size || "N/A"}</td>
                                      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${product.quantity}</td>
                                      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${product.promotionType}</td>
                                      <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${product.totalPrice}</td>
                                  </tr>
                              `).join('')}
                              <tr>
                                  <td colspan="5" style="border: 1px solid #ddd; padding: 8px; text-align: right;"><strong>Total (LKR)</strong></td>
                                  <td style="border: 1px solid #ddd; padding: 8px; text-align: right;"><strong>${newOrder.billingAmount}</strong></td>
                              </tr>
                          </tbody>
                      </table>
                      <p style="margin-top: 20px;">If you have any questions, please contact our support team at <a href="mailto:supportaddress">supportaddress</a>.</p>
                      <p>Thank you for choosing Shopname. We look forward to serving you.</p>
                  </div>
              </div>
          `
      );
      
        return res.status(201).json({
            emailSent: emailResponse.emailSent,
            mailMsg: emailResponse.message,
            message:"Order created successfully!",
            orderedDetail: newOrder.toObject(),
            user:orderingUser.toObject(),
            token,
            info: emailResponse.info || null,
            error: emailResponse.error || null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/* buy now function */
const buyNow = async(req, res) => {
  try{
    const { userDetail, productDetail, orderId, paymentMethod } = req.body;

    if (!userDetail || !productDetail) {
      return res.status(400).json({ message: "Please provide required fields" });
    };

    if(!orderId || !paymentMethod){
      return res.status(400).json({ message:"Invalid order" });
    };

    const parsedUserDetail = JSON.parse(userDetail);
    const parsedProductDetail = JSON.parse(productDetail);

    const { email, title, firstName, lastName, password, mobileNumber, address, city, country, postCode, accessToken, registeredStatus } = parsedUserDetail;
    let user;

    if (accessToken) {
      try {
        user = await decodeToken(accessToken, process.env.JWT_SECRET);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        if (user.role === "Admin") {
          return res.status(401).json({ error: "You are not authorized" });
        }
        token = accessToken;
      } catch (error) {
        return res.status(401).json({ error: "Invalid token" });
      }
    } else if (registeredStatus) {
      const result = await login(email, password, "User");
      if (result.status !== 200) {
        return res.status(result.status).json({ error: result.error });
      }
      if (result.user.role === "Admin") {
        return res.status(401).json({ error: "You are not authorized" });
      }
      user = result.user;
      token = result.token;
    } else {
      const result = await register(email, title, firstName, lastName, password, mobileNumber, address, city, country, postCode, "User");
      if (result.status !== 201) {
        return res.status(result.status).json({ error: result.error });
      }
      user = result.user;
      token = generateToken(user, process.env.JWT_SECRET);
    };

        const parsedOrderId = JSON.parse(orderId);
        const parsedPaymentMethod = JSON.parse(paymentMethod);

        if (parsedPaymentMethod === "Direct Bank Transfer" && (!req.files || req.files.length === 0)) {
            return res.status(400).json({ error: 'Payment slip proof needs to be attached' });
        };

        const newProductDetails = await generateClothDetails([parsedProductDetail], parsedOrderId, "buy");

        const slips = [];

        if (req.files) {
            for (const file of req.files) {
                const b64 = Buffer.from(file.buffer).toString("base64");
                const dataURI = `data:${file.mimetype};base64,${b64}`;
                const cldRes = await handleUpload(dataURI);
                slips.push(cldRes.secure_url);
            }
        }

        const billingAmount = newProductDetails.reduce((acc, product) => acc + product.totalPrice, 0);

        const newOrder = new Order({
            orderId: parsedOrderId,
            userId: user.id || user._id,
            productDetail: newProductDetails,
            billingAmount,
            paymentMethod: parsedPaymentMethod,
            ...(parsedPaymentMethod === "Direct Bank Transfer" && { slips }),
            status: "Pending"
        });

        await newOrder.save();

        await updateClothProducts([parsedProductDetail], "buy"); 

        const emailResponse = await sendEmail(
          user.email,
          'Order Confirmation - SHOPNAME',
          `
              <div style="padding: 20px; font-family: Calibri, sans-serif;">
                  <div style="text-align: center;">
                      <a href="webaddress"><img src="logo" alt="Shopname Logo" width="80" height="80"></a>
                  </div>
                  <div style="margin-top: 40px; font-size: 15px;">
                      <p>Dear ${user.title} ${user.firstName} ${user.lastName},</p>
                      <p>Thank you for your order (Order ID: ${parsedOrderId}). We are currently reviewing your order and payment details. You will receive an update soon. You can also track your order in your dashboard.</p>
                      <p>Order Details:</p>
                      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                          <thead>
                              <tr>
                                  <th style="border: 1px solid #ddd; padding: 8px;">No.</th>
                                  <th style="border: 1px solid #ddd; padding: 8px;">Design</th>
                                  <th style="border: 1px solid #ddd; padding: 8px;">Name</th>
                                  <th style="border: 1px solid #ddd; padding: 8px;">Size</th>
                                  <th style="border: 1px solid #ddd; padding: 8px;">Qty</th>
                                  <th style="border: 1px solid #ddd; padding: 8px;">Promotion Type</th>
                                  <th style="border: 1px solid #ddd; padding: 8px;">Price (LKR)</th>
                              </tr>
                          </thead>
                          <tbody>
                              ${newOrder.productDetail.map((product, index) => `
                                  <tr>
                                      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${index + 1}</td>
                                      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;"><img src="${product.design}" alt="Product Design" width="50" height="50"></td>
                                      <td style="border: 1px solid #ddd; padding: 8px;">${product.name}</td>
                                      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${product.size || "N/A"}</td>
                                      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${product.quantity}</td>
                                      <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${product.promotionType}</td>
                                      <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${product.totalPrice}</td>
                                  </tr>
                              `).join('')}
                              <tr>
                                  <td colspan="5" style="border: 1px solid #ddd; padding: 8px; text-align: right;"><strong>Total (LKR)</strong></td>
                                  <td style="border: 1px solid #ddd; padding: 8px; text-align: right;"><strong>${newOrder.billingAmount}</strong></td>
                              </tr>
                          </tbody>
                      </table>
                      <p style="margin-top: 20px;">If you have any questions, please contact our support team at <a href="mailto:supportaddress">supportaddress</a>.</p>
                      <p>Thank you for choosing Shopname. We look forward to serving you.</p>
                  </div>
              </div>
          `
      );
      
        return res.status(201).json({
            emailSent: emailResponse.emailSent,
            mailMsg: emailResponse.message,
            message:"Order created successfully!",
            orderedDetail: newOrder.toObject(),
            user,
            token,
            info: emailResponse.info || null,
            error: emailResponse.error || null
        });
    
  }catch(err){
    res.status(500).json({ error: err.message });
  };
};

/* edit order details in the pending status  */
const editOrderDetails = async (req, res) => {
    try {
        const { orderId, productDetails, paymentMethod } = req.body;
        const { id, email, title, firstName, lastName, mobileNumber, address, city, country, postCode } = req.user;

        const orderToUpdate = await Order.findOne({
            orderId,
            'userDetail.userId': id,
            status: { $in: ['Pending', 'Rejected'] }
        });

        if (!orderToUpdate) {
            return res.status(404).json({ error: "Order not found with pending status for logged-in user" });
        }

        const newProductDetails = await generateClothDetails(productDetails);

        const billingAmount = newProductDetails.reduce((acc, product) => acc + product.totalPrice, 0);

        const slips = [];

        if (req.files) {
            for (const file of req.files) {
                const b64 = Buffer.from(file.buffer).toString('base64');
                const dataURI = `data:${file.mimetype};base64,${b64}`;
                const cldRes = await handleUpload(dataURI);
                slips.push(cldRes.secure_url);
            }
        }

        const updatedOrder = await Order.findOneAndUpdate(
            {
                orderId,
                'userDetail.userId': id,
                status: { $in: ['Pending', 'Rejected'] }
            },
            {
                $set: {
                    userDetail: {
                        userId: id,
                        email,
                        title,
                        firstName,
                        lastName,
                        mobileNumber,
                        address,
                        city,
                        country,
                        postCode
                    },
                    productDetail: newProductDetails,
                    billingAmount,
                    paymentMethod,
                    ...(paymentMethod === 'Direct Bank Transfer' && { slips }),
                    status: 'Pending'
                }
            },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ error: 'Error occurred while updating your order' });
        }

        await updateClothProducts(orderToUpdate.productDetail, "return");
        await updateClothProducts(productDetails, "buy");

        res.status(200).json(updatedOrder.toObject());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/* update user info */
const updateUserInfo = async (req, res) => {
    try {
        const {
            email, title, firstName, lastName,
            mobileNumber, address, city, country, postCode
        } = req.body;

        const { id } = req.user;

        const parsedEmail = email && JSON.parse(email);
        const parsedTitle = title && JSON.parse(title);
        const parsedFirstName = firstName && JSON.parse(firstName);
        const parsedLastName = lastName && JSON.parse(lastName);
        const parsedMobileNumber = mobileNumber && JSON.parse(mobileNumber);
        const parsedAddress = address && JSON.parse(address);
        const parsedCity = city && JSON.parse(city);
        const parsedCountry = country && JSON.parse(country);
        const parsedPostCode = postCode && JSON.parse(postCode);

        const userDetailTobeUpdated = await User.findById(id);

        if(!userDetailTobeUpdated){
          res.status(404).json({ error:"User not found" });
        };

        if(parsedEmail){
          const isEmailVerified = await EmailVerify.findOne({ email: email.toLowerCase(), verifyStatus: true});
  
          if(!isEmailVerified){
            return res.status(400).json({ error: "Please verify your email first!"});
          };
        };

        let dp = userDetailTobeUpdated.dp;
        let oldDp;

        if (req.file) {

          if (dp) {
            const urlParts = dp.split('/');
            const fileName = urlParts[urlParts.length - 1];
            oldDp = fileName.split('.')[0];
          }

            const b64 = Buffer.from(req.file.buffer).toString('base64');
            const dataURI = `data:${req.file.mimetype};base64,${b64}`;
            const cldRes = await handleUpload(dataURI);
            dp = cldRes.secure_url;

            if(oldDp){
              await deleteOldImage(oldDp);
            };

        }

        const updateFields = {
            email: parsedEmail || userDetailTobeUpdated.email,
            title: parsedTitle || userDetailTobeUpdated.title, 
            firstName: parsedFirstName || userDetailTobeUpdated.firstName, 
            lastName: parsedLastName || userDetailTobeUpdated.lastName,
            mobileNumber: parsedMobileNumber || userDetailTobeUpdated.mobileNumber, 
            address: parsedAddress || userDetailTobeUpdated.address, 
            city: parsedCity || userDetailTobeUpdated.city, 
            country: parsedCountry || userDetailTobeUpdated.country, 
            postCode: parsedPostCode || userDetailTobeUpdated.postCode
        };

        // Only set 'dp' field if a new file was uploaded
        if (dp) {
            updateFields.dp = dp;
        }

        const updatedUserInfo = await User.findByIdAndUpdate(
            id,
            { $set: updateFields },
            { new: true }
        );

        if (!updatedUserInfo) {
            return res.status(404).json({ error: 'Error in updating!' });
        }

        const token = generateToken(updatedUserInfo, process.env.JWT_SECRET);

        res.status(200).json({
            message: 'User info updated successfully!',
            newUserInfo:updatedUserInfo.toObject(),
            token
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

/* change the user password */
const updatingUserPassword = async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const { id } = req.user;

      if(! currentPassword || ! newPassword) {
        return res.status(400).json({ error: 'Please provide current password and new password' });
      };
  
      const user = await User.findById(id).select('+password');
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      const passwordMatch = await bcrypt.compare(currentPassword, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Password does not match' });
      }
  
      const hashPassword = await bcrypt.hash(newPassword, 12);
      await User.findByIdAndUpdate(id, { password: hashPassword });
  
      res.status(200).json({ message: 'Password updated successfully!' });
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
};

/* submit a review */
const submitReview = async (req, res) => {
  try {
      const { message, rating, productId } = req.body;
      const { id, role } = req.user;

      if (role === 'Admin') {
          return res.status(401).json({ error: 'You are not authorized to perform this action' });
      }

      if (!rating || !productId) {
          return res.status(400).json({ error: 'Please provide rating and product id' });
      }

      if (rating < 0 || rating > 5) {
          return res.status(400).json({ error: 'Rating must be between 0 and 5' });
      }

      const currentDate = new Date();
      const date = currentDate.toLocaleDateString();
      const time = currentDate.toLocaleTimeString();

      const reviewer = await User.findById(id);
      if(!reviewer){
        return res.status(404).json({ error: 'Reviewer not found' });
      };

      const newReview = {
          ...(message && { message }),
          rating,
          reviewerId: id,
          name: reviewer.firstName + ' ' + reviewer.lastName,
          email: reviewer.email,
          date,
          time
      };

      const updatedProduct = await Cloth.findByIdAndUpdate(
          productId,
          { $push: { review: newReview } },
          { new: true }
      );

      if (!updatedProduct) {
          return res.status(404).json({ error: 'Product not found' });
      }

      // Calculate the new average rating
      const allReviews = updatedProduct.review;
      const totalRatings = allReviews.reduce((acc, review) => acc + review.rating, 0);
      const averageRating = totalRatings / allReviews.length;

      // Update the product's overall rating
      updatedProduct.rating = averageRating;
      await updatedProduct.save();

      res.status(200).json(updatedProduct);
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
};

/* get all reviews for user*/
const getAllReviewsForUser = async (req, res) => {
  try {
    const { id } = req.user;
    const { page = 1, limit = 10 } = req.query;

    if (!page || !limit) {
      return res.status(400).json({ error: "Provide page and limit" });
    }

    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);

    if (isNaN(parsedPage) || parsedPage <= 0 || isNaN(parsedLimit) || parsedLimit <= 0) {
      return res.status(400).json({ error: "Page and limit must be positive integers" });
    }

    // Calculate the number of documents to skip
    const skip = (parsedPage - 1) * parsedLimit;

    // Use aggregation to directly fetch the reviews
    const result = await Cloth.aggregate([
      { $unwind: "$review" },
      { $match: { "review.reviewerId": new mongoose.Types.ObjectId(id) } },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $sort: { "review.date": -1, "review.time": -1 } },
            { $skip: skip },
            { $limit: parsedLimit },
            {
              $project: {
                reviewId: "$review._id",
                productId: "$_id",
                productName: "$name",
                design: { $arrayElemAt: ["$images", 0] },
                urRating: "$review.rating",
                message: "$review.message",
                date: "$review.date",
                time: "$review.time"
              }
            }
          ]
        }
      }
    ]);

    const totalCount = result[0].metadata.length ? result[0].metadata[0].total : 0;
    const userReviews = result[0].data;

    if (userReviews.length === 0) {
      return res.status(404).json({ error: "No reviews found" });
    }

    return res.status(200).json({
      currentPage: parsedPage,
      totalPages: Math.ceil(totalCount / parsedLimit),
      totalCount,
      data: userReviews
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* edit user review */
const editUserReview = async (req, res) => {
  try {
      const { reviewId, message, rating } = req.body;
      const { id } = req.user;

      if (!reviewId || (!message && !rating)) {
          return res.status(400).json({ error: 'Please provide review id and either message or rating' });
      }

      // Construct the update object based on provided fields
      const updateFields = {};
      if (message) {
          updateFields["review.$.message"] = message;
      }
      if (rating) {
          updateFields["review.$.rating"] = rating;
          if(0 > rating > 5){
            return res.status(400).json({ error: 'Rating must be between 5 and 0' });
          };
      }

      const updatedReview = await Cloth.findOneAndUpdate(
          {
              "review._id": reviewId,
              "review.reviewerId": id
          },
          {
              $set: updateFields
          },
          { new: true }  // This option ensures the returned document is the updated one
      );

      if (!updatedReview) {
          return res.status(404).json({ error: "Error in updating your review" });
      }

      res.status(200).json(updatedReview);
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
};

/* create a support tic  */
const createSupportTic = async(req, res) => {
    try{
        const { reportMsg } = req.body;
        const { id, role } = req.user;

        if(role === 'Admin') {
          return res.status(401).json({ error: 'You are not authorized to perform this action' });
        };

        if(!reportMsg) {
          return res.status(400).json({ error: 'Please provide report message' });
        };

      const currentDate = new Date();
      const date = currentDate.toLocaleDateString(); 
      const time = currentDate.toLocaleTimeString();

        const newSupportTic = new SupportTic({
            userId : id,
            reportMsg,
            date,
            time
        });

        await newSupportTic.save();
        await User.findByIdAndUpdate(
          id,
          { $inc: { supTic: 1 } },
          { new: true }
        );

        res.status(200).json({
            message: "Support ticket created successfully!",
            newSupportTic
        });

    }catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// Utility function to generate a 6-digit verification code
const generateVerificationCode = () => {
  const charset = '0123456789';
  let verificationCode = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    verificationCode += charset[randomIndex];
  }
  return verificationCode;
};

// Utility function to hash the verification code
const hashingVerificationCode = async (verificationCode) => {
  return await bcrypt.hash(verificationCode, 12);
};

// Utility function to send the verification email
const sendVerificationEmail = async (email, subject, content, verificationCode) => {
  return await sendEmail(
    email,
    subject,
    `
      <div style="padding: 20px; font-family: Calibri;">
        <div style="text-align: center;">
          <a href="webaddress"><img src="logo" alt="Shopname Logo" width="80" height="80"></a>
        </div>
        <div style="margin-top: 40px; font-size: 15px;">
          <p>Dear Sir/Madam,</p>
          <p>${content}</p>
          <h1>${verificationCode}</h1>
          <p>If you have any questions, please contact our support team at <a href="mailto:supportaddress">supportaddress</a>.</p>
          <p>Thank you for choosing Shopname. We look forward to serving you.</p>
        </div>
      </div>
    `
  );
};

// Function to handle email verification for new users
const sendingVerificationCodeForEmailVerify = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(500).json({ error: "Please provide email" });
    }

    // Check if email is already registered
    const userAlreadyRegistered = await User.findOne({ email: email.toLowerCase() }).lean();
    if (userAlreadyRegistered) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Delete any existing verification code for this email
    await EmailVerify.deleteOne({ email: email.toLowerCase() });

    // Generate and hash verification code
    const verificationCode = generateVerificationCode();
    const hashVerificationCode = await hashingVerificationCode(verificationCode);

    // Create a new EmailVerify entry
    const newEmailVerify = new EmailVerify({
      email: email.toLowerCase(),
      verificationCode: hashVerificationCode,
      verifyStatus: false
    });

    await newEmailVerify.save();

    // Send the verification email
    const emailResponse = await sendVerificationEmail(
      email,
      'Email Verification Code!',
      'Please use the following code to verify your email. We\'re excited to have you on board.',
      verificationCode
    );

    // Return a successful response
    return res.status(201).json({
      emailSent: emailResponse.emailSent,
      mailMsg: emailResponse.message,
      message: "Verification code created successfully!",
      info: emailResponse.info || null,
      error: emailResponse.error || null
    });

  } catch (err) {
    // Return an error response
    return res.status(500).json({ error: err.message });
  }
};

// Function to handle password reset for existing users
const sendVerificationCodeForPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(500).json({ error: "Please provide email" });
    }

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() }).lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete any existing password reset code for this email
    await ForgotUserEmail.deleteOne({ email: email.toLowerCase() });

    // Generate and hash verification code
    const verificationCode = generateVerificationCode();
    const hashVerificationCode = await hashingVerificationCode(verificationCode);

    // Create a new ForgotUserEmail entry
    const newForgotUserEmail = new ForgotUserEmail({
      email: email.toLowerCase(),
      verificationCode: hashVerificationCode,
      verifyStatus: false
    });

    await newForgotUserEmail.save();

    // Send the verification email
    const emailResponse = await sendVerificationEmail(
      email,
      'Password Reset Verification Code!',
      'Please use the following code to reset your password. If you did not request this, please ignore this email.',
      verificationCode
    );

    // Return a successful response
    return res.status(201).json({
      emailSent: emailResponse.emailSent,
      mailMsg: emailResponse.message,
      message: "Verification code sent successfully!",
      info: emailResponse.info || null,
      error: emailResponse.error || null
    });

  } catch (err) {
    // Return an error response
    return res.status(500).json({ error: err.message });
  }
};
  
// Utility function to verify the provided code
const verifyCode = async (email, verificationCode, Model) => {
  const verificationRequest = await Model.findOne({ email: email.toLowerCase(), verifyStatus: false });
  if (!verificationRequest) {
    return { error: 'Please request a verification code for this email', status: 404 };
  }

  const isMatch = await bcrypt.compare(verificationCode, verificationRequest.verificationCode);
  if (isMatch) {
    verificationRequest.verifyStatus = true;
    await verificationRequest.save();
    return { message: 'Verification successful!', status: 200 };
  } else {
    return { error: 'Verification failed!', status: 400 };
  }
};

// Function to verify the email verification code
const verifyingEmailVerification = async (req, res) => {
  try {
    const { verificationCode, email } = req.body;

    if (!email || !verificationCode) {
      return res.status(400).json({ error: "Please provide email and verification code" });
    }

    const result = await verifyCode(email, verificationCode, EmailVerify);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(result.status).json({ message: result.message });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Function to verify the password reset code
const verifyingPasswordReset = async (req, res) => {
  try {
    const { verificationCode, email } = req.body;

    if (!email || !verificationCode) {
      return res.status(400).json({ error: "Please provide email and verification code" });
    }

    const result = await verifyCode(email, verificationCode, ForgotUserEmail);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(result.status).json({ message: result.message });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

//function for reset the password with new password
const resettingPassword = async (req, res) => {
  try {
    const { newPassword, email } = req.body;

    if (!newPassword || !email) {
      return res.status(400).json({ error: "Please provide email and new password" });
    }

    // Ensure the email is verified
    const isVerified = await ForgotUserEmail.findOne({ email: email.toLowerCase(), verifyStatus: true });

    if (!isVerified) {
      return res.status(400).json({ error: "Please verify with your code sent to the mail first, or request a new one" });
    }

    // Hash the new password
    const hashPassword = await bcrypt.hash(newPassword, 12);

    // Update the user's password
    await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { $set: { password: hashPassword } }
    );

    // Remove the verification record
    await ForgotUserEmail.deleteOne({ email: email.toLowerCase() });

    return res.status(200).json({ message: 'Password reset successfully!' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/* create a contact form  */
const createContactOrFaqForm = async (req, res) => {
  try {
      const { fullName, email, subject, message, type } = req.body;

      if ( !fullName || !email || !subject || !message || !type ) {
          return res.status(400).json({ error: "All fields are required." });
      }

      let form;
      if(type ==="contact"){
        form = new ContactForm({
            fullName,
            email,
            subject,
            message
        });
  
        await form.save();
      }else if (type === "faq"){
        form = new Faq({
          fullName,
          email,
          subject,
          message
      });

      await form.save();
      }else {
        return res.status(400).json({ error: "Invalid type" });
      };

      res.status(201).json({
          message: `${type === "contact" ? "Contact" : type === "faq" ? "FAQ" : ""} Form submitted successfully!`,
          form: form.toObject()
      });
  }catch (err) {
      console.log(err);
      res.status(500).json({ error: "Internal server error" });
  }
};

/* find recent faq */
const getLatestFaq = async (req, res) => {
  try {
    const allLatestFaq = await Faq.find({ answer: { $ne: "" } })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select("subject answer") 
      .lean()
      .exec();

    if (allLatestFaq.length === 0) {
      return res.status(404).json({ error: "No Faq found" });
    }

    // No need to map again as we have already selected the desired fields
    return res.status(200).json(allLatestFaq);

  } catch (err) {
    // Return 500 if an error occurs
    return res.status(500).json({ error: err.message });
  }
};


module.exports = {
    orderDetail,
    editOrderDetails,
    updateUserInfo,
    updatingUserPassword,
    submitReview,
    getAllReviewsForUser,
    editUserReview,
    createSupportTic,
    sendingVerificationCodeForEmailVerify,
    verifyingEmailVerification,
    verifyingPasswordReset,
    sendVerificationCodeForPasswordReset,
    resettingPassword,
    createContactOrFaqForm,
    getLatestFaq,
    addToCartFunction,
    orderIdCreationApi,
    buyNow,
    removeItemFromCart,
    changeQuantity,
    clearCart
};


