const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const { 
    getAllOrders,
    getAllSupportTic
 } = require("../controller/commonRoleController");
 
 //endpoint to get all the order details -add
 router.get("/get-all-orders", authMiddleware, getAllOrders);

//endpoint to get all support tic 
 router.get("/get-all-support-tic", authMiddleware, getAllSupportTic);

 module.exports = router;