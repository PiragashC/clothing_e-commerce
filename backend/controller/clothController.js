const { default: mongoose } = require("mongoose");
const Cloth = require("../models/clothe");
const {handleUpload, deleteOldImage} = require("../utils/cloudinaryUtils");
const Sales = require("../models/sales");

//creating new cloth
const createNewCloth = async (req, res) => {
    try {
        const { role } = req.user;
        if (role !== "Admin") {
            return res.status(403).json({ error: "You are not authorized" });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No images provided' });
        }

        const images = [];
        const design = [];

        for (const file of req.files) {
            const b64 = Buffer.from(file.buffer).toString("base64");
            const dataURI = `data:${file.mimetype};base64,${b64}`;
            const cldRes = await handleUpload(dataURI);
            images.push(cldRes.secure_url);

            const quantityFieldName = `quantity_${file.originalname}`;
            if (quantityFieldName in req.body) {
                const data = JSON.parse(req.body[quantityFieldName]);
                let total = JSON.parse(data.total);
                if(data.size){
                  total = data.size.reduce((sum, item) => sum + Object.values(item)[0], 0);
                }
                design.push({
                    imgUrl: cldRes.secure_url,
                    total: parseInt(total),
                    ...(data.size && {size: data.size.map(s =>
                      Object.fromEntries(
                        Object.entries(s).map(([key, value]) => [key.toLowerCase(), value])
                      )
                    )})
                });
            }
        }

        const { name, price, finalPrice, stockStatus, category, subCategory, desc, brand, promotionType, keyWords } = req.body;

        if (!name || !price || !finalPrice || !stockStatus || !category || !subCategory || !brand || !keyWords) {
            return res.status(400).json({ error: 'Please provide all the required fields' });
        }

        if(price < finalPrice){
            return res.status(400).json({ error: 'Final price must be less than or eqaual to Price'});
        }
        const discount = Math.round(((price - finalPrice) / price) * 100);

        // Calculate total quantity
        const totalQuantity = design.reduce((sum, item) => sum + item.total, 0);

        const lowerCaseKeyWords = JSON.parse(keyWords).map(keyWord => keyWord.toLowerCase());

        const newCloth = new Cloth({
            name,
            keyWords: lowerCaseKeyWords,
            finalPrice,
            price,
            discount,
            stockStatus,
            promotionType,
            category,
            subCategory,
            design,
            desc,
            stock: totalQuantity,
            quantity: totalQuantity,
            brand,
            images
        });

        await newCloth.save();
        res.status(201).json(newCloth);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};


//find all cloths with filter
const getAllClothsUnderFilter = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            keyWord,
            name,
            minPrice,
            maxPrice,
            category,
            subCategory,
            brand,
            stockStatus,
            minDiscount,
            maxDiscount,
            promotionType,
            topSelling,
            ids 
        } = req.query;

        if (!page && !limit && !name && !minPrice && !maxPrice && !category && !subCategory && !brand && !stockStatus && !minDiscount && !maxDiscount && !promotionType && !topSelling && !ids) {
            return res.status(400).json({ error: "Provide necessary value in the request query" });
        }

        const parsedPage = parseInt(page);
        const parsedLimit = parseInt(limit);

        if (isNaN(parsedPage) || parsedPage <= 0 || isNaN(parsedLimit) || parsedLimit <= 0) {
            return res.status(400).json({ error: "Page and limit must be positive integers" });
        }

        const filter = {};

        if (Array.isArray(ids) && ids.length > 0) {
            filter._id = { $in: ids }; 
        }

        if (keyWord) {
            filter.keyWords = { $regex: keyWord, $options: "i" };
        }

        if (Array.isArray(name) && name.length > 0) {
            filter.name = { $in: name };
        }

        if (minPrice || maxPrice) {
            filter.finalPrice = {};
            if (minPrice) {
                filter.finalPrice.$gte = parseFloat(minPrice);
            }
            if (maxPrice) {
                filter.finalPrice.$lte = parseFloat(maxPrice);
            }
        }

        if (minDiscount || maxDiscount) {
            filter.discount = {};
            if (minDiscount) {
                filter.discount.$gte = parseFloat(minDiscount);
            }
            if (maxDiscount) {
                filter.discount.$lte = parseFloat(maxDiscount);
            }
        }

        if (Array.isArray(category) && category.length > 0) {
            filter.category = { $in: category };
        }

        if (Array.isArray(subCategory) && subCategory.length > 0) {
            filter.subCategory = { $in: subCategory };
        }

        if (Array.isArray(brand) && brand.length > 0) {
            filter.brand = { $in: brand };
        }

        if (Array.isArray(stockStatus) && stockStatus.length > 0) {
            filter.stockStatus = { $in: stockStatus };
        }

        if (Array.isArray(promotionType) && promotionType.length > 0) {
            filter.promotionType = { $in: promotionType };
        }

        const totalCount = await Cloth.countDocuments(filter);

        const skip = (parsedPage - 1) * parsedLimit;

        const sortOption = topSelling ? { sellingRatio: -1 } : { updatedAt: -1 };

        const allClothAfterFilter = await Cloth.find(filter)
            .sort(sortOption)
            .skip(skip)
            .limit(parsedLimit)
            .lean()
            .exec();

        if (allClothAfterFilter.length === 0) {
            return res.status(404).json({ error: "No results found" });
        }

        return res.status(200).json({
            currentPage: parsedPage,
            totalPages: Math.ceil(totalCount / parsedLimit),
            totalCount,
            data: allClothAfterFilter,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

//find the documents from db according to the type
const getDocumentsAccordingToType = async (req, res) => {
    try {
        const { type, value } = req.query;

        // Validate input
        if (!value) {
            res.status(200).json([]);
            return;
        }

        let query = {};

        // Determine the field to search based on the type
        if (type === "name") {
            query.name = { $regex: value, $options: "i" };
        } else if (type === "brand") {
            query.brand = { $regex: value, $options: "i" };
        } else if (type === "keyWords") {
            query.keyWords = { $regex: value, $options: "i" };
        } else if (type === "category") {
            query.category = { $regex: value, $options: "i" };
        } else if (type === "subCategory") {
            query.subCategory = { $regex: value, $options: "i" };
        } else {
            return res.status(400).json({ error: "Invalid type provided" });
        }

        // Perform the query on the Cloth collection
        const documents = await Cloth.find(query, { [type]: 1 }).lean();

        // Extract the results from the documents
        const results = documents.map(doc => doc[type]);

        // Send the results
        return res.status(200).json(results);
    } catch (err) {
        // Handle errors
        return res.status(500).json({ error: err.message });
    }
};

//get all categories, sub categories and brand depend on the request
const getRequiredList = async (req, res) => {
  try {
    const { type } = req.query;

    if (!type) {
      return res.status(400).json({ error: "Provide necessary value in the request query" });
    }

    const validTypes = ["category", "subcategory", "brand"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: "Invalid type provided" });
    }

    const fields = {
      category: "category",
      subcategory: "subCategory",
      brand: "brand"
    };

    const result = await Cloth.distinct(fields[type]);
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};


//get an individual cloth
const getCloth = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid cloth ID' });
        }
        
        const cloth = await Cloth.findById(id).lean();
        // Handle case where cloth is not found
        if (!cloth) {
            return res.status(404).json({ error: "Cloth not found" });
        }
        res.status(200).json(cloth);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

