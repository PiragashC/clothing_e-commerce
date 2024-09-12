const User = require("../models/user");
const { updateClothProducts } = require("../common/cloth");
const sendEmail = require("../common/mailService");
const Order = require("../models/order");
const Sales = require("../models/sales");
const ContactForm = require("../models/contact");
const Faq = require("../models/faq");

/* change the status of order document */
const changingTheStatusOfOrderDoc = async (req, res) => {
    try {
        const { orderId, status, rejectedMsg } = req.body;
        const { role } = req.user;

        if (!orderId || !status) {
            return res.status(400).json({ error: "Order ID and status are required" });
        }

        if (role === "User") {
            return res.status(401).json({ error: "You are not authorized!" });
        }

        if (status === "Rejected" && !rejectedMsg) {
            return res.status(400).json({ error: "Rejected message is required" });
        }

        const updatedOrderDoc = await Order.findOne({ orderId }).lean();
        if (!updatedOrderDoc) {
            return res.status(404).json({ error: "Order not found" });
        }

        const orderedUser = await User.findById(updatedOrderDoc.userId);
        const currentStatus = updatedOrderDoc.status;
        let emailSubject, emailText;

        const generateEmailText = (message, note) => `
            <div style="padding: 20px; font-family: Calibri;">
                <div style="text-align: center;">
                    <a href="webaddress"><img src="logo" alt="Shopname Logo" width="80" height="80"></a>
                </div>
                <div style="margin-top: 40px; font-size: 15px;">
                    <p>Dear ${orderedUser.title} ${orderedUser.firstName} ${orderedUser.lastName},</p>
                    <p>${message}</p>
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
                            ${updatedOrderDoc.productDetail.map((product, index) => `
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
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;"><strong>${updatedOrderDoc.billingAmount}</strong></td>
                            </tr>
                        </tbody>
                    </table>
                    <p>${note}</p>
                    <p>If you have any questions, please contact our support team at <a href="mailto:supportaddress">supportaddress</a>.</p>
                    <p>Thank you for choosing Shopname. We look forward to serving you.</p>
                </div>
            </div>
        `;

        switch (status) {
            case "Confirmed":
                if (currentStatus !== "Pending") {
                    return res.status(400).json({ error: "Invalid status transition" });
                }
                updatedOrderDoc.status = "Confirmed";
                emailSubject = `Order Confirmed (Order ID: ${updatedOrderDoc.orderId}) - SHOPNAME`;
                emailText = generateEmailText(
                    "Your Order has been confirmed. You will get your order soon.",
                    ""
                );
                break;

            case "Rejected":
                if (currentStatus !== "Pending") {
                    return res.status(400).json({ error: "Invalid status transition" });
                }
                updatedOrderDoc.status = "Rejected";
                await updateClothProducts(updatedOrderDoc.productDetail, "return");
                emailSubject = `Order Rejected (Order ID: ${updatedOrderDoc.orderId}) - SHOPNAME`;
                emailText = generateEmailText(
                    `Your Order has been rejected due to ${rejectedMsg}.`,
                    ""
                );
                break;

            case "Cancelled":
                if (currentStatus !== "Pending") {
                    return res.status(400).json({ error: "Invalid status transition" });
                }
                updatedOrderDoc.status = "Cancelled";
                await updateClothProducts(updatedOrderDoc.productDetail, "return");
                emailSubject = `Order Cancelled (Order ID: ${updatedOrderDoc.orderId}) - SHOPNAME`;
                emailText = generateEmailText(
                    "Your Order has been cancelled.",
                    ""
                );
                break;

            case "Delivered":
                if (currentStatus !== "Confirmed") {
                    return res.status(400).json({ error: "Invalid status transition" });
                }
                updatedOrderDoc.status = "Delivered";
                await Promise.all(updatedOrderDoc.productDetail.map(async (product) => {
                    const { orderId, productId, designId, name, quantity, totalPrice, promotionType, saleDate, design, size } = product;
                    const newSale = new Sales({
                        orderId,
                        productId,
                        designId,
                        name,
                        quantity,
                        totalPrice,
                        promotionType,
                        saleDate,
                        design,
                        size
                    });
                    await newSale.save();
                }));
                orderedUser.orders += 1;
                await orderedUser.save();
                emailSubject = `Order Delivered (Order ID: ${updatedOrderDoc.orderId}) - SHOPNAME`;
                emailText = generateEmailText(
                    "Your Order has been delivered. Thank you for purchasing, Have a nice day :)",
                    ""
                );
                break;

            default:
                return res.status(400).json({ error: "Invalid status transition" });
        }

        const updatedDocument = await Order.findByIdAndUpdate(updatedOrderDoc._id, updatedOrderDoc, { new: true });
        const emailResponse = await sendEmail(orderedUser.email, emailSubject, emailText);

        return res.status(200).json({
            emailSent: emailResponse.emailSent,
            mailMsg: emailResponse.message,
            message: "Order status updated successfully!",
            newDoc: updatedDocument.toObject(),
            info: emailResponse.info || null,
            error: emailResponse.error || null
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
/* find all users */
const getAllUsers = async (req, res) => {
    try {
        // Extract query parameters and user information from the request
        const { page = 1, limit = 10 } = req.query;
        const { role } = req.user;

        if (role !== "Admin") {
            return res.status(403).json({ error: "You are not authorized" });
        }

        // Parse page and limit as integers
        const parsedPage = parseInt(page, 10);
        const parsedLimit = parseInt(limit, 10);

        // Validate page and limit values
        if (isNaN(parsedPage) || parsedPage <= 0 || isNaN(parsedLimit) || parsedLimit <= 0) {
            return res.status(400).json({ error: "Page and limit must be positive integers" });
        }

        // Count total documents matching the query
        const totalCount = await User.countDocuments({role: "User"});

        // Calculate the number of documents to skip based on the current page
        const skip = (parsedPage - 1) * parsedLimit;

        // Fetch the users matching the query with pagination
        const allUsers = await User.find({role: "User"})
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(parsedLimit)
            .lean()
            .exec();

        // Return the fetched users along with pagination details
        return res.status(200).json({
            currentPage: parsedPage,
            totalPages: Math.ceil(totalCount / parsedLimit),
            totalCount,
            data: allUsers,
        });

    } catch (err) {
        // Return 500 if an error occurs
        res.status(500).json({ error: err.message });
    }
};

/* find all users name with search term */
const getAllUsersWithNameAndId = async (req, res) => {
    try {
        const { role } = req.user;

        // Check if the user is an Admin
        if (role !== "Admin") {
            return res.status(403).json({ error: "You are not authorized" });
        }

        // Ensure the name field is provided in the request query
        const { name } = req.query;
        if (!name) {
            return res.status(200).json([]);
        }

        // Create a case-insensitive regex for the name search
        const nameRegex = new RegExp(name, "i");

        // Fetch users matching the query with only necessary fields
        const allUsers = await User.find({
            role: "User",
            $or: [
                { firstName: nameRegex },
                { lastName: nameRegex }
            ]
        }).select("firstName lastName _id").lean().exec();

        // If no users are found, return an empty array
        if (allUsers.length === 0) {
            return res.status(200).json([]);
        }

        // Map users to include only userId and name
        const userWithNameAndId = allUsers.map(user => ({
            userId: user._id,
            name: user.firstName + ' ' + user.lastName,
        }));

        // Return the fetched users
        return res.status(200).json(userWithNameAndId);

    } catch (err) {
        // Return 500 if an error occurs
        return res.status(500).json({ error: err.message });
    }
};

/* get all contact forms */
const getAllContactOrFaqForms = async (req, res) => {
    try {
        const { page = 1, limit = 10, type } = req.query;
        const { role } = req.user;

        if( role !== "Admin" ){
            return res.status(403).json({ error: "You are not authorized" });
        };

        if(!type){
            return res.status(400).json({ error: "Type is required" });
        };

        // Parse page and limit as integers
        const parsedPage = parseInt(page, 10);
        const parsedLimit = parseInt(limit, 10);

        // Validate page and limit values
        if (isNaN(parsedPage) || parsedPage <= 0 || isNaN(parsedLimit) || parsedLimit <= 0) {
            return res.status(400).json({ error: "Page and limit must be positive integers" });
        };

        // Calculate the number of documents to skip based on the current page
        const skip = (parsedPage - 1) * parsedLimit;

        let totalCount;
        let allForms
        if(type ==="contact"){
            totalCount = await ContactForm.countDocuments();
            allForms = await ContactForm.find()
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(parsedLimit)
                .lean()
                .exec();
        }else if (type === "faq"){
            totalCount = await Faq.countDocuments();
            allForms = await Faq.find()
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(parsedLimit)
                .lean()
                .exec();
        }else {
            return res.status(400).json({ error: "Invalid type" });
          };

            if(allForms.length === 0){
                return res.status(404).json({ error: "No Contact Form found" });
            };

            return res.status(200).json({
                currentPage: parsedPage,
                totalPages: Math.ceil(totalCount / parsedLimit),
                totalCount,
                data: allForms,
            });
    }catch (err) {
        console.log(err);
        response.status(500).json({ error: "Internal Server Error" });
    }
};

const respondToTheContactOrFaqForm = async (req, res) => {
    try {
        const { response, type, formId } = req.body;
        const { role } = req.user;

        if (role !== "Admin") {
            return res.status(403).json({ error: "You are not authorized" });
        }

        if (!type || !response || !formId) {
            return res.status(400).json({ error: "Fill the required field!" });
        }

        let form;
        if (type === "contact") {
            form = await ContactForm.findById(formId).lean();
        } else if (type === "faq") {
            form = await Faq.findById(formId);
            form.answer = response;
            await form.save();
        } else {
            return res.status(400).json({ error: "Invalid type" });
        }

        if (!form) {
            return res.status(404).json({ error: "Form not found" });
        }

        const emailResponse = await sendEmail(
            form.email,
            'Welcome to Shop name!',
            `
                <div style="padding: 20px; font-family: Calibri;">
                    <div style="text-align: center;">
                        <a href="webaddress"><img src="logo" alt="Shopname Logo" width="80" height="80"></a>
                    </div>
                    <div style="margin-top: 40px; font-size: 15px;">
                        <p>Dear ${form.fullName},</p>
                        <p>Thank you for visiting our website! We're excited to have you on board.</p>
                        <p>Please find the answer to your query below:</p>
                        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                            <thead>
                                <tr>
                                    <th style="border: 1px solid #ddd; padding: 8px;">Subject</th>
                                    <th style="border: 1px solid #ddd; padding: 8px;">Message</th>
                                    <th style="border: 1px solid #ddd; padding: 8px;">Response</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${form.subject}</td>
                                    <td style="border: 1px solid #ddd; padding: 8px;">${form.message}</td>
                                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${response}</td>
                                </tr>
                            </tbody>
                        </table>
                        <p>If you have any questions, please contact our support team at <a href="mailto:supportaddress">supportaddress</a>.</p>
                        <p>Thank you for choosing Shopname. We look forward to serving you.</p>
                    </div>
                </div>
            `
        );

        return res.status(201).json({
            form,
            emailSent: emailResponse.emailSent,
            mailMsg: emailResponse.message,
            info: emailResponse.info || null,
            error: emailResponse.error || null
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};


module.exports = {
    changingTheStatusOfOrderDoc,
    getAllUsers,
    getAllUsersWithNameAndId,
    getAllContactOrFaqForms,
    respondToTheContactOrFaqForm
};