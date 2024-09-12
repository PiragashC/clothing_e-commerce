const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const Multer = require("multer");
const path = require('path');

const { 
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
 } = require("../controller/userController");

// Define the maximum file size (in bytes) for each image. For example, 5MB:
const MAX_SIZE = 5 * 1024 * 1024;

// Define allowed image extensions
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];

// Create the memory storage:
const storage = Multer.memoryStorage();

// Create the upload middleware with file filter and size limits:
const upload = Multer({
  storage,
  limits: {
    fileSize: MAX_SIZE, // Limit each file size to MAX_SIZE
  },
  fileFilter: (req, file, cb) => {
    // Check the file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      // If the file has an allowed extension, accept it
      cb(null, true);
    } else {
      // If the file does not have an allowed extension, reject it
      cb(new Error('Only image files with .jpg, .jpeg, .png, .gif, .bmp extensions are allowed!'), false);
    }
  },
});

//endpoint to create orderId -add
router.get("/create-orderId", orderIdCreationApi);

//endpoint to add product in to the cart -add
router.patch("/add-to-cart", addToCartFunction);

 //endpoint to create order detail -add
 router.post("/order-cloth", authMiddleware, upload.array("slips"), orderDetail);

//endpoint for buynow -add
 router.post("/buy-now", upload.array("slips"), buyNow);

//endpoint to edit order detail by user as it in pending status
router.put("/edit-order-detail", authMiddleware, editOrderDetails);

//endpoint to update user info -add
 router.put("/update-user-info", authMiddleware, upload.single("dp"), updateUserInfo);

//endpoint to update user password -add
 router.patch("/update-user-password", authMiddleware, updatingUserPassword);

//endpoint to submit review -add
 router.patch("/submit-review", authMiddleware, submitReview);

//endpoint to get all reviews for a user -add
 router.get("/get-all-reviews", authMiddleware, getAllReviewsForUser);

//endpoint to edit user review -add
 router.patch("/edit-user-review", authMiddleware, editUserReview);

//endpoint to create support ticket -add
 router.post("/create-support-tic", authMiddleware, createSupportTic);

//endpoint to send verification code to verify email
router.post("/request-verify-code", sendingVerificationCodeForEmailVerify);

//endpoint to send verification code to reset password -add
router.post("/request-reset-password-code", sendVerificationCodeForPasswordReset);

//endpoint to verify email
router.post("/verify-email", verifyingEmailVerification);

//endpoint to verify password reset -add
 router.post("/verify-password-reset", verifyingPasswordReset);

//endpoint to reset password
router.post("/reset-password", resettingPassword);

//endpoint to create contact form -add
router.post("/submit-contact-or-faq-form", createContactOrFaqForm);

//endpoint to get latest faq -add
router.get("/latest-faq", getLatestFaq);

//endpoint to remove cart item
router.delete("/remove-item/:cartId", authMiddleware, removeItemFromCart);

//emdpoint to change the quantity in the cart item
router.patch("/change-quantity", authMiddleware, changeQuantity);

//endpoint to clear the cart
router.patch("/clear-cart", authMiddleware, clearCart);

 module.exports = router;