//edit the particular work form data of the user
const updateAClothInfo = async (req, res) => {
  try {
      const { id } = req.params;
      const { role } = req.user;

      if (role !== "Admin") {
          return res.status(403).json({ error: "You are not authorized" });
      }

      // Check if the provided ID is valid
      if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.status(400).json({ error: "Invalid cloth ID" });
      }

      const clothTobeUpdated = await Cloth.findById(id);

      if (!clothTobeUpdated) {
          return res.status(404).json({ error: "Cloth not found" });
      }

      const {
          name, keyWords, finalPrice, price, stockStatus, promotionType,
          category, subCategory, desc, brand, design
      } = req.body;

      // Handle updating the design array
      if (design) {
        const designArray = JSON.parse(design);
        for (const newDesign of designArray) {
            if (newDesign._id) {
                const existingDesign = clothTobeUpdated.design.id(newDesign._id);
                if (existingDesign) {
                    // Update the size information
                    for (const newSizeObj of newDesign.size) {
                        const newSizeKey = Object.keys(newSizeObj)[0]; 
                        const newSizeValue = newSizeObj[newSizeKey];
        
                        if (!Number.isInteger(newSizeValue)) {
                            return res.status(400).json({ error: `Invalid size value for ${newSizeKey}` });
                        }
        
                        // Find existing size object by matching the key (case-insensitive)
                        const existingSizeIndex  = existingDesign.size.findIndex(s => {
                            const existingSizeKey = Object.keys(s)[0]
                            return existingSizeKey.toLowerCase() === newSizeKey.toLowerCase();
                        });

                        if (existingSizeIndex !== -1) {
                          // Update the value directly in the existing object
                          const existingSizeObject = existingDesign.size[existingSizeIndex];
                          existingSizeObject[newSizeKey.toLowerCase()] = newSizeValue;
                        } else {
                          // If no matching size key exists, add the new size entry as a plain object
                          const newSizeEntry = {};
                          newSizeEntry[newSizeKey.toLowerCase()] = newSizeValue;
                          existingDesign.size.push(newSizeEntry);
                        }                                                
                    }
        
                    // // // Convert the Maps to plain JavaScript objects before saving
                    // let newArray = [];
                    // existingDesign.size.map((sizeMap) =>
                    //     newArray.push(Object.fromEntries(sizeMap))
                    // );

                    // existingDesign.size = newArray;

                    // existingDesign.size = existingDesign.size.map(sizeMap => Object.fromEntries(sizeMap));

                    // console.log(newArray)

                    // Calculate the new total based on the updated size array
                    const newTotalOfExistingDesign = existingDesign.size.reduce((sum, item) => {
                      const sizeValue = Object.values(item)[0];
                      return sum + sizeValue;
                    }, 0);
        
                    // Update the total in the existing design object
                    existingDesign.total = newTotalOfExistingDesign;

        
                } else {
                    throw new Error(`No existing design found for ID ${newDesign._id}`);
                }
            } else {
                throw new Error(`No design ID provided for ${JSON.stringify(newDesign)}`);
            }
        }
    }
    
    

      if (req.files && req.files.length > 0) {
          for (const file of req.files) {
              const b64 = Buffer.from(file.buffer).toString("base64");
              const dataURI = `data:${file.mimetype};base64,${b64}`;
              const cldRes = await handleUpload(dataURI);
              clothTobeUpdated.images.push(cldRes.secure_url);

              const quantityFieldName = `quantity_${file.originalname}`;
              if (quantityFieldName in req.body) {
                  const data = JSON.parse(req.body[quantityFieldName]);
                  let total = parseInt(data.total, 10);

                  if (isNaN(total)) {
                      return res.status(400).json({ error: `Invalid total value for ${file.originalname}` });
                  }

                  if (data.size) {
                      total = data.size.reduce((sum, item) => sum + Object.values(item)[0], 0);
                  }

                  clothTobeUpdated.design.push({
                      imgUrl: cldRes.secure_url,
                      total: total,
                      ...(data.size && { size: data.size.map(s =>
                          Object.fromEntries(
                              Object.entries(s).map(([key, value]) => [key.toLowerCase(), value])
                          )
                      ) })
                  });
              } else {
                  throw new Error(`No quantity provided for ${file.originalname}`);
              }
          }
      }

      let discount = clothTobeUpdated.discount;
      if (finalPrice || price) {
          const newFinalPrice = finalPrice || clothTobeUpdated.finalPrice;
          const newPrice = price || clothTobeUpdated.price;
          if (newPrice < newFinalPrice) {
              return res.status(400).json({ error: 'Final price must be less than or equal to Price' });
          }
          discount = Math.round(((newPrice - newFinalPrice) / newPrice) * 100);
      }

      const totalQuantity = clothTobeUpdated.design.reduce((sum, item) => sum + item.total, 0);

      clothTobeUpdated.name = name || clothTobeUpdated.name;
      clothTobeUpdated.keyWords = keyWords || clothTobeUpdated.keyWords;
      clothTobeUpdated.finalPrice = finalPrice || clothTobeUpdated.finalPrice;
      clothTobeUpdated.price = price || clothTobeUpdated.price;
      clothTobeUpdated.discount = discount;
      clothTobeUpdated.stockStatus = stockStatus || clothTobeUpdated.stockStatus;
      clothTobeUpdated.promotionType = promotionType || clothTobeUpdated.promotionType;
      clothTobeUpdated.category = category || clothTobeUpdated.category;
      clothTobeUpdated.subCategory = subCategory || clothTobeUpdated.subCategory;
      clothTobeUpdated.desc = desc || clothTobeUpdated.desc;
      clothTobeUpdated.stock = totalQuantity || clothTobeUpdated.stock;
      clothTobeUpdated.quantity = totalQuantity || clothTobeUpdated.quantity;
      clothTobeUpdated.sellingRatio = (design) ? 0 : clothTobeUpdated.sellingRatio;
      clothTobeUpdated.brand = brand || clothTobeUpdated.brand;

      await clothTobeUpdated.save();

      res.status(200).json({ message: "Cloth Updated Successfully!", updatedCloth: clothTobeUpdated });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
};


