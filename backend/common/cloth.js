const Cloth = require('../models/clothe');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

const fetchAndValidateProduct = async (productId, designId, size, quantity, type) => {
    if (!productId || !designId) {
        throw new Error("Product details not provided!");
    }

    const cloth = await Cloth.findById(productId);
    
    if (!cloth) {
        throw new Error(`Product not found: ${productId}`);
    }

    const existingDesign = cloth.design.id(designId);

    if (existingDesign) {
        if(size){
            const existingSizeObj = existingDesign.size.find(s => {
                const existingSizeKey = Object.keys(s)[0]; // Get the first key from the Map
                return existingSizeKey.toLowerCase() === size.toLowerCase();
            });
            
            if (!existingSizeObj) {
                throw new Error(`Size not found: ${size}`);
            }else{
                const availableQuantityOfSize = parseInt(Object.values(existingSizeObj)[0]);
                if(type === "buy" && availableQuantityOfSize === 0){
                    throw new Error(`Size ${size} is out of stock for designId: ${designId}`);
                }else if(type === "buy" && (availableQuantityOfSize < parseInt(quantity))){
                    throw new Error(`Not enough quantity available for size: ${size}`);
                }
            }
        }else{
            if(existingDesign.size){
                const isExistingSizePresentAndHaveQuantity = existingDesign.size.map(s => {
                   return Object.values(s)[0] > 0;
                });
                if(isExistingSizePresentAndHaveQuantity.includes(true)){
                    throw new Error(`Please provide size for productId: ${productId}`);
                }   
            }
            if(type === "buy" && (existingDesign.total < quantity)){
                throw new Error(`Not enough quantity available for designId: ${designId}`);
            }
        }
    }else{
        throw new Error(`Design not found: ${designId}`);
    }

    return {cloth, design: existingDesign};
};

const findCorrespondingDesignAndSize = (cloth, designId, sizeId) => {
    const designIdObject = new ObjectId(designId);
    const sizeIdObject = new ObjectId(sizeId);
    const correspondingDesign = cloth.design.find(ds => ds._id.equals(designIdObject));
    const correspondingSize = cloth.size.find(sz => sz._id.equals(sizeIdObject));

    if (!correspondingDesign) {
        throw new Error(`Invalid designId for ProductId: ${cloth._id}`);
    }

    if (sizeId && !correspondingSize) {
        throw new Error(`Invalid sizeId for ProductId: ${cloth._id}`);
    }

    return { correspondingDesign, correspondingSize };
};

const generateClothDetails = async (productDetails, orderId, type) => {
    const newProductDetails = await Promise.all(productDetails.map(async (product) => {
        const { productId, designId, size, quantity } = product;

        const {cloth, design} = await fetchAndValidateProduct(productId, designId, size, quantity, type);
        
        const newClothDetail = {
            orderId,
            productId,
            designId,
            ...(size && {size: size.toLowerCase()}),
            name: cloth.name,
            quantity,
            totalPrice: quantity * cloth.finalPrice,
            promotionType: cloth.promotionType,
            saleDate: new Date(Date.now()).toLocaleDateString('en-GB'),
            design: design.imgUrl,
        };

        return newClothDetail;
    }));

    return newProductDetails;
};

const updateClothQuantities = async (cloth, correspondingDesign, correspondingSize, quantity, type) => {
    let sizeObject = null;
    if(correspondingSize){
        // Find the size object to update
        sizeObject = correspondingDesign.size.find(sizeObj => sizeObj.hasOwnProperty(correspondingSize.toLowerCase()));
    
        if (!sizeObject) {
            throw new Error(`Size ${correspondingSize} not found in the design.`);
        }
    };

    if (type === "buy") {
        // Decrease quantities
        correspondingDesign.total -= quantity;
        if(sizeObject){
            sizeObject[correspondingSize.toLowerCase()] -= quantity;
        };
        cloth.quantity -= quantity;
    } else if (type === "return") {
        // Increase quantities
        correspondingDesign.total += quantity;
        if(sizeObject){
            sizeObject[correspondingSize.toLowerCase()] += quantity;
        };
        cloth.quantity += quantity;
    } else {
        throw new Error(`Invalid type: ${type}`);
    }

    // Ensure quantities don't go below 0
    correspondingDesign.total = Math.max(correspondingDesign.total, 0);
    if(sizeObject){
        sizeObject[correspondingSize.toLowerCase()] = Math.max(sizeObject[correspondingSize.toLowerCase()], 0);
    };
    cloth.quantity = Math.max(cloth.quantity, 0);

    // Update selling ratio using the latest quantity
    cloth.sellingRatio = (cloth.stock - cloth.quantity) / cloth.stock;

    // Save the updated cloth document
    await cloth.save();
    await correspondingDesign.save();
    await Cloth.findOneAndUpdate(
        { _id: cloth._id, "design._id": correspondingDesign._id }, 
        { 
            $set: {
                "design.$.size": correspondingDesign.size
            }
        }
    );    
};

const updateClothProducts = async (productDetail, type) => {
    const clothPromises = productDetail.map(async (product) => {
        const { productId, designId, size, quantity } = product;
        
        const {cloth, design} = await fetchAndValidateProduct(productId, designId, size, quantity, type);

        await updateClothQuantities(cloth, design, size, quantity, type);
    });

    await Promise.all(clothPromises);
    
};



module.exports = {
    generateClothDetails,
    updateClothProducts,
    fetchAndValidateProduct
};
