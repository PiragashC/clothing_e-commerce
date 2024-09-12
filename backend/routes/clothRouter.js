const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const Multer = require("multer");
const { 
  createNewCloth, 
  getAllClothsUnderFilter,
  getDocumentsAccordingToType,
  getCloth,
  updateAClothInfo,
  deleteCloth,
  getRequiredList,
  getBestSellingCloths
 } = require("../controller/clothController");

// Define routes for user operations

const storage = new Multer.memoryStorage();
const upload = Multer({
  storage,
});

//endpoint for creating cloth -add
router.post("/addCloth", authMiddleware, upload.array("images"), createNewCloth);

//end point for find cloth with filtering -add
router.get("/findClothes", getAllClothsUnderFilter);

//end point for find documents according to the type -add
router.get("/findDocumentsForType", getDocumentsAccordingToType);

//end point to find an individual cloth 
router.get("/findACloth/:id", getCloth);

//end point to update a specific cloth -add
router.put("/updateCloth/:id", authMiddleware, upload.array("images"), updateAClothInfo);

//endpoint to delete a specific cloth -add
router.delete("/deleteCloth/:id",authMiddleware, deleteCloth);

//end point to get required list -add
router.get("/get-required-list", getRequiredList);

//endpoint to find best sell product this week -add
router.get("/get-best-sell-product-this-week", getBestSellingCloths);

module.exports = router;
