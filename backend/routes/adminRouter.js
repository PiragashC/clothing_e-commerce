const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
    changingTheStatusOfOrderDoc, 
    getAllUsers,
    getAllUsersWithNameAndId,
    getAllContactOrFaqForms,
    respondToTheContactOrFaqForm
 } = require("../controller/adminController");

 //endpoint to change the status of an order -add
 router.patch("/change-status-of-order", authMiddleware, changingTheStatusOfOrderDoc);
 
 //endpoint to get all users -add
 router.get("/get-all-users", authMiddleware, getAllUsers);

//endpoint to find all users name with their id for the requested name -add
 router.get("/get-all-users-name", authMiddleware, getAllUsersWithNameAndId);

//endpoint to get all contact forms -add
router.get("/get-all-contact-or-faq-forms", authMiddleware, getAllContactOrFaqForms);

//enpoint to sent email to the query user depend on type (faq or contact) -add
router.post("/send-email-for-faq-or-contact-user", authMiddleware, respondToTheContactOrFaqForm);

 module.exports = router;