//delete a cloth
const deleteCloth = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;

    // Check if the provided ID is valid
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid cloth ID' });
    }

    // Check if the user has the required role
    if (role !== 'Admin') {
      return res.status(403).json({ error: 'You are not authorized' });
    }

    const clothToBeDeleted = await Cloth.findById(id);

    if (!clothToBeDeleted) {
      return res.status(404).json({ error: 'Cloth not found' });
    }

    const uploadedImages = clothToBeDeleted.images;

    // Delete images from Cloudinary if there are any
    if (uploadedImages.length > 0) {
      for (const image of uploadedImages) {
        const urlParts = image.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const publicId = fileName.split('.')[0];

        // Delete the image from Cloudinary
        await deleteOldImage(publicId);
      }
    }

    const deletionResult = await Cloth.deleteOne({ _id: id });

    if (deletionResult.deletedCount === 0) {
      return res.status(404).json({ error: 'Cloth not found' });
    }

    res.status(200).json({ message: 'Cloth deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// get best sell product this week

const getCurrentWeekRange = () => {
  const now = new Date();
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return { startOfWeek, endOfWeek };
};


const getBestSellingCloths = async (req, res) => {
  const { startOfWeek, endOfWeek } = getCurrentWeekRange();

  try {
    const bestSellingCloths = await Sales.aggregate([
      {
        $match: {
          saleDate: { $gte: startOfWeek, $lte: endOfWeek }
        }
      },
      {
        $group: {
          _id: "$productId",
          totalQuantity: { $sum: "$quantity" }
        }
      },
      {
        $sort: { totalQuantity: -1 }
      },
      {
        $limit: 10 // Adjust the limit as needed
      },
      {
        $lookup: {
          from: "cloths",
          localField: "_id",
          foreignField: "_id",
          as: "clothDetails"
        }
      },
      {
        $unwind: "$clothDetails"
      },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          totalQuantity: 1,
          clothDetails: {
            name: 1,
            price: 1,
            finalPrice: 1,
            finalPrice: 1,
            rating: 1,
            images: 1
          }
        }
      }
    ]);

    res.status(200).json(bestSellingCloths);
  } catch (error) {
    console.error("Error finding best-selling cloths:", error);
    res.status(500).json({ error: error.message });
  }
};


module.exports = {
    createNewCloth,
    getAllClothsUnderFilter,
    getDocumentsAccordingToType,
    getCloth,
    updateAClothInfo,
    deleteCloth,
    getRequiredList,
    getBestSellingCloths